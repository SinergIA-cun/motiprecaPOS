import { ArrowLeft, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { APP_PUBLIC_URL, EMPRESA } from '../../lib/empresa';
import { formatMoney } from '../../lib/format';
import { useCotizacion } from './hooks';

const dateFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

export function CotizacionPrintPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: cot, isLoading, isError } = useCotizacion(id);

  if (isLoading) {
    return <p className="p-10 text-sm text-slate-400">Cargando…</p>;
  }
  if (isError || !cot) {
    return <p className="p-10 text-sm text-slate-400">No se encontró la cotización.</p>;
  }

  const bruto = Number(cot.subtotal) + Number(cot.descuentoTotal);
  const descuentoTotal = Number(cot.descuentoTotal);
  const verifyUrl = `${APP_PUBLIC_URL}/cotizaciones/${cot.id}`;

  return (
    <div className="min-h-screen bg-slate-100">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print { body { background: #fff !important; } }
        .doc { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      {/* Toolbar — solo en pantalla */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 print:hidden">
        <button
          type="button"
          onClick={() => navigate(`/cotizaciones/${cot.id}`)}
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-700"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Volver
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-navy-900"
        >
          <Printer size={16} strokeWidth={2} />
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* Documento A4 */}
      <div className="doc mx-auto my-8 w-[210mm] max-w-full bg-white p-[16mm] text-[11px] leading-relaxed text-slate-800 shadow-lg print:my-0 print:w-auto print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-navy-700 pb-4">
          <div className="flex items-center gap-3">
            <img src="/logo-motipreca.png" alt="Motipreca" className="h-12 w-auto" />
            <div>
              <p className="font-display text-lg font-bold text-navy-900">{EMPRESA.nombre}</p>
              <p className="text-slate-500">{EMPRESA.descripcion}</p>
              <p className="text-slate-500">{EMPRESA.web}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-base font-bold tracking-wide text-navy-900">COTIZACIÓN</p>
            <p className="font-mono text-navy-700">{cot.folio}</p>
            <p className="text-slate-500">{fmtDate(cot.createdAt)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-5">
          <div>
            <Label>Cliente</Label>
            <p className="font-semibold text-navy-900">{cot.cliente.nombre}</p>
            {cot.cliente.rfc ? (
              <p className="font-mono text-slate-600">RFC: {cot.cliente.rfc}</p>
            ) : null}
            {cot.cliente.email ? <p className="text-slate-600">{cot.cliente.email}</p> : null}
            {cot.cliente.telefono ? <p className="text-slate-600">{cot.cliente.telefono}</p> : null}
          </div>
          <div className="space-y-2 text-right">
            <Meta label="Sucursal" value={cot.sucursal.nombre} />
            <Meta label="Asesor" value={cot.asesor.nombre} />
            <Meta
              label="Vigencia"
              value={`${cot.vigencia} días · hasta ${fmtDate(cot.vigenciaHasta)}`}
            />
          </div>
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50 text-left font-mono text-[9px] uppercase tracking-wider text-slate-500">
              <th className="py-2 pl-2">Descripción</th>
              <th className="py-2 text-right">Cant.</th>
              <th className="py-2 text-right">P. unit.</th>
              <th className="py-2 text-right">Desc.</th>
              <th className="py-2 pr-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {cot.items.map((it) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-2 pl-2 text-navy-900">{it.descripcion}</td>
                <td className="py-2 text-right font-mono text-slate-600">{it.cantidad}</td>
                <td className="py-2 text-right font-mono text-slate-600">
                  {formatMoney(it.precioUnitario)}
                </td>
                <td className="py-2 text-right font-mono text-slate-500">
                  {Number(it.descuentoPct)}%
                </td>
                <td className="py-2 pr-2 text-right font-mono text-navy-800">
                  {formatMoney(it.importe)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end pt-4">
          <dl className="w-56 space-y-1 font-mono">
            <Row label="Subtotal" value={formatMoney(bruto)} />
            {descuentoTotal > 0 ? (
              <Row label="Descuento" value={`−${formatMoney(descuentoTotal)}`} />
            ) : null}
            <Row label="IVA (16%)" value={formatMoney(cot.iva)} />
            <div className="flex justify-between border-t border-slate-300 pt-1 font-display text-sm font-bold text-navy-900">
              <dt>Total</dt>
              <dd>{formatMoney(cot.total)}</dd>
            </div>
          </dl>
        </div>

        {cot.observaciones ? (
          <section className="mt-5 rounded border border-slate-200 p-3">
            <Label>Condiciones / observaciones</Label>
            <p className="whitespace-pre-line text-slate-700">{cot.observaciones}</p>
          </section>
        ) : null}

        <footer className="mt-6 flex items-end justify-between gap-6 border-t border-slate-200 pt-4">
          <div className="space-y-0.5">
            <Label>Datos para pago</Label>
            <p className="text-slate-700">{EMPRESA.banco.titular}</p>
            <p className="text-slate-700">{EMPRESA.banco.banco}</p>
            <p className="font-mono text-slate-700">Cuenta: {EMPRESA.banco.cuenta}</p>
            <p className="font-mono text-slate-700">CLABE: {EMPRESA.banco.clabe}</p>
            <p className="mt-2 text-slate-500">
              {EMPRESA.redes.facebook} · {EMPRESA.redes.instagram}
            </p>
          </div>
          <div className="shrink-0 text-center">
            <QRCodeSVG value={verifyUrl} size={84} />
            <p className="mt-1 text-[9px] text-slate-400">Verifica esta cotización</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-slate-400">{children}</p>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-navy-900">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-navy-800">{value}</dd>
    </div>
  );
}
