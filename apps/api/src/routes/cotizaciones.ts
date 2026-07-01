import { Prisma, prisma } from '@motipreca/database';
import {
  cobrarCotizacionSchema,
  createCotizacionSchema,
  estadoCotizacionSchema,
  rechazarCotizacionSchema,
  updateEstadoCotizacionSchema,
} from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { descuentoPctEfectivo, evaluarAprobacion } from '../lib/aprobacion.js';
import { conflict, notFound, unauthorized, validationError } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const auth = { preHandler: [authenticate] };
const adminOnly = { preHandler: [authenticate, authorize('ADMINISTRADOR')] };
const pos = { preHandler: [authenticate, authorize('CAJERO', 'GERENTE', 'ADMINISTRADOR')] };

/** Regla de aprobación de Fase 1 (nivel 1 = Administrador). */
async function reglaNivel1() {
  const nivel = await prisma.nivelAprobacion.findUnique({ where: { nivel: 1 } });
  return {
    descuentoMinimo: nivel?.descuentoMinimo != null ? Number(nivel.descuentoMinimo) : null,
    montoMinimo: nivel?.montoMinimo != null ? Number(nivel.montoMinimo) : null,
  };
}
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
        aprobaciones: {
          orderBy: { createdAt: 'desc' },
          include: { aprobador: { select: { nombre: true, iniciales: true } } },
        },
        venta: { select: { id: true, folio: true } },
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
    if (parsed.data.estado === 'COBRADA') {
      throw conflict('Para cobrar usa el flujo de cobro: registra el pago y genera la venta');
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

  // ---- POST /cotizaciones/:id/cobrar (Cajero/Gerente/Admin) ----
  // Cobra una cotización APROBADA: genera la venta (folio VTA, partidas copiadas
  // de la cotización, pagos) y la marca COBRADA — todo en una transacción.
  app.post('/cotizaciones/:id/cobrar', pos, async (request, reply) => {
    const { id } = request.params as { id: string };
    const cajeroId = request.user?.id;
    if (!cajeroId) throw unauthorized();

    const parsed = cobrarCotizacionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }

    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orden: 'asc' } },
        sucursal: { select: { prefijoFolio: true } },
        venta: { select: { id: true, folio: true } },
      },
    });
    if (!cot) throw notFound('Cotización no encontrada');
    if (cot.venta) throw conflict(`Esta cotización ya fue cobrada (venta ${cot.venta.folio})`);
    if (cot.estado !== 'APROBADA') {
      throw conflict('Solo una cotización aprobada se puede cobrar');
    }
    if (cot.vigenciaHasta < new Date()) {
      throw conflict('La cotización ya venció; revisa los precios y genera una nueva');
    }

    const total = round2(Number(cot.total));
    const sumaPagos = round2(parsed.data.pagos.reduce((s, p) => s + p.monto, 0));
    if (sumaPagos !== total) {
      throw validationError(`Los pagos suman ${sumaPagos}; deben igualar el total (${total}).`);
    }

    const venta = await prisma.$transaction(async (tx) => {
      const rango = await tx.rangoFolio.findUnique({
        where: {
          sucursalId_tipoDocumento: {
            sucursalId: cot.sucursalId,
            tipoDocumento: 'VENTA_MOSTRADOR',
          },
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
      const folio = `${cot.sucursal.prefijoFolio}-VTA-${String(numero).padStart(6, '0')}`;

      // Totales y partidas se copian tal cual de la cotización: es el contrato pactado.
      const created = await tx.venta.create({
        data: {
          folio,
          sucursalId: cot.sucursalId,
          cajeroId,
          clienteId: cot.clienteId,
          cotizacionId: cot.id,
          subtotal: cot.subtotal,
          descuentoTotal: cot.descuentoTotal,
          iva: cot.iva,
          total: cot.total,
          items: {
            create: cot.items.map((i) => ({
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
            create: parsed.data.pagos.map((p) => ({
              metodoPago: p.metodoPago,
              monto: p.monto,
              referencia: p.referencia ?? null,
            })),
          },
        },
        select: { id: true, folio: true },
      });
      await tx.cotizacion.update({ where: { id }, data: { estado: 'COBRADA' } });
      await tx.historialCotizacion.create({
        data: {
          cotizacionId: id,
          usuarioId: cajeroId,
          estadoAnterior: 'APROBADA',
          estadoNuevo: 'COBRADA',
          comentario: `Cobrada — venta ${created.folio}`,
        },
      });
      return created;
    });

    reply.code(201);
    return { data: venta };
  });

  // ---- POST /cotizaciones/:id/enviar-aprobacion ----
  // Evalúa reglas OR: si dispara → PENDIENTE_APROBACION_INTERNA; si no → auto-aprueba.
  app.post('/cotizaciones/:id/enviar-aprobacion', auth, async (request) => {
    const { id } = request.params as { id: string };
    const usuarioId = request.user?.id;
    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, estado: true, subtotal: true, descuentoTotal: true, total: true },
    });
    if (!cot) throw notFound('Cotización no encontrada');
    if (cot.estado !== 'ABIERTA') {
      throw conflict('Solo una cotización abierta se puede mandar a aprobación');
    }

    const regla = await reglaNivel1();
    const evaluacion = evaluarAprobacion(
      {
        total: Number(cot.total),
        descuentoPctEfectivo: descuentoPctEfectivo(
          Number(cot.subtotal),
          Number(cot.descuentoTotal),
        ),
      },
      regla,
    );
    const nuevoEstado = evaluacion.requiere ? 'PENDIENTE_APROBACION_INTERNA' : 'APROBADA';

    const cotizacion = await prisma.$transaction(async (tx) => {
      const updated = await tx.cotizacion.update({
        where: { id },
        data: {
          estado: nuevoEstado,
          requiereAprobacion: evaluacion.requiere,
          motivoAprobacion: evaluacion.motivo,
        },
      });
      await tx.historialCotizacion.create({
        data: {
          cotizacionId: id,
          usuarioId,
          estadoAnterior: 'ABIERTA',
          estadoNuevo: nuevoEstado,
          comentario: evaluacion.requiere
            ? `Requiere aprobación por ${evaluacion.motivo}`
            : 'Auto-aprobada (no alcanza umbrales)',
        },
      });
      return updated;
    });
    return { data: cotizacion };
  });

  // ---- POST /cotizaciones/:id/aprobar (Administrador) ----
  app.post('/cotizaciones/:id/aprobar', adminOnly, async (request) => {
    const { id } = request.params as { id: string };
    const aprobadorId = request.user?.id;
    if (!aprobadorId) throw unauthorized();
    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, estado: true },
    });
    if (!cot) throw notFound('Cotización no encontrada');
    if (cot.estado !== 'PENDIENTE_APROBACION_INTERNA') {
      throw conflict('La cotización no está pendiente de aprobación');
    }

    const cotizacion = await prisma.$transaction(async (tx) => {
      const updated = await tx.cotizacion.update({ where: { id }, data: { estado: 'APROBADA' } });
      await tx.aprobacion.create({
        data: { cotizacionId: id, nivel: 1, aprobadorId, decision: 'APROBAR' },
      });
      await tx.historialCotizacion.create({
        data: {
          cotizacionId: id,
          usuarioId: aprobadorId,
          estadoAnterior: 'PENDIENTE_APROBACION_INTERNA',
          estadoNuevo: 'APROBADA',
          comentario: 'Aprobada',
        },
      });
      return updated;
    });
    return { data: cotizacion };
  });

  // ---- POST /cotizaciones/:id/rechazar (Administrador) ----
  app.post('/cotizaciones/:id/rechazar', adminOnly, async (request) => {
    const { id } = request.params as { id: string };
    const aprobadorId = request.user?.id;
    if (!aprobadorId) throw unauthorized();
    const parsed = rechazarCotizacionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, estado: true },
    });
    if (!cot) throw notFound('Cotización no encontrada');
    if (cot.estado !== 'PENDIENTE_APROBACION_INTERNA') {
      throw conflict('La cotización no está pendiente de aprobación');
    }

    const cotizacion = await prisma.$transaction(async (tx) => {
      const updated = await tx.cotizacion.update({
        where: { id },
        data: { estado: 'RECHAZADA_INTERNA' },
      });
      await tx.aprobacion.create({
        data: {
          cotizacionId: id,
          nivel: 1,
          aprobadorId,
          decision: 'RECHAZAR',
          motivo: parsed.data.motivo ?? null,
        },
      });
      await tx.historialCotizacion.create({
        data: {
          cotizacionId: id,
          usuarioId: aprobadorId,
          estadoAnterior: 'PENDIENTE_APROBACION_INTERNA',
          estadoNuevo: 'RECHAZADA_INTERNA',
          comentario: parsed.data.motivo ? `Rechazada: ${parsed.data.motivo}` : 'Rechazada',
        },
      });
      return updated;
    });
    return { data: cotizacion };
  });

  // ---- POST /cotizaciones/:id/reabrir ----  RECHAZADA_INTERNA → ABIERTA (para corregir).
  app.post('/cotizaciones/:id/reabrir', auth, async (request) => {
    const { id } = request.params as { id: string };
    const usuarioId = request.user?.id;
    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, estado: true },
    });
    if (!cot) throw notFound('Cotización no encontrada');
    if (cot.estado !== 'RECHAZADA_INTERNA') {
      throw conflict('Solo una cotización rechazada internamente se puede reabrir');
    }

    const cotizacion = await prisma.$transaction(async (tx) => {
      const updated = await tx.cotizacion.update({
        where: { id },
        data: { estado: 'ABIERTA', requiereAprobacion: false, motivoAprobacion: null },
      });
      await tx.historialCotizacion.create({
        data: {
          cotizacionId: id,
          usuarioId,
          estadoAnterior: 'RECHAZADA_INTERNA',
          estadoNuevo: 'ABIERTA',
          comentario: 'Reabierta para edición',
        },
      });
      return updated;
    });
    return { data: cotizacion };
  });
}
