import { formatMoney } from '../../lib/format';
import { useCreditoCliente } from './hooks';

/**
 * Estado de crédito del cliente (plan §5): línea local + adeudo vivo de Alegra.
 * Se usa en el constructor de cotizaciones y en el detalle.
 */
export function CreditoPanel({ clienteId }: { clienteId: string }) {
  const { data: credito, isLoading } = useCreditoCliente(clienteId);

  if (!clienteId) return null;
  if (isLoading || !credito) {
    return (
      <div className="rounded-lg border border-slate-200 bg-paper px-4 py-3 text-xs text-slate-400">
        Consultando crédito del cliente…
      </div>
    );
  }

  // Sin línea configurada y sin vínculo: no hay nada que mostrar.
  if (credito.lineaCredito === null && !credito.vinculado) return null;

  const excedido =
    credito.disponible !== null && credito.lineaCredito !== null && credito.disponible <= 0;
  const alCorriente = credito.adeudo !== null && credito.adeudo === 0;

  const tono = excedido
    ? 'border-red-200 bg-red-50 text-red-800'
    : credito.errorAlegra
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-slate-200 bg-paper text-slate-700';

  return (
    <div className={`rounded-lg border px-4 py-3 text-xs ${tono}`}>
      <p className="mb-1.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] opacity-60">
        Crédito del cliente
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <span>
          Línea:{' '}
          <strong>
            {credito.lineaCredito !== null ? formatMoney(credito.lineaCredito) : 'sin crédito'}
          </strong>
        </span>
        {credito.vinculado ? (
          credito.errorAlegra ? (
            <span>Adeudo: no se pudo consultar Alegra</span>
          ) : (
            <>
              <span>
                Adeudo en Alegra: <strong>{formatMoney(credito.adeudo ?? 0)}</strong>
              </span>
              {credito.disponible !== null ? (
                <span>
                  Disponible: <strong>{formatMoney(Math.max(credito.disponible, 0))}</strong>
                </span>
              ) : null}
            </>
          )
        ) : (
          <span>Sin vínculo con Alegra (adeudo no disponible)</span>
        )}
        {alCorriente ? (
          <span className="font-semibold text-emerald-700">✓ Al corriente</span>
        ) : null}
        {excedido ? <span className="font-semibold">Crédito excedido</span> : null}
      </div>
    </div>
  );
}
