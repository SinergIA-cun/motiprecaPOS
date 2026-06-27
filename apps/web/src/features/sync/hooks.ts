import { useMutation, useQueryClient } from '@tanstack/react-query';
import { syncApi, type AlegraSyncResult } from '../../lib/api';

/** Dispara POST /sync/alegra. Al traer datos, refresca clientes y productos. */
export function useSyncAlegra() {
  const qc = useQueryClient();
  return useMutation<AlegraSyncResult>({
    mutationFn: () => syncApi.alegra(),
    onSuccess: (result) => {
      if (result.ok) {
        void qc.invalidateQueries({ queryKey: ['productos'] });
        void qc.invalidateQueries({ queryKey: ['clientes'] });
      }
    },
  });
}
