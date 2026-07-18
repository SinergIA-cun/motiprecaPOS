import type { CreateClienteInput, UpdateClienteInput } from '@motipreca/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clientesApi, type ClientesFilter } from '../../lib/api';

export function useClientes(filter: ClientesFilter) {
  return useQuery({ queryKey: ['clientes', filter], queryFn: () => clientesApi.list(filter) });
}

/** Crédito del cliente (adeudo vivo desde Alegra; el API cachea 60s). */
export function useCreditoCliente(clienteId: string) {
  return useQuery({
    queryKey: ['credito', clienteId],
    queryFn: () => clientesApi.credito(clienteId),
    enabled: Boolean(clienteId),
    staleTime: 60_000,
  });
}

export function useCreateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClienteInput) => clientesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  });
}

export function useUpdateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; input: UpdateClienteInput }) =>
      clientesApi.update(vars.id, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  });
}
