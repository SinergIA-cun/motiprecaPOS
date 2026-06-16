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
