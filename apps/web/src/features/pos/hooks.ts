import type { CreateVentaInput } from '@motipreca/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ventasApi } from '../../lib/api';

export function useCreateVenta() {
  return useMutation({ mutationFn: (input: CreateVentaInput) => ventasApi.create(input) });
}

export function useVenta(id: string) {
  return useQuery({
    queryKey: ['venta', id],
    queryFn: () => ventasApi.get(id),
    enabled: Boolean(id),
  });
}
