import { useQuery } from '@tanstack/react-query';
import { cajaApi } from '../../lib/api';

export function useCajaEfectivo() {
  return useQuery({ queryKey: ['caja', 'efectivo'], queryFn: () => cajaApi.efectivo() });
}

// Se carga sólo cuando el admin abre la bitácora (cada consulta deja rastro).
export function useCajaAccesos(enabled: boolean) {
  return useQuery({
    queryKey: ['caja', 'accesos'],
    queryFn: () => cajaApi.accesos(),
    enabled,
  });
}
