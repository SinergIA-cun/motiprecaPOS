import { Plus, Printer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { EMPRESA } from '../../lib/empresa';
import { formatMoney } from '../../lib/format';
import { useVenta } from './hooks';
import { METODO_LABEL } from './metodos';

const dtFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' });

export function TicketPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: v, isLoading, isError } = useVenta(id);

  if (isLoading) {
    return <p className="p-10 text-sm text-slate-400">Cargando…</p>;
  }
  if (isError || !v) {
    return <p className="p-10 text-sm text-slate-400">No se encontró la venta.</p>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <style>{`
        @page { size: 80mm auto; margin: 4mm; }
        @media print { body { background: #fff !important; } }
        .ticket { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 print:hidden">
        <button
          type="button"
          onClick={() => navigate('/pos')}
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-700"
        >
          <Plus size={16} strokeWidth={2} />
          Nueva venta
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-navy-900"
        >
          <Printer size={16} strokeWidth={2} />
          Imprimir ticket
        </button>
      </div>

      <div className="ticket mx-auto my-8 w-[80mm] max-w-full bg-white p-4 font-mono text-[11px] leading-snug text-slate-800 shadow-lg print:my-0 print:shadow-none">
        <div className="text-center">
          <p className="font-display text-base font-bold text-navy-900">{EMPRESA.nombre}</p>
          <p className="text-slate-500">{v.sucursal.nombre}</p>
        </div>
        <div className="my-2 border-y border-dashed border-slate-300 py-1 text-center">
          <p className="font-bold text-navy-900">{v.folio}</p>
          <p className="text-slate-500">{dtFmt.format(new Date(v.createdAt))}</p>
        </div>
        <p className="text-slate-500">Cliente: {v.cliente?.nombre ?? 'Público en general'}</p>
        <p className="text-slate-500">Cajero: {v.cajero.nombre}</p>

        <table className="my-2 w-full">
          <tbody>
            {v.items.map((it) => (
              <tr key={it.id} className="align-top">
                <td className="py-0.5 pr-2">
                  {Number(it.cantidad)} × {it.descripcion}
                </td>
                <td className="py-0.5 text-right">{formatMoney(it.importe)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-slate-300 pt-1">
          <Row label="Subtotal" value={formatMoney(v.subtotal)} />
          <Row label="IVA" value={formatMoney(v.iva)} />
          <div className="flex justify-between pt-0.5 text-sm font-bold text-navy-900">
            <span>TOTAL</span>
            <span>{formatMoney(v.total)}</span>
          </div>
        </div>

        <div className="mt-1 border-t border-dashed border-slate-300 pt-1">
          {v.pagos.map((p) => (
            <Row key={p.id} label={METODO_LABEL[p.metodoPago]} value={formatMoney(p.monto)} />
          ))}
          {(() => {
            // Anticipos (§10): si lo pagado no cubre el total, el ticket muestra el saldo.
            const pagado = v.pagos.reduce((s, p) => s + Number(p.monto), 0);
            const saldo = Math.round((Number(v.total) - pagado) * 100) / 100;
            return saldo > 0 ? (
              <div className="mt-0.5 flex justify-between font-bold text-navy-900">
                <span>SALDO PENDIENTE</span>
                <span>{formatMoney(saldo)}</span>
              </div>
            ) : null;
          })()}
        </div>

        <p className="mt-3 text-center text-slate-500">¡Gracias por su compra!</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-navy-800">{value}</span>
    </div>
  );
}
