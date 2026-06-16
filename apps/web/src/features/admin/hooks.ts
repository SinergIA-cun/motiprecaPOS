import type {
  CreateSucursalInput,
  CreateUsuarioInput,
  UpdateSucursalInput,
  UpdateUsuarioInput,
} from '@motipreca/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sucursalesApi, usuariosApi, type UsuariosFilter } from '../../lib/api';

export function useSucursales() {
  return useQuery({ queryKey: ['sucursales'], queryFn: sucursalesApi.list });
}

export function useCreateSucursal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSucursalInput) => sucursalesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sucursales'] }),
  });
}

export function useUpdateSucursal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; input: UpdateSucursalInput }) =>
      sucursalesApi.update(vars.id, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sucursales'] }),
  });
}

export function useUsuarios(filter: UsuariosFilter) {
  return useQuery({ queryKey: ['usuarios', filter], queryFn: () => usuariosApi.list(filter) });
}

export function useCreateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUsuarioInput) => usuariosApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useUpdateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; input: UpdateUsuarioInput }) =>
      usuariosApi.update(vars.id, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}
