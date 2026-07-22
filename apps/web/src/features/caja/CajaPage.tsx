import { ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { formatMoney } from '../../lib/format';
import { useCajaAccesos, useCajaEfectivo } from './hooks';

const dateFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDateTime = (iso: string) => dateFmt.format(new Date(iso));

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
function fmtMes(mes: string): string {
  const [year, month] = mes.split('-');
  const idx = Number(month) - 1;
  return `${MESES[idx] ?? month} ${year}`;
}

export function CajaPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useCajaEfectivo();
  const [bitacoraAbierta, setBitacoraAbierta] = useState(false);
  const { data: accesos, isLoading: accesosLoading } = useCajaAccesos(bitacoraAbierta);

  return (
    <>
      <PageHeader title="Caja en efectivo" crumb="Administración" />
      <main className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Nota honesta: qué es este módulo y qué NO es. */}
          <div className="flex gap-3 rounded-xl border border-navy-100 bg-navy-50/60 px-4 py-3 text-sm text-navy-800">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-navy-500" strokeWidth={1.75} />
            <p className="leading-relaxed">
              Registro interno del <strong>efectivo cobrado sin factura</strong> por sucursal. Es un
              registro <strong>auditable</strong>: sólo lo ve el Administrador y{' '}
              <strong>cada consulta queda en la bitácora de accesos</strong>. No es un módulo
              oculto.
            </p>
          </div>

          {isLoading || !data ? (
            <p className="text-sm text-slate-400">Cargando…</p>
          ) : (
            <>
              {/* Total general */}
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">
                  Total en efectivo sin factura
                </p>
                <p className="mt-1 font-display text-3xl font-bold text-navy-900">
                  {formatMoney(data.totalGeneral)}
                </p>
              </section>

              {/* Resumen por sucursal / mes */}
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-paper px-5 py-3">
                  <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
                    Resumen por sucursal y mes
                  </h2>
                </div>
                {data.resumen.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400">
                    Aún no hay cobros en efectivo sin factura.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400">
                        <Th>Sucursal</Th>
                        <Th>Mes</Th>
                        <Th className="text-right">Ventas</Th>
                        <Th className="text-right">Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.resumen.map((g) => (
                        <tr
                          key={`${g.sucursal}-${g.mes}`}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-5 py-3 text-navy-900">{g.sucursal}</td>
                          <td className="px-3 py-3 capitalize text-slate-600">{fmtMes(g.mes)}</td>
                          <td className="px-3 py-3 text-right font-mono text-slate-600">
                            {g.count}
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-navy-800">
                            {formatMoney(g.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Movimientos */}
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-paper px-5 py-3">
                  <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
                    Movimientos
                  </h2>
                </div>
                {data.movimientos.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400">Sin movimientos.</p>
                ) : (
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400">
                        <Th>Folio</Th>
                        <Th>Fecha</Th>
                        <Th>Sucursal</Th>
                        <Th>Cliente</Th>
                        <Th className="text-right">Efectivo</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.movimientos.map((m) => (
                        <tr
                          key={m.id}
                          className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-paper"
                          onClick={() => navigate(`/ventas/${m.id}/ticket`)}
                        >
                          <td className="px-5 py-3 font-mono text-navy-900">{m.folio}</td>
                          <td className="px-3 py-3 text-slate-600">{fmtDateTime(m.createdAt)}</td>
                          <td className="px-3 py-3 text-slate-600">{m.sucursal}</td>
                          <td className="px-3 py-3 text-slate-600">{m.cliente ?? '—'}</td>
                          <td className="px-5 py-3 text-right font-mono text-navy-800">
                            {formatMoney(m.efectivo)}
                            {m.totalVenta > m.efectivo ? (
                              <span className="block text-[0.68rem] font-normal text-slate-400">
                                de {formatMoney(m.totalVenta)} venta
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Bitácora de accesos (transparencia) */}
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
                      Bitácora de accesos
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Quién consultó esta sección, cuándo y desde qué IP.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-9 px-4 text-xs"
                    onClick={() => setBitacoraAbierta((v) => !v)}
                  >
                    {bitacoraAbierta ? 'Ocultar' : 'Ver bitácora'}
                  </Button>
                </div>
                {bitacoraAbierta ? (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {accesosLoading || !accesos ? (
                      <p className="text-sm text-slate-400">Cargando…</p>
                    ) : (
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400">
                            <Th>Fecha</Th>
                            <Th>Usuario</Th>
                            <Th>IP</Th>
                            <Th>Sección</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {accesos.map((a) => (
                            <tr key={a.id} className="border-b border-slate-100 last:border-0">
                              <td className="px-5 py-2.5 text-slate-600">
                                {fmtDateTime(a.createdAt)}
                              </td>
                              <td className="px-3 py-2.5 text-navy-900">{a.usuario}</td>
                              <td className="px-3 py-2.5 font-mono text-slate-500">
                                {a.ip ?? '—'}
                              </td>
                              <td className="px-3 py-2.5 text-slate-500">{a.ruta}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : null}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-5 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${className}`}>
      {children}
    </th>
  );
}
