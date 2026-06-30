import type { EstadoCotizacion } from '../../lib/api';

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
