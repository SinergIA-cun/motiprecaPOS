import { prisma } from '@motipreca/database';
import { createVentaSchema, registrarPagoSchema } from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { conflict, notFound, unauthorized, validationError } from '../lib/errors.js';
import { resolverCantidad } from '../lib/partidas.js';
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
        items: {
          orderBy: { orden: 'asc' },
          // La equivalencia se usa en el ticket para mostrar los m² que cubren
          // las piezas (el cliente pidió superficie).
          include: { producto: { select: { unidad: true, piezasPorM2: true } } },
        },
        pagos: true,
        cliente: { select: { id: true, nombre: true, rfc: true } },
        sucursal: { select: { id: true, nombre: true, prefijoFolio: true } },
        cajero: { select: { nombre: true, iniciales: true } },
      },
    });
    if (!venta) throw notFound('Venta no encontrada');
    return { data: venta };
  });

  // ---- POST /ventas/:id/pagos ----  abono posterior sobre una venta con saldo.
  // Permite el flujo "cliente abona hoy, liquida después" sin pasar por Alegra.
  app.post('/ventas/:id/pagos', pos, async (request, reply) => {
    const { id } = request.params as { id: string };
    const usuarioId = request.user?.id;
    if (!usuarioId) throw unauthorized();

    const parsed = registrarPagoSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }

    const venta = await prisma.venta.findUnique({
      where: { id },
      select: {
        id: true,
        folio: true,
        total: true,
        cotizacionId: true,
        pagos: true,
        requiereFactura: true,
      },
    });
    if (!venta) throw notFound('Venta no encontrada');

    const total = round2(Number(venta.total));
    const pagado = round2(venta.pagos.reduce((s, p) => s + Number(p.monto), 0));
    const saldo = round2(total - pagado);
    if (saldo <= 0) throw conflict('Esta venta ya está pagada por completo');
    if (parsed.data.monto > saldo) {
      throw validationError(
        `El abono (${parsed.data.monto}) excede el saldo pendiente (${saldo}).`,
      );
    }
    const nuevoSaldo = round2(saldo - parsed.data.monto);

    await prisma.$transaction(async (tx) => {
      await tx.pago.create({
        data: {
          ventaId: id,
          metodoPago: parsed.data.metodoPago,
          monto: parsed.data.monto,
          referencia: parsed.data.referencia ?? null,
        },
      });
      // Deja rastro en la cotización origen (si la venta viene de una).
      if (venta.cotizacionId) {
        await tx.historialCotizacion.create({
          data: {
            cotizacionId: venta.cotizacionId,
            usuarioId,
            estadoAnterior: 'COBRADA',
            estadoNuevo: 'COBRADA',
            comentario:
              nuevoSaldo > 0
                ? `Abono de ${parsed.data.monto} (${parsed.data.metodoPago}); saldo ${nuevoSaldo}`
                : `Abono de ${parsed.data.monto} (${parsed.data.metodoPago}); liquidada`,
          },
        });
      }
      // Si la venta queda 100% en efectivo y sin factura, entra al registro de
      // caja auditable (§8). Facturada, el CFDI ya la rastrea.
      const todosEfectivo =
        venta.pagos.every((p) => p.metodoPago === 'EFECTIVO') &&
        parsed.data.metodoPago === 'EFECTIVO' &&
        !venta.requiereFactura;
      await tx.venta.update({ where: { id }, data: { esStandby: todosEfectivo } });
    });

    reply.code(201);
    return { data: { ventaId: id, pagado: round2(pagado + parsed.data.monto), saldo: nuevoSaldo } };
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
      select: { id: true, nombre: true, unidad: true, piezasPorM2: true },
    });
    const prodMap = new Map(productos.map((p) => [p.id, p]));
    for (const it of d.items) {
      if (!prodMap.has(it.productoId)) throw validationError('Un producto seleccionado no existe');
    }

    // Igual que en cotizaciones: si la partida se capturó en m², las piezas las
    // calcula el servidor desde la equivalencia del producto.
    const items = d.items.map((it, idx) => {
      const prod = prodMap.get(it.productoId);
      if (!prod) throw validationError('Un producto seleccionado no existe');
      const captura = resolverCantidad(it, prod);
      const base = captura.cantidad * it.precioUnitario;
      const importe = round2(base * (1 - it.descuentoPct / 100));
      return {
        productoId: it.productoId,
        descripcion: prod.nombre,
        cantidad: captura.cantidad,
        precioUnitario: it.precioUnitario,
        descuentoPct: it.descuentoPct,
        importe,
        orden: idx,
        base,
        unidadCaptura: captura.unidadCaptura,
        cantidadM2: captura.cantidadM2,
        mermaPct: captura.mermaPct,
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
    // Efectivo puro y SIN factura → entra al registro de caja en efectivo (§8).
    // Una venta en efectivo que sí se factura queda rastreada por el CFDI, así
    // que no es "efectivo no facturado" y no tiene por qué entrar aquí.
    const esStandby = d.pagos.every((p) => p.metodoPago === 'EFECTIVO') && !d.requiereFactura;

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
          esStandby,
          requiereFactura: d.requiereFactura,
          items: {
            create: items.map((i) => ({
              productoId: i.productoId,
              descripcion: i.descripcion,
              cantidad: i.cantidad,
              precioUnitario: i.precioUnitario,
              descuentoPct: i.descuentoPct,
              importe: i.importe,
              orden: i.orden,
              unidadCaptura: i.unidadCaptura,
              cantidadM2: i.cantidadM2,
              mermaPct: i.mermaPct,
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
