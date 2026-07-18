import { z } from 'zod';

const emptyToUndefined = (v: unknown): unknown => (v === '' ? undefined : v);

const emptyToNull = (v: unknown): unknown => (v === '' || v === undefined ? null : v);

export const estadoCotizacionSchema = z.enum([
  'ABIERTA',
  'PENDIENTE_APROBACION_INTERNA',
  'APROBADA',
  'RECHAZADA_INTERNA',
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

/** Seguimiento del pedido tras el cobro (§11): 4 etapas manuales. */
export const etapaPedidoSchema = z.enum([
  'EN_PRODUCCION',
  'LISTO_EN_ALMACEN',
  'ENTREGA_PROGRAMADA',
  'ENTREGADO',
]);

export const updateEtapaPedidoSchema = z.object({
  etapa: etapaPedidoSchema,
});

/** Motivo opcional al rechazar una cotización en aprobación interna. */
export const rechazarCotizacionSchema = z.object({
  motivo: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(500, 'Motivo demasiado largo').optional(),
  ),
});

/** Configuración de la regla de aprobación (Fase 1: nivel 1 = Administrador).
 *  `null` en un umbral = ese disparador está desactivado. */
export const updateReglaAprobacionSchema = z.object({
  descuentoMinimo: z.preprocess(
    emptyToNull,
    z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%').nullable(),
  ),
  montoMinimo: z.preprocess(
    emptyToNull,
    z.coerce.number().min(0, 'No puede ser negativo').nullable(),
  ),
});

export type ItemCotizacionInput = z.infer<typeof itemCotizacionSchema>;
export type CreateCotizacionInput = z.infer<typeof createCotizacionSchema>;
export type EstadoCotizacion = z.infer<typeof estadoCotizacionSchema>;
export type EtapaPedido = z.infer<typeof etapaPedidoSchema>;
export type RechazarCotizacionInput = z.infer<typeof rechazarCotizacionSchema>;
export type UpdateReglaAprobacionInput = z.infer<typeof updateReglaAprobacionSchema>;
