import { ArrowLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../hooks/useAuth';
import { formatMoney } from '../../lib/format';
import { ESTADO_LABEL, ESTADO_TONE } from './estado';
import {
  useAprobarCotizacion,
  useCotizacion,
  useEnviarAprobacion,
  useReabrirCotizacion,
  useRechazarCotizacion,
  useUpdateEstadoCotizacion,
} from './hooks';

const dateFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

export function CotizacionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMINISTRADOR';

  const { data: cot, isLoading, isError } = useCotizacion(id);
  const enviarMut = useEnviarAprobacion();
  const aprobarMut = useAprobarCotizacion();
  const rechazarMut = useRechazarCotizacion();
  const reabrirMut = useReabrirCotizacion();
  const estadoMut = useUpdateEstadoCotizacion();

  const [rechazarOpen, setRechazarOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  const pendiente =
    enviarMut.isPending ||
    aprobarMut.isPending ||
    rechazarMut.isPending ||
    reabrirMut.isPending ||
    estadoMut.isPending;

  if (isLoading) {
    return <CenteredMessage>Cargando cotización…</CenteredMessage>;
  }
  if (isError || !cot) {
    return <CenteredMessage>No se encontró la cotización.</CenteredMessage>;
  }

  const bruto = Number(cot.subtotal) + Number(cot.descuentoTotal);
  const descuentoTotal = Number(cot.descuentoTotal);
  const rechazo = cot.aprobaciones.find((a) => a.decision === 'RECHAZAR');

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
          {cot.estado === 'ABIERTA' ? (
            <Button
              className="h-9 px-4 text-xs"
              disabled={pendiente}
              onClick={() => enviarMut.mutate(id)}
            >
              Mandar a aprobación
            </Button>
          ) : null}
          {cot.estado === 'PENDIENTE_APROBACION_INTERNA' && isAdmin ? (
            <>
              <Button
                className="h-9 px-4 text-xs"
                disabled={pendiente}
                onClick={() => aprobarMut.mutate(id)}
              >
                Aprobar
              </Button>
              <Button
                variant="ghost"
                className="h-9 px-4 text-xs"
                disabled={pendiente}
                onClick={() => setRechazarOpen(true)}
              >
                Rechazar
              </Button>
            </>
          ) : null}
          {cot.estado === 'RECHAZADA_INTERNA' ? (
            <Button
              className="h-9 px-4 text-xs"
              disabled={pendiente}
              onClick={() => reabrirMut.mutate(id)}
            >
              Reabrir para editar
            </Button>
          ) : null}
          {cot.estado === 'APROBADA' ? (
            <>
              <Button
                className="h-9 px-4 text-xs"
                disabled={pendiente}
                onClick={() => estadoMut.mutate({ id, estado: 'COBRADA' })}
              >
                Marcar cobrada
              </Button>
              <Button
                variant="ghost"
                className="h-9 px-4 text-xs"
                disabled={pendiente}
                onClick={() => estadoMut.mutate({ id, estado: 'RECHAZADA' })}
              >
                Rechazar
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <main className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Banner de aprobación */}
          {cot.estado === 'PENDIENTE_APROBACION_INTERNA' ? (
            <Banner tone="warn">
              Requiere aprobación del administrador por <strong>{cot.motivoAprobacion}</strong>.{' '}
              {isAdmin ? 'Revísala y aprueba o recházala.' : 'Esperando al administrador.'}
            </Banner>
          ) : null}
          {cot.estado === 'RECHAZADA_INTERNA' ? (
            <Banner tone="danger">
              Rechazada en aprobación interna
              {rechazo?.motivo ? `: ${rechazo.motivo}` : ''}. Reábrela para corregir y reenviar.
            </Banner>
          ) : null}

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
              <dl className="w-60 space-y-1.5 font-mono text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="text-navy-800">{formatMoney(bruto)}</dd>
                </div>
                {descuentoTotal > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Descuento</dt>
                    <dd className="text-red-600">−{formatMoney(descuentoTotal)}</dd>
                  </div>
                ) : null}
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

      <Modal
        open={rechazarOpen}
        title="Rechazar cotización"
        subtitle={cot.folio}
        onClose={() => setRechazarOpen(false)}
      >
        <div className="space-y-4">
          <Textarea
            rows={3}
            placeholder="Motivo del rechazo (opcional)…"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="h-10 px-4" onClick={() => setRechazarOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="h-10 px-4"
              disabled={pendiente}
              onClick={() =>
                rechazarMut.mutate(
                  { id, motivo: motivo || undefined },
                  {
                    onSuccess: () => {
                      setRechazarOpen(false);
                      setMotivo('');
                    },
                  },
                )
              }
            >
              Confirmar rechazo
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Banner({ tone, children }: { tone: 'warn' | 'danger'; children: ReactNode }) {
  const cls =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-red-200 bg-red-50 text-red-700';
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
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
