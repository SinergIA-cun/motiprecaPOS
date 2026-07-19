import { z } from 'zod';

const emptyToUndefined = (v: unknown): unknown => (v === '' ? undefined : v);

export const metodoPagoSchema = z.enum([
  'EFECTIVO',
  'TRANSFERENCIA',
  'TARJETA_DEBITO',
  'TARJETA_CREDITO',
  'MIXTO',
]);

/** Una partida del carrito POS. `descripcion` la toma el backend del producto. */
export const itemVentaSchema = z.object({
  productoId: z.string().min(1, 'Producto requerido'),
  cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  precioUnitario: z.coerce.number().min(0, 'Precio inválido'),
  descuentoPct: z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%').default(0),
});

/** Un pago aplicado a la venta. La suma de pagos debe igualar el total. */
export const pagoSchema = z.object({
  metodoPago: metodoPagoSchema,
  monto: z.coerce.number().min(0, 'Monto inválido'),
  referencia: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(60, 'Referencia demasiado larga').optional(),
  ),
});

/** Alta de venta de mostrador (POS). Totales y folio los calcula el servidor. */
export const createVentaSchema = z.object({
  sucursalId: z.string().min(1, 'Sucursal requerida'),
  clienteId: z.preprocess(
    (v: unknown) => (v === '' || v === undefined ? undefined : v),
    z.string().min(1).optional(),
  ),
  items: z.array(itemVentaSchema).min(1, 'Agrega al menos un producto'),
  pagos: z.array(pagoSchema).min(1, 'Registra al menos un pago'),
});

/** Cobro de una cotización aprobada: solo los pagos; partidas y totales salen de la cotización. */
export const cobrarCotizacionSchema = z.object({
  pagos: z.array(pagoSchema).min(1, 'Registra al menos un pago'),
});

/** Abono posterior sobre una venta con saldo (pagos parciales, §10). */
export const registrarPagoSchema = pagoSchema.extend({
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
});

export type ItemVentaInput = z.infer<typeof itemVentaSchema>;
export type PagoInput = z.infer<typeof pagoSchema>;
export type CreateVentaInput = z.infer<typeof createVentaSchema>;
export type CobrarCotizacionInput = z.infer<typeof cobrarCotizacionSchema>;
export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;
export type MetodoPago = z.infer<typeof metodoPagoSchema>;
