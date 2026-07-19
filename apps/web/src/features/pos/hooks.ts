import type { CreateVentaInput, RegistrarPagoInput } from '@motipreca/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ventasApi } from '../../lib/api';

export function useCreateVenta() {
  return useMutation({ mutationFn: (input: CreateVentaInput) => ventasApi.create(input) });
}

/** Abono posterior sobre una venta con saldo. */
export function useRegistrarPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { ventaId: string; input: RegistrarPagoInput }) =>
      ventasApi.registrarPago(vars.ventaId, vars.input),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['venta', vars.ventaId] });
      void qc.invalidateQueries({ queryKey: ['cotizacion'] });
    },
  });
}

export function useVenta(id: string) {
  return useQuery({
    queryKey: ['venta', id],
    queryFn: () => ventasApi.get(id),
    enabled: Boolean(id),
  });
}
