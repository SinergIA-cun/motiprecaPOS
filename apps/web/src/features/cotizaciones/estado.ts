import type { EstadoCotizacion, EtapaPedido } from '../../lib/api';

export const ESTADO_LABEL: Record<EstadoCotizacion, string> = {
  ABIERTA: 'Abierta',
  PENDIENTE_APROBACION_INTERNA: 'Pendiente de aprobación',
  APROBADA: 'Aprobada',
  RECHAZADA_INTERNA: 'Rechazada (interna)',
  RECHAZADA: 'Rechazada',
  COBRADA: 'Cobrada',
  EXPIRADA: 'Expirada',
  ELIMINADA: 'Eliminada',
};

export const ESTADO_TONE: Record<
  EstadoCotizacion,
  'success' | 'neutral' | 'navy' | 'danger' | 'warn'
> = {
  ABIERTA: 'navy',
  PENDIENTE_APROBACION_INTERNA: 'warn',
  APROBADA: 'success',
  COBRADA: 'success',
  RECHAZADA_INTERNA: 'danger',
  RECHAZADA: 'danger',
  EXPIRADA: 'warn',
  ELIMINADA: 'neutral',
};

/** Etapas del pedido (§11) en orden operativo. */
export const ETAPAS_PEDIDO: EtapaPedido[] = [
  'EN_PRODUCCION',
  'LISTO_EN_ALMACEN',
  'ENTREGA_PROGRAMADA',
  'ENTREGADO',
];

export const ETAPA_LABEL: Record<EtapaPedido, string> = {
  EN_PRODUCCION: 'En producción',
  LISTO_EN_ALMACEN: 'Listo en almacén',
  ENTREGA_PROGRAMADA: 'Entrega programada',
  ENTREGADO: 'Entregado',
};
