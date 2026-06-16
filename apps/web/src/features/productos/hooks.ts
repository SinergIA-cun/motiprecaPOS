import type { CreateProductoInput, UpdateProductoInput } from '@motipreca/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productosApi, type ProductosFilter } from '../../lib/api';

export function useProductos(filter: ProductosFilter) {
  return useQuery({ queryKey: ['productos', filter], queryFn: () => productosApi.list(filter) });
}

export function useCreateProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductoInput) => productosApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productos'] }),
  });
}

export function useUpdateProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; input: UpdateProductoInput }) =>
      productosApi.update(vars.id, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productos'] }),
  });
}
