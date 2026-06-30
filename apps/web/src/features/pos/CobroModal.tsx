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
  total: number;
  pending: boolean;
  errorMessage?: string;
  onClose: () => void;
  onConfirm: (metodo: MetodoPago, referencia?: string) => void;
};

export function CobroModal({ open, total, pending, errorMessage, onClose, onConfirm }: Props) {
  const [metodo, setMetodo] = useState<MetodoPago>('EFECTIVO');
  const [recibido, setRecibido] = useState('');
  const [referencia, setReferencia] = useState('');

  const esEfectivo = metodo === 'EFECTIVO';
  const recibidoNum = Number(recibido) || 0;
  const cambio = round2(recibidoNum - total);
  const puedeConfirmar = !pending && (esEfectivo ? recibidoNum >= total : true);

  return (
    <Modal open={open} title="Cobrar" subtitle={`Total ${formatMoney(total)}`} onClose={onClose}>
      <div className="space-y-5">
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
              placeholder={formatMoney(total)}
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
            onClick={() => onConfirm(metodo, esEfectivo ? undefined : referencia || undefined)}
          >
            {pending ? 'Cobrando…' : `Cobrar ${formatMoney(total)}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
