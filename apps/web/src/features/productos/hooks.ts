import type {
  CreateProductoInput,
  ImportarFichaInput,
  UpdateProductoInput,
} from '@motipreca/shared';
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

/** Carga masiva de la ficha técnica desde CSV. */
export function useImportarFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportarFichaInput) => productosApi.importarFicha(input),
    onSuccess: (data) => {
      // Una simulación no cambió nada: no hay que refrescar el catálogo.
      if (!data.simulacion) qc.invalidateQueries({ queryKey: ['productos'] });
    },
  });
}
