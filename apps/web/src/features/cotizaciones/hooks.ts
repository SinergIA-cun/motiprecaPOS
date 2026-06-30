import type { CreateCotizacionInput } from '@motipreca/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cotizacionesApi, type CotizacionesFilter, type EstadoCotizacion } from '../../lib/api';

export function useCotizaciones(filter: CotizacionesFilter) {
  return useQuery({
    queryKey: ['cotizaciones', filter],
    queryFn: () => cotizacionesApi.list(filter),
  });
}

export function useCotizacion(id: string) {
  return useQuery({
    queryKey: ['cotizacion', id],
    queryFn: () => cotizacionesApi.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCotizacionInput) => cotizacionesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotizaciones'] }),
  });
}

export function useUpdateEstadoCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; estado: EstadoCotizacion }) =>
      cotizacionesApi.updateEstado(vars.id, vars.estado),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      void qc.invalidateQueries({ queryKey: ['cotizacion', data.id] });
    },
  });
}

function useInvalidarCotizacion() {
  const qc = useQueryClient();
  return (id: string) => {
    void qc.invalidateQueries({ queryKey: ['cotizaciones'] });
    void qc.invalidateQueries({ queryKey: ['cotizacion', id] });
  };
}

export function useEnviarAprobacion() {
  const invalidar = useInvalidarCotizacion();
  return useMutation({
    mutationFn: (id: string) => cotizacionesApi.enviarAprobacion(id),
    onSuccess: (data) => invalidar(data.id),
  });
}

export function useAprobarCotizacion() {
  const invalidar = useInvalidarCotizacion();
  return useMutation({
    mutationFn: (id: string) => cotizacionesApi.aprobar(id),
    onSuccess: (data) => invalidar(data.id),
  });
}

export function useRechazarCotizacion() {
  const invalidar = useInvalidarCotizacion();
  return useMutation({
    mutationFn: (vars: { id: string; motivo?: string }) =>
      cotizacionesApi.rechazar(vars.id, vars.motivo),
    onSuccess: (data) => invalidar(data.id),
  });
}

export function useReabrirCotizacion() {
  const invalidar = useInvalidarCotizacion();
  return useMutation({
    mutationFn: (id: string) => cotizacionesApi.reabrir(id),
    onSuccess: (data) => invalidar(data.id),
  });
}
