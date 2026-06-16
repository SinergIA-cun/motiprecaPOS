import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { EstadoCotizacion } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { ESTADO_LABEL, ESTADO_TONE } from './estado';
import { useCotizacion, useUpdateEstadoCotizacion } from './hooks';

const dateFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

export function CotizacionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: cot, isLoading, isError } = useCotizacion(id);
  const estadoMut = useUpdateEstadoCotizacion();

  function cambiarEstado(estado: EstadoCotizacion) {
    estadoMut.mutate({ id, estado });
  }

  if (isLoading) {
    return <CenteredMessage>Cargando cotización…</CenteredMessage>;
  }
  if (isError || !cot) {
    return <CenteredMessage>No se encontró la cotización.</CenteredMessage>;
  }

  const acciones: { label: string; estado: EstadoCotizacion; variant?: 'primary' | 'ghost' }[] = [];
  if (cot.estado === 'ABIERTA') {
    acciones.push({ label: 'Aprobar', estado: 'APROBADA' });
    acciones.push({ label: 'Rechazar', estado: 'RECHAZADA', variant: 'ghost' });
  } else if (cot.estado === 'APROBADA') {
    acciones.push({ label: 'Marcar cobrada', estado: 'COBRADA' });
    acciones.push({ label: 'Rechazar', estado: 'RECHAZADA', variant: 'ghost' });
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-8 py-4">
        <button
          type="button"
          onClick={() => navigate('/cotizaciones')}
          aria-label="Volver"
          className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy-700"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="font-mono text-lg font-bold tracking-tight text-navy-900">{cot.folio}</h1>
        <Badge tone={ESTADO_TONE[cot.estado]}>{ESTADO_LABEL[cot.estado]}</Badge>
        <div className="ml-auto flex gap-2">
          {acciones.map((a) => (
            <Button
              key={a.estado}
              variant={a.variant}
              className="h-9 px-4 text-xs"
              disabled={estadoMut.isPending}
              onClick={() => cambiarEstado(a.estado)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Encabezado del documento */}
          <section className="grid grid-cols-2 gap-6 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-3">
            <Meta label="Cliente" value={cot.cliente.nombre} />
            <Meta label="Sucursal" value={cot.sucursal.nombre} />
            <Meta label="Asesor" value={cot.asesor.nombre} />
            <Meta label="Fecha" value={fmtDate(cot.createdAt)} />
            <Meta
              label="Vigencia"
              value={`${cot.vigencia} días · hasta ${fmtDate(cot.vigenciaHasta)}`}
            />
            {cot.cliente.rfc ? <Meta label="RFC" value={cot.cliente.rfc} mono /> : null}
          </section>

          {/* Partidas */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-paper text-slate-400">
                  <th className="px-5 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.14em]">
                    Descripción
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[0.6rem] uppercase tracking-[0.14em]">
                    Cant.
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[0.6rem] uppercase tracking-[0.14em]">
                    P. unit.
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[0.6rem] uppercase tracking-[0.14em]">
                    Desc.
                  </th>
                  <th className="px-5 py-2.5 text-right font-mono text-[0.6rem] uppercase tracking-[0.14em]">
                    Importe
                  </th>
                </tr>
              </thead>
              <tbody>
                {cot.items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3 text-navy-900">{it.descripcion}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">{it.cantidad}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      {formatMoney(it.precioUnitario)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-500">
                      {Number(it.descuentoPct)}%
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-navy-800">
                      {formatMoney(it.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end border-t border-slate-200 bg-paper px-5 py-4">
              <dl className="w-56 space-y-1.5 font-mono text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="text-navy-800">{formatMoney(cot.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">IVA</dt>
                  <dd className="text-navy-800">{formatMoney(cot.iva)}</dd>
                </div>
                <div className="flex justify-between border-t border-slate-300 pt-1.5">
                  <dt className="font-display text-base font-bold text-navy-900">Total</dt>
                  <dd className="font-display text-base font-bold text-navy-900">
                    {formatMoney(cot.total)}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {cot.observaciones ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="mb-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">
                Observaciones
              </p>
              <p className="whitespace-pre-line text-sm text-slate-600">{cot.observaciones}</p>
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm text-navy-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-8 py-20 text-sm text-slate-400">
      {children}
    </div>
  );
}
