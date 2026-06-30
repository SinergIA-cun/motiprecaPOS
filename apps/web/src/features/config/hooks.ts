import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configApi } from '../../lib/api';

export function useReglaAprobacion() {
  return useQuery({
    queryKey: ['regla-aprobacion'],
    queryFn: () => configApi.getReglaAprobacion(),
  });
}

export function useUpdateReglaAprobacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { descuentoMinimo: number | null; montoMinimo: number | null }) =>
      configApi.updateReglaAprobacion(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regla-aprobacion'] }),
  });
}
