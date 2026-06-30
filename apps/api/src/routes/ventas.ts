import { prisma } from '@motipreca/database';
import { createVentaSchema } from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { conflict, notFound, unauthorized, validationError } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const IVA_RATE = 0.16;
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const pos = { preHandler: [authenticate, authorize('CAJERO', 'GERENTE', 'ADMINISTRADOR')] };

export async function ventaRoutes(app: FastifyInstance): Promise<void> {
  // ---- GET /ventas/:id ----  detalle para el ticket.
  app.get('/ventas/:id', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const venta = await prisma.venta.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orden: 'asc' } },
        pagos: true,
        cliente: { select: { id: true, nombre: true, rfc: true } },
        sucursal: { select: { id: true, nombre: true, prefijoFolio: true } },
        cajero: { select: { nombre: true, iniciales: true } },
      },
    });
    if (!venta) throw notFound('Venta no encontrada');
    return { data: venta };
  });

  // ---- POST /ventas ----  venta de mostrador (Cajero/Gerente/Admin).
  app.post('/ventas', pos, async (request, reply) => {
    const cajeroId = request.user?.id;
    if (!cajeroId) throw unauthorized();

    const parsed = createVentaSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;

    const sucursal = await prisma.sucursal.findUnique({
      where: { id: d.sucursalId },
      select: { id: true, prefijoFolio: true },
    });
    if (!sucursal) throw validationError('La sucursal no existe');
    if (d.clienteId) {
      const cli = await prisma.cliente.findUnique({
        where: { id: d.clienteId },
        select: { id: true },
      });
      if (!cli) throw validationError('El cliente no existe');
    }

    const productoIds = [...new Set(d.items.map((i) => i.productoId))];
    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, nombre: true },
    });
    const prodMap = new Map(productos.map((p) => [p.id, p.nombre]));
    for (const it of d.items) {
      if (!prodMap.has(it.productoId)) throw validationError('Un producto seleccionado no existe');
    }

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

    const sumaPagos = round2(d.pagos.reduce((s, p) => s + p.monto, 0));
    if (sumaPagos !== total) {
      throw validationError(`Los pagos suman ${sumaPagos}; deben igualar el total (${total}).`);
    }

    const venta = await prisma.$transaction(async (tx) => {
      const rango = await tx.rangoFolio.findUnique({
        where: {
          sucursalId_tipoDocumento: { sucursalId: d.sucursalId, tipoDocumento: 'VENTA_MOSTRADOR' },
        },
      });
      if (!rango || !rango.activo) {
        throw validationError('No hay rango de folios de venta para esta sucursal');
      }
      if (rango.proximoFolio > rango.rangoFin) {
        throw conflict('Se agotó el rango de folios de venta de esta sucursal');
      }
      const numero = rango.proximoFolio;
      await tx.rangoFolio.update({ where: { id: rango.id }, data: { proximoFolio: numero + 1 } });
      const folio = `${sucursal.prefijoFolio}-VTA-${String(numero).padStart(6, '0')}`;

      return tx.venta.create({
        data: {
          folio,
          sucursalId: d.sucursalId,
          cajeroId,
          clienteId: d.clienteId ?? null,
          subtotal,
          descuentoTotal,
          iva,
          total,
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
          pagos: {
            create: d.pagos.map((p) => ({
              metodoPago: p.metodoPago,
              monto: p.monto,
              referencia: p.referencia ?? null,
            })),
          },
        },
        include: {
          items: { orderBy: { orden: 'asc' } },
          pagos: true,
          cliente: { select: { nombre: true } },
          sucursal: { select: { nombre: true, prefijoFolio: true } },
          cajero: { select: { nombre: true, iniciales: true } },
        },
      });
    });

    reply.code(201);
    return { data: venta };
  });
}
