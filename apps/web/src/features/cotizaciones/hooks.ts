import type {
  CobrarCotizacionInput,
  CreateCotizacionInput,
  UpdateCotizacionInput,
} from '@motipreca/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cotizacionesApi,
  type CotizacionesFilter,
  type EstadoCotizacion,
  type EtapaPedido,
} from '../../lib/api';

export function useCotizaciones(filter: CotizacionesFilter) {
  return useQuery({
    queryKey: ['cotizaciones', filter],
    queryFn: () => cotizacionesApi.list(filter),
  });
}

export function useAsesores() {
  return useQuery({ queryKey: ['cotizaciones', 'asesores'], queryFn: cotizacionesApi.asesores });
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

export function useUpdateCotizacion() {
  const invalidar = useInvalidarCotizacion();
  return useMutation({
    mutationFn: (vars: { id: string; input: UpdateCotizacionInput }) =>
      cotizacionesApi.update(vars.id, vars.input),
    onSuccess: (data) => invalidar(data.id),
  });
}

export function useDuplicarCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cotizacionesApi.duplicar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotizaciones'] }),
  });
}

export function useReactivarCotizacion() {
  const invalidar = useInvalidarCotizacion();
  return useMutation({
    mutationFn: (id: string) => cotizacionesApi.reactivar(id),
    onSuccess: (data) => invalidar(data.id),
  });
}

export function useUpdateEtapaPedido() {
  const invalidar = useInvalidarCotizacion();
  return useMutation({
    mutationFn: (vars: { id: string; etapa: EtapaPedido }) =>
      cotizacionesApi.updateEtapa(vars.id, vars.etapa),
    onSuccess: (data) => invalidar(data.id),
  });
}

export function useCobrarCotizacion() {
  const invalidar = useInvalidarCotizacion();
  return useMutation({
    mutationFn: (vars: { id: string; input: CobrarCotizacionInput }) =>
      cotizacionesApi.cobrar(vars.id, vars.input),
    onSuccess: (_venta, vars) => invalidar(vars.id),
  });
}
