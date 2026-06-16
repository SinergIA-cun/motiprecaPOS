import { z } from 'zod';

const emptyToUndefined = (v: unknown): unknown => (v === '' ? undefined : v);

export const estadoCotizacionSchema = z.enum([
  'ABIERTA',
  'APROBADA',
  'RECHAZADA',
  'COBRADA',
  'EXPIRADA',
  'ELIMINADA',
]);

/** Una partida de la cotización. `descripcion` se toma del producto en el backend. */
export const itemCotizacionSchema = z.object({
  productoId: z.string().min(1, 'Producto requerido'),
  cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  precioUnitario: z.coerce.number().min(0, 'Precio inválido'),
  descuentoPct: z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%').default(0),
});

/** Alta de cotización. Totales y folio los calcula el servidor. */
export const createCotizacionSchema = z.object({
  clienteId: z.string().min(1, 'Selecciona un cliente'),
  sucursalId: z.string().min(1, 'Selecciona una sucursal'),
  vigencia: z.coerce.number().int().min(1, 'Mínimo 1 día').max(365, 'Máximo 365 días').default(15),
  observaciones: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000, 'Observaciones demasiado largas').optional(),
  ),
  items: z.array(itemCotizacionSchema).min(1, 'Agrega al menos una partida'),
});

export const updateEstadoCotizacionSchema = z.object({
  estado: estadoCotizacionSchema,
});

export type ItemCotizacionInput = z.infer<typeof itemCotizacionSchema>;
export type CreateCotizacionInput = z.infer<typeof createCotizacionSchema>;
export type EstadoCotizacion = z.infer<typeof estadoCotizacionSchema>;
