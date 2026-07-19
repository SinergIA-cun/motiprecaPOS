import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { useDashboard } from './hooks';

const dateFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

/** Días restantes de vigencia (0 = vence hoy). */
function diasRestantes(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useDashboard();

  return (
    <>
      <PageHeader
        title="Dashboard"
        crumb="Resumen"
        right={
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-400">
            {data?.alcance === 'global' ? 'Todas las sucursales' : 'Mis cotizaciones'}
          </span>
        }
      />

      <main className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-navy-400">
              Bienvenido
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-navy-900">
              {user?.nombre}
            </h2>
          </div>

          {isLoading || !data ? (
            <p className="text-sm text-slate-400">Cargando indicadores…</p>
          ) : (
            <>
              {/* Los tres números del día */}
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Metrica
                  label="Por vencer"
                  valor={String(data.porVencer.cantidad)}
                  pie={`Cotizaciones que vencen en ${data.porVencer.dias} días`}
                  alerta={data.porVencer.cantidad > 0}
                  onClick={() => navigate('/cotizaciones')}
                />
                <Metrica
                  label="Cerradas este mes"
                  valor={String(data.cerradas.mes)}
                  pie={`${data.cerradas.mesPrevio} el mes pasado`}
                  variacion={data.cerradas.variacionPct}
                />
                <Metrica
                  label="Ventas del mes"
                  valor={formatMoney(data.ventas.montoMes)}
                  pie={`${data.ventas.operacionesMes} operaciones · ${formatMoney(
                    data.ventas.montoMesPrevio,
                  )} el mes pasado`}
                  variacion={data.ventas.variacionPct}
                />
              </section>

              {/* Cotizaciones que urgen */}
              {data.porVencer.lista.length > 0 ? (
                <Panel
                  titulo="Vencen pronto"
                  accion={{ texto: 'Ver todas', onClick: () => navigate('/cotizaciones') }}
                >
                  <ul className="divide-y divide-slate-100">
                    {data.porVencer.lista.map((c) => {
                      const dias = diasRestantes(c.vigenciaHasta);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => navigate(`/cotizaciones/${c.id}`)}
                            className="flex w-full items-center gap-4 px-5 py-3 text-left text-sm transition-colors hover:bg-paper"
                          >
                            <span className="font-mono text-xs font-medium text-navy-700">
                              {c.folio}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-navy-900">
                              {c.cliente.nombre}
                            </span>
                            <span className="font-mono text-slate-600">{formatMoney(c.total)}</span>
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-wide',
                                dias <= 2 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700',
                              )}
                            >
                              {dias === 0 ? 'vence hoy' : `${dias} d`}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
              ) : null}

              {/* Rankings del año */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Panel titulo="Top 5 clientes del año">
                  {data.topClientes.length === 0 ? (
                    <Vacio>Aún no hay ventas este año.</Vacio>
                  ) : (
                    <ol className="divide-y divide-slate-100">
                      {data.topClientes.map((c, i) => (
                        <li
                          key={c.clienteId ?? `mostrador-${i}`}
                          className="flex items-center gap-3 px-5 py-3 text-sm"
                        >
                          <Rank n={i + 1} />
                          <span className="min-w-0 flex-1 truncate text-navy-900">{c.nombre}</span>
                          <span className="shrink-0 text-right">
                            <span className="block font-mono text-navy-800">
                              {formatMoney(c.total)}
                            </span>
                            <span className="block text-[0.68rem] text-slate-400">
                              {c.operaciones} {c.operaciones === 1 ? 'venta' : 'ventas'}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Panel>

                <Panel titulo="Top 5 ventas del año">
                  {data.topVentas.length === 0 ? (
                    <Vacio>Aún no hay ventas este año.</Vacio>
                  ) : (
                    <ol className="divide-y divide-slate-100">
                      {data.topVentas.map((v, i) => (
                        <li key={v.id}>
                          <button
                            type="button"
                            onClick={() => navigate(`/ventas/${v.id}/ticket`)}
                            className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition-colors hover:bg-paper"
                          >
                            <Rank n={i + 1} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-navy-900">
                                {v.cliente?.nombre ?? 'Mostrador'}
                              </span>
                              <span className="block font-mono text-[0.68rem] text-slate-400">
                                {v.folio} · {fmtDate(v.createdAt)}
                              </span>
                            </span>
                            <span className="shrink-0 font-mono text-navy-800">
                              {formatMoney(v.total)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </Panel>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function Metrica({
  label,
  valor,
  pie,
  variacion,
  alerta,
  onClick,
}: {
  label: string;
  valor: string;
  pie: string;
  variacion?: number | null;
  alerta?: boolean;
  onClick?: () => void;
}) {
  const contenido = (
    <>
      <div className="flex items-center gap-2">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        {alerta ? <AlertTriangle size={13} className="text-amber-500" strokeWidth={2.2} /> : null}
      </div>
      <p className="mt-1.5 font-display text-3xl font-bold tracking-tight text-navy-900">{valor}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {variacion !== undefined && variacion !== null ? <Variacion pct={variacion} /> : null}
        <p className="text-xs text-slate-500">{pie}</p>
      </div>
    </>
  );

  const clases = cn(
    'rounded-xl border bg-white p-5 text-left transition-colors',
    alerta ? 'border-amber-200' : 'border-slate-200',
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(clases, 'hover:border-navy-300')}>
        {contenido}
      </button>
    );
  }
  return <div className={clases}>{contenido}</div>;
}

/** Comparativo contra el mes pasado. */
function Variacion({ pct }: { pct: number }) {
  const sube = pct >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[0.65rem] font-medium',
        sube ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
      )}
    >
      {sube ? (
        <ArrowUpRight size={11} strokeWidth={2.5} />
      ) : (
        <ArrowDownRight size={11} strokeWidth={2.5} />
      )}
      {sube ? '+' : ''}
      {pct}%
    </span>
  );
}

function Panel({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: { texto: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-paper px-5 py-3">
        <h3 className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
          {titulo}
        </h3>
        {accion ? (
          <button
            type="button"
            onClick={accion.onClick}
            className="flex items-center gap-1 text-xs font-medium text-navy-600 transition-colors hover:text-navy-800"
          >
            {accion.texto}
            <ArrowRight size={13} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span className="grid h-6 w-6 flex-none place-items-center rounded bg-navy-50 font-mono text-[0.65rem] font-bold text-navy-700">
      {n}
    </span>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-slate-400">{children}</p>;
}
