import { Prisma, prisma } from '@motipreca/database';
import {
  cobrarCotizacionSchema,
  createCotizacionSchema,
  estadoCotizacionSchema,
  rechazarCotizacionSchema,
  updateCotizacionSchema,
  updateEstadoCotizacionSchema,
  updateEtapaPedidoSchema,
} from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { descuentoPctEfectivo, evaluarAprobacion } from '../lib/aprobacion.js';
import { creditoDeCliente } from '../lib/credito.js';
import { conflict, notFound, unauthorized, validationError } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const auth = { preHandler: [authenticate] };
const adminOnly = { preHandler: [authenticate, authorize('ADMINISTRADOR')] };
const pos = { preHandler: [authenticate, authorize('CAJERO', 'GERENTE', 'ADMINISTRADOR')] };
const gerencia = { preHandler: [authenticate, authorize('GERENTE', 'ADMINISTRADOR')] };

/** Etiquetas para la bitácora de cambios de etapa. */
const ETAPA_TEXTO: Record<string, string> = {
  EN_PRODUCCION: 'En producción',
  LISTO_EN_ALMACEN: 'Listo en almacén',
  ENTREGA_PROGRAMADA: 'Entrega programada',
  ENTREGADO: 'Entregado',
};

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

/** Valida productos, toma snapshot de descripción y calcula partidas + totales. */
async function calcularPartidas(
  itemsInput: {
    productoId: string;
    cantidad: number;
    precioUnitario: number;
    descuentoPct: number;
  }[],
) {
  const productoIds = [...new Set(itemsInput.map((i) => i.productoId))];
  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } },
    select: { id: true, nombre: true },
  });
  const prodMap = new Map(productos.map((p) => [p.id, p.nombre]));
  for (const it of itemsInput) {
    if (!prodMap.has(it.productoId)) throw validationError('Un producto seleccionado no existe');
  }
  const items = itemsInput.map((it, idx) => {
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
  return { items, subtotal, descuentoTotal, iva, total };
}

export async function cotizacionRoutes(app: FastifyInstance): Promise<void> {
  // ---- GET /cotizaciones?estado=&clienteId=&asesorId=&q= ----
  // `q` busca en folio, cliente (nombre/razón social), RFC y productos cotizados.
  app.get('/cotizaciones', auth, async (request) => {
    const q = request.query as {
      estado?: string;
      clienteId?: string;
      asesorId?: string;
      q?: string;
    };
    const where: Prisma.CotizacionWhereInput = {};
    if (q.estado) {
      const e = estadoCotizacionSchema.safeParse(q.estado);
      if (e.success) where.estado = e.data;
    }
    if (q.clienteId) where.clienteId = q.clienteId;
    if (q.asesorId) where.asesorId = q.asesorId;
    if (q.q?.trim()) {
      const term = q.q.trim();
      where.OR = [
        { folio: { contains: term, mode: 'insensitive' } },
        { cliente: { nombre: { contains: term, mode: 'insensitive' } } },
        { cliente: { rfc: { contains: term, mode: 'insensitive' } } },
        { items: { some: { descripcion: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const data = await prisma.cotizacion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        cliente: { select: { id: true, nombre: true } },
        sucursal: { select: { prefijoFolio: true } },
        asesor: { select: { id: true, nombre: true, iniciales: true } },
      },
    });
    return { data };
  });

  // ---- GET /cotizaciones/asesores ---- vendedores con cotizaciones (para el filtro).
  app.get('/cotizaciones/asesores', auth, async () => {
    const filas = await prisma.cotizacion.findMany({
      distinct: ['asesorId'],
      select: { asesor: { select: { id: true, nombre: true, iniciales: true } } },
      orderBy: { asesorId: 'asc' },
    });
    return { data: filas.map((f) => f.asesor) };
  });

  // ---- GET /cotizaciones/:id ----
  app.get('/cotizaciones/:id', auth, async (request) => {
    const { id } = request.params as { id: string };
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { orden: 'asc' },
          include: { producto: { select: { unidad: true } } },
        },
        cliente: true,
        sucursal: { select: { id: true, nombre: true, prefijoFolio: true } },
        asesor: { select: { nombre: true, iniciales: true } },
        aprobaciones: {
          orderBy: { createdAt: 'desc' },
          include: { aprobador: { select: { nombre: true, iniciales: true } } },
        },
        venta: {
          select: {
            id: true,
            folio: true,
            esStandby: true,
            pagos: { select: { monto: true } },
          },
        },
        historial: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!cotizacion) throw notFound('Cotización no encontrada');

    // La bitácora guarda usuarioId sin FK; resolvemos nombres en una sola query.
    const usuarioIds = [
      ...new Set(cotizacion.historial.map((h) => h.usuarioId).filter((u): u is string => !!u)),
    ];
    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: usuarioIds } },
      select: { id: true, nombre: true },
    });
    const nombrePor = new Map(usuarios.map((u) => [u.id, u.nombre]));
    const historial = cotizacion.historial.map((h) => ({
      id: h.id,
      estadoAnterior: h.estadoAnterior,
      estadoNuevo: h.estadoNuevo,
      comentario: h.comentario,
      createdAt: h.createdAt,
      usuario: h.usuarioId ? (nombrePor.get(h.usuarioId) ?? null) : null,
    }));

    return { data: { ...cotizacion, historial } };
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

    // Snapshot de descripción + totales (MVP: IVA 16% global; descuento por partida).
    const { items, subtotal, descuentoTotal, iva, total } = await calcularPartidas(d.items);
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
          anticipoPct: d.anticipoPct,
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

  // ---- PUT /cotizaciones/:id ---- edita una cotización ABIERTA (partidas y datos).
  // La sucursal no se toca: el folio le pertenece.
  app.put('/cotizaciones/:id', auth, async (request) => {
    const { id } = request.params as { id: string };
    const usuarioId = request.user?.id;
    const parsed = updateCotizacionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;

    const existing = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, estado: true },
    });
    if (!existing) throw notFound('Cotización no encontrada');
    if (existing.estado !== 'ABIERTA') {
      throw conflict('Solo una cotización abierta se puede editar');
    }
    const cliente = await prisma.cliente.findUnique({
      where: { id: d.clienteId },
      select: { id: true },
    });
    if (!cliente) throw validationError('El cliente seleccionado no existe');

    const { items, subtotal, descuentoTotal, iva, total } = await calcularPartidas(d.items);
    const vigenciaHasta = new Date(Date.now() + d.vigencia * 86_400_000);

    const cotizacion = await prisma.$transaction(async (tx) => {
      await tx.itemCotizacion.deleteMany({ where: { cotizacionId: id } });
      const updated = await tx.cotizacion.update({
        where: { id },
        data: {
          clienteId: d.clienteId,
          subtotal,
          descuentoTotal,
          iva,
          total,
          vigencia: d.vigencia,
          vigenciaHasta,
          anticipoPct: d.anticipoPct,
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
      await tx.historialCotizacion.create({
        data: {
          cotizacionId: id,
          usuarioId,
          estadoAnterior: 'ABIERTA',
          estadoNuevo: 'ABIERTA',
          comentario: 'Editada (partidas y datos actualizados)',
        },
      });
      return updated;
    });
    return { data: cotizacion };
  });

  // ---- POST /cotizaciones/:id/duplicar ---- copia como nueva ABIERTA.
  app.post('/cotizaciones/:id/duplicar', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const asesorId = request.user?.id;
    if (!asesorId) throw unauthorized();

    const original = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orden: 'asc' } },
        sucursal: { select: { prefijoFolio: true } },
      },
    });
    if (!original) throw notFound('Cotización no encontrada');
    if (original.estado === 'ELIMINADA') throw conflict('La cotización está eliminada');

    const vigenciaHasta = new Date(Date.now() + original.vigencia * 86_400_000);

    const nueva = await prisma.$transaction(async (tx) => {
      const rango = await tx.rangoFolio.findUnique({
        where: {
          sucursalId_tipoDocumento: {
            sucursalId: original.sucursalId,
            tipoDocumento: 'COTIZACION',
          },
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
      const folio = `${original.sucursal.prefijoFolio}-COT-${String(numero).padStart(6, '0')}`;

      // Copia con los precios pactados de la original; el asesor los revisa al editar.
      const creada = await tx.cotizacion.create({
        data: {
          folio,
          sucursalId: original.sucursalId,
          asesorId,
          clienteId: original.clienteId,
          subtotal: original.subtotal,
          descuentoTotal: original.descuentoTotal,
          iva: original.iva,
          total: original.total,
          vigencia: original.vigencia,
          vigenciaHasta,
          anticipoPct: original.anticipoPct,
          observaciones: original.observaciones,
          items: {
            create: original.items.map((i) => ({
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
        select: { id: true, folio: true },
      });
      await tx.historialCotizacion.create({
        data: {
          cotizacionId: creada.id,
          usuarioId: asesorId,
          estadoNuevo: 'ABIERTA',
          comentario: `Duplicada de ${original.folio}`,
        },
      });
      return creada;
    });

    reply.code(201);
    return { data: nueva };
  });

  // ---- POST /cotizaciones/:id/reactivar ---- EXPIRADA → ABIERTA (§14, con aviso).
  app.post('/cotizaciones/:id/reactivar', auth, async (request) => {
    const { id } = request.params as { id: string };
    const usuarioId = request.user?.id;
    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, estado: true, vigencia: true },
    });
    if (!cot) throw notFound('Cotización no encontrada');
    if (cot.estado !== 'EXPIRADA')
      throw conflict('Solo una cotización expirada se puede reactivar');

    const cotizacion = await prisma.$transaction(async (tx) => {
      const updated = await tx.cotizacion.update({
        where: { id },
        data: {
          estado: 'ABIERTA',
          vigenciaHasta: new Date(Date.now() + cot.vigencia * 86_400_000),
        },
      });
      await tx.historialCotizacion.create({
        data: {
          cotizacionId: id,
          usuarioId,
          estadoAnterior: 'EXPIRADA',
          estadoNuevo: 'ABIERTA',
          comentario: 'Reactivada — revisar precios antes de reenviar',
        },
      });
      return updated;
    });
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

    // Cobro tipo cajero: el monto es libre (desde 0.01 hasta el total). El
    // anticipo sugerido (§10) es sólo referencia; si se cobra por debajo queda
    // asentado en la bitácora como autorizado por la dirección.
    const total = round2(Number(cot.total));
    const anticipoSugerido = round2((total * Number(cot.anticipoPct)) / 100);
    const sumaPagos = round2(parsed.data.pagos.reduce((s, p) => s + p.monto, 0));
    if (sumaPagos <= 0) {
      throw validationError('El monto a cobrar debe ser mayor a 0.');
    }
    if (sumaPagos > total) {
      throw validationError(`Los pagos suman ${sumaPagos}; no pueden exceder el total (${total}).`);
    }
    const saldo = round2(total - sumaPagos);
    const bajoAnticipo = sumaPagos < anticipoSugerido;
    // Efectivo puro y sin factura → entra al registro de caja en efectivo (auditable).
    const esStandby = parsed.data.pagos.every((p) => p.metodoPago === 'EFECTIVO');

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
          esStandby,
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
      // Nace la orden de producción, pendiente de autorizar (§10 paso 6).
      await tx.cotizacion.update({
        where: { id },
        data: { estado: 'COBRADA', etapaPedido: 'POR_AUTORIZAR' },
      });
      const detallePago =
        saldo > 0
          ? `Cobrado ${sumaPagos} de ${total} (saldo ${saldo})`
          : `Cobrada por completo (${total})`;
      const notaAnticipo = bajoAnticipo
        ? ` — por debajo del anticipo sugerido (${anticipoSugerido}, ${Number(cot.anticipoPct)}%), autorizado por la dirección`
        : '';
      await tx.historialCotizacion.create({
        data: {
          cotizacionId: id,
          usuarioId: cajeroId,
          estadoAnterior: 'APROBADA',
          estadoNuevo: 'COBRADA',
          comentario: `${detallePago}${notaAnticipo} — venta ${created.folio}. Orden por autorizar.`,
        },
      });
      return created;
    });

    reply.code(201);
    return { data: venta };
  });

  // ---- PATCH /cotizaciones/:id/etapa (Gerente/Admin) ----
  // Seguimiento manual del pedido (§11) hasta que exista el módulo de Producción.
  app.patch('/cotizaciones/:id/etapa', gerencia, async (request) => {
    const { id } = request.params as { id: string };
    const usuarioId = request.user?.id;
    const parsed = updateEtapaPedidoSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, estado: true, etapaPedido: true },
    });
    if (!cot) throw notFound('Cotización no encontrada');
    if (cot.estado !== 'COBRADA') {
      throw conflict('El seguimiento del pedido aplica solo a cotizaciones cobradas');
    }

    const etapa = parsed.data.etapa;
    const cotizacion = await prisma.$transaction(async (tx) => {
      const updated = await tx.cotizacion.update({ where: { id }, data: { etapaPedido: etapa } });
      await tx.historialCotizacion.create({
        data: {
          cotizacionId: id,
          usuarioId,
          estadoAnterior: 'COBRADA',
          estadoNuevo: 'COBRADA',
          comentario: `Pedido: ${ETAPA_TEXTO[cot.etapaPedido ?? ''] ?? 'sin etapa'} → ${ETAPA_TEXTO[etapa]}`,
        },
      });
      return updated;
    });
    return { data: cotizacion };
  });

  // ---- POST /cotizaciones/:id/enviar-aprobacion ----
  // Evalúa reglas OR: si dispara → PENDIENTE_APROBACION_INTERNA; si no → auto-aprueba.
  app.post('/cotizaciones/:id/enviar-aprobacion', auth, async (request) => {
    const { id } = request.params as { id: string };
    const usuarioId = request.user?.id;
    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        subtotal: true,
        descuentoTotal: true,
        total: true,
        cliente: { select: { id: true, alegraId: true, lineaCredito: true } },
      },
    });
    if (!cot) throw notFound('Cotización no encontrada');
    if (cot.estado !== 'ABIERTA') {
      throw conflict('Solo una cotización abierta se puede mandar a aprobación');
    }

    // Disparador de crédito (§5): solo aplica si el cliente tiene línea configurada.
    const credito =
      cot.cliente.lineaCredito != null
        ? { disponible: (await creditoDeCliente(cot.cliente)).disponible }
        : null;

    const regla = await reglaNivel1();
    const evaluacion = evaluarAprobacion(
      {
        total: Number(cot.total),
        descuentoPctEfectivo: descuentoPctEfectivo(
          Number(cot.subtotal),
          Number(cot.descuentoTotal),
        ),
        credito,
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
