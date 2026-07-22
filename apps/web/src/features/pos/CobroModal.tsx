import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import type { MetodoPago } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { METODO_LABEL, METODOS_POS } from './metodos';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type Props = {
  open: boolean;
  /** Monto máximo cobrable (total de la cotización, o saldo si es un abono). */
  total: number;
  /** Anticipo sugerido (§10). Sólo referencia: el cajero puede cobrar menos. */
  anticipoSugerido?: number;
  /** true = monto libre (cotizaciones y abonos). false = cobro exacto (POS mostrador). */
  montoLibre?: boolean;
  titulo?: string;
  pending: boolean;
  errorMessage?: string;
  onClose: () => void;
  onConfirm: (metodo: MetodoPago, monto: number, referencia?: string) => void;
};

export function CobroModal({
  open,
  total,
  anticipoSugerido,
  montoLibre = false,
  titulo = 'Cobrar',
  pending,
  errorMessage,
  onClose,
  onConfirm,
}: Props) {
  const [metodo, setMetodo] = useState<MetodoPago>('EFECTIVO');
  const [recibido, setRecibido] = useState('');
  const [referencia, setReferencia] = useState('');

  const esEfectivo = metodo === 'EFECTIVO';
  // En efectivo redondeamos a peso entero: no existen centavos en el cajón.
  // Sólo aplica a los montos que el cajero elige (anticipo/abono); el total de
  // venta conserva sus centavos del IVA.
  const aPeso = (n: number) => Math.round(n);
  const rawSugerido = round2(anticipoSugerido ?? total);
  const sugerido = esEfectivo && montoLibre ? aPeso(rawSugerido) : rawSugerido;

  // Arranca en el anticipo sugerido (redondeado si el método por defecto es
  // efectivo); el cajero lo puede cambiar libremente.
  const [montoStr, setMontoStr] = useState(String(montoLibre ? aPeso(rawSugerido) : total));

  const montoLibreNum = esEfectivo ? aPeso(Number(montoStr) || 0) : round2(Number(montoStr) || 0);
  const monto = montoLibre ? montoLibreNum : total;
  const montoValido = monto > 0 && monto <= total;
  const saldo = round2(total - monto);
  const bajoAnticipo = montoLibre && monto > 0 && monto < sugerido;

  const recibidoNum = esEfectivo ? aPeso(Number(recibido) || 0) : Number(recibido) || 0;
  const cambio = round2(recibidoNum - monto);
  const puedeConfirmar = !pending && montoValido && (esEfectivo ? recibidoNum >= monto : true);

  return (
    <Modal open={open} title={titulo} subtitle={`Total ${formatMoney(total)}`} onClose={onClose}>
      <div className="space-y-5">
        {montoLibre ? (
          <div className="space-y-2">
            <label htmlFor="monto-cobrar" className="text-sm font-semibold text-slate-700">
              Monto a cobrar
            </label>
            <Input
              id="monto-cobrar"
              type="number"
              min={esEfectivo ? '1' : '0.01'}
              max={total}
              step={esEfectivo ? '1' : '0.01'}
              inputMode={esEfectivo ? 'numeric' : 'decimal'}
              className="font-mono text-lg"
              value={montoStr}
              // En efectivo redondeamos al peso al salir del campo (no hay centavos en caja).
              onChange={(e) => setMontoStr(e.target.value)}
              onBlur={() =>
                esEfectivo && montoStr && setMontoStr(String(aPeso(Number(montoStr) || 0)))
              }
              aria-invalid={!montoValido}
            />
            <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-paper px-4 py-2 text-xs text-slate-500">
              {anticipoSugerido !== undefined ? (
                <span>
                  Anticipo sugerido: <strong>{formatMoney(sugerido)}</strong>
                </span>
              ) : null}
              {saldo > 0 && montoValido ? (
                <span>
                  Saldo restante: <strong>{formatMoney(saldo)}</strong>
                </span>
              ) : null}
            </div>
            {!montoValido ? (
              <p className="text-xs text-red-600">
                El monto debe ser mayor a 0 y no exceder {formatMoney(total)}.
              </p>
            ) : bajoAnticipo ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Está por debajo del anticipo sugerido. Quedará asentado en la bitácora como
                autorizado por la dirección.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {METODOS_POS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetodo(m)}
              className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                metodo === m
                  ? 'border-navy-700 bg-navy-700 text-white'
                  : 'border-slate-200 text-navy-800 hover:bg-navy-50'
              }`}
            >
              {METODO_LABEL[m]}
            </button>
          ))}
        </div>

        {esEfectivo ? (
          <div className="space-y-2">
            <label htmlFor="recibido" className="text-sm font-semibold text-slate-700">
              Monto recibido
            </label>
            <Input
              id="recibido"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              className="font-mono text-lg"
              placeholder={formatMoney(monto)}
              value={recibido}
              onChange={(e) => setRecibido(e.target.value)}
            />
            <div className="flex justify-between rounded-lg bg-paper px-4 py-2 font-mono text-sm">
              <span className="text-slate-500">Cambio</span>
              <span className={cambio >= 0 ? 'text-navy-900' : 'text-red-600'}>
                {formatMoney(Math.max(cambio, 0))}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="referencia" className="text-sm font-semibold text-slate-700">
              Referencia (opcional)
            </label>
            <Input
              id="referencia"
              className="font-mono"
              placeholder="Folio / últimos 4 dígitos…"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>
        )}

        {errorMessage ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="h-11" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="h-11"
            disabled={!puedeConfirmar}
            onClick={() =>
              onConfirm(metodo, monto, esEfectivo ? undefined : referencia || undefined)
            }
          >
            {pending ? 'Cobrando…' : `Cobrar ${formatMoney(montoValido ? monto : 0)}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
