import { Prisma, prisma } from '@motipreca/database';
import {
  createCotizacionSchema,
  estadoCotizacionSchema,
  updateEstadoCotizacionSchema,
} from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { conflict, notFound, unauthorized, validationError } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';

const auth = { preHandler: [authenticate] };
const IVA_RATE = 0.16;
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export async function cotizacionRoutes(app: FastifyInstance): Promise<void> {
  // ---- GET /cotizaciones?estado=&clienteId=&q= ----
  app.get('/cotizaciones', auth, async (request) => {
    const q = request.query as { estado?: string; clienteId?: string; q?: string };
    const where: Prisma.CotizacionWhereInput = {};
    if (q.estado) {
      const e = estadoCotizacionSchema.safeParse(q.estado);
      if (e.success) where.estado = e.data;
    }
    if (q.clienteId) where.clienteId = q.clienteId;
    if (q.q?.trim()) where.folio = { contains: q.q.trim(), mode: 'insensitive' };

    const data = await prisma.cotizacion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        cliente: { select: { id: true, nombre: true } },
        sucursal: { select: { prefijoFolio: true } },
        asesor: { select: { nombre: true, iniciales: true } },
      },
    });
    return { data };
  });

  // ---- GET /cotizaciones/:id ----
  app.get('/cotizaciones/:id', auth, async (request) => {
    const { id } = request.params as { id: string };
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orden: 'asc' } },
        cliente: true,
        sucursal: { select: { id: true, nombre: true, prefijoFolio: true } },
        asesor: { select: { nombre: true, iniciales: true } },
      },
    });
    if (!cotizacion) throw notFound('Cotización no encontrada');
    return { data: cotizacion };
  });

  // ---- POST /cotizaciones ----
  app.post('/cotizaciones', auth, async (request, reply) => {
    const asesorId = request.user?.id;
    if (!asesorId) throw unauthorized();

    const parsed = createCotizacionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;

    const [cliente, sucursal] = await Promise.all([
      prisma.cliente.findUnique({ where: { id: d.clienteId }, select: { id: true } }),
      prisma.sucursal.findUnique({
        where: { id: d.sucursalId },
        select: { id: true, prefijoFolio: true },
      }),
    ]);
    if (!cliente) throw validationError('El cliente seleccionado no existe');
    if (!sucursal) throw validationError('La sucursal seleccionada no existe');

    // Snapshot de descripción desde el producto (y validación de existencia).
    const productoIds = [...new Set(d.items.map((i) => i.productoId))];
    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, nombre: true },
    });
    const prodMap = new Map(productos.map((p) => [p.id, p.nombre]));
    for (const it of d.items) {
      if (!prodMap.has(it.productoId)) throw validationError('Un producto seleccionado no existe');
    }

    // Totales (MVP: IVA 16% global; descuento por partida).
    const items = d.items.map((it, idx) => {
      const base = it.cantidad * it.precioUnitario;
      const importe = round2(base * (1 - it.descuentoPct / 100));
      return {
        productoId: it.productoId,
        descripcion: prodMap.get(it.productoId) ?? '',
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        descuentoPct: it.descuentoPct,
        importe,
        orden: idx,
        base,
      };
    });
    const subtotal = round2(items.reduce((s, i) => s + i.importe, 0));
    const descuentoTotal = round2(items.reduce((s, i) => s + (i.base - i.importe), 0));
    const iva = round2(subtotal * IVA_RATE);
    const total = round2(subtotal + iva);
    const vigenciaHasta = new Date(Date.now() + d.vigencia * 86_400_000);

    // Folio + creación en una transacción (consistencia del consecutivo).
    const cotizacion = await prisma.$transaction(async (tx) => {
      const rango = await tx.rangoFolio.findUnique({
        where: {
          sucursalId_tipoDocumento: { sucursalId: d.sucursalId, tipoDocumento: 'COTIZACION' },
        },
      });
      if (!rango || !rango.activo) {
        throw validationError('No hay rango de folios de cotización para esta sucursal');
      }
      if (rango.proximoFolio > rango.rangoFin) {
        throw conflict('Se agotó el rango de folios de cotización de esta sucursal');
      }
      const numero = rango.proximoFolio;
      await tx.rangoFolio.update({ where: { id: rango.id }, data: { proximoFolio: numero + 1 } });
      const folio = `${sucursal.prefijoFolio}-COT-${String(numero).padStart(6, '0')}`;

      return tx.cotizacion.create({
        data: {
          folio,
          sucursalId: d.sucursalId,
          asesorId,
          clienteId: d.clienteId,
          subtotal,
          descuentoTotal,
          iva,
          total,
          vigencia: d.vigencia,
          vigenciaHasta,
          observaciones: d.observaciones ?? null,
          items: {
            create: items.map((i) => ({
              productoId: i.productoId,
              descripcion: i.descripcion,
              cantidad: i.cantidad,
              precioUnitario: i.precioUnitario,
              descuentoPct: i.descuentoPct,
              importe: i.importe,
              orden: i.orden,
            })),
          },
        },
        include: { items: { orderBy: { orden: 'asc' } } },
      });
    });

    reply.code(201);
    return { data: cotizacion };
  });

  // ---- PATCH /cotizaciones/:id/estado ----
  app.patch('/cotizaciones/:id/estado', auth, async (request) => {
    const { id } = request.params as { id: string };
    const parsed = updateEstadoCotizacionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const existing = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, estado: true },
    });
    if (!existing) throw notFound('Cotización no encontrada');
    if (existing.estado === 'ELIMINADA') throw conflict('La cotización está eliminada');

    const cotizacion = await prisma.cotizacion.update({
      where: { id },
      data: { estado: parsed.data.estado },
    });
    return { data: cotizacion };
  });
}
