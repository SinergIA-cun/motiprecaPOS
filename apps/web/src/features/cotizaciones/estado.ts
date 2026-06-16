import type { EstadoCotizacion } from '../../lib/api';

export const ESTADO_LABEL: Record<EstadoCotizacion, string> = {
  ABIERTA: 'Abierta',
  APROBADA: 'Aprobada',
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
  APROBADA: 'success',
  COBRADA: 'success',
  RECHAZADA: 'danger',
  EXPIRADA: 'warn',
  ELIMINADA: 'neutral',
};
