import { Plus, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { CotizacionesFilter, EstadoCotizacion } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { ESTADO_LABEL, ESTADO_TONE } from './estado';
import { useCotizaciones } from './hooks';

const dateFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

export function CotizacionesPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CotizacionesFilter>({});
  const { data: cotizaciones, isLoading, isError } = useCotizaciones(filter);

  return (
    <>
      <PageHeader
        title="Cotizaciones"
        crumb="Ventas"
        right={
          <Button className="h-10 px-4" onClick={() => navigate('/cotizaciones/nueva')}>
            <Plus size={16} strokeWidth={2.5} className="mr-2" />
            Nueva cotización
          </Button>
        }
      />

      <main className="flex-1 px-8 py-8">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative max-w-xs flex-1">
            <Search
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              type="search"
              placeholder="Buscar por folio…"
              className="h-10 pl-10 text-sm"
              value={filter.q ?? ''}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))}
            />
          </div>
          <Select
            aria-label="Filtrar por estado"
            className="h-10 w-auto min-w-44 text-sm"
            value={filter.estado ?? ''}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                estado: e.target.value ? (e.target.value as EstadoCotizacion) : undefined,
              }))
            }
          >
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_LABEL) as EstadoCotizacion[]).map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABEL[e]}
              </option>
            ))}
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-paper">
                <Th>Folio</Th>
                <Th>Cliente</Th>
                <Th>Fecha</Th>
                <Th className="text-right">Total</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <RowMessage>Cargando…</RowMessage>
              ) : isError ? (
                <RowMessage>No se pudieron cargar las cotizaciones.</RowMessage>
              ) : cotizaciones && cotizaciones.length > 0 ? (
                cotizaciones.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/cotizaciones/${c.id}`)}
                    className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-navy-50/40"
                  >
                    <Td>
                      <span className="font-mono text-xs font-medium text-navy-700">{c.folio}</span>
                    </Td>
                    <Td>
                      <span className="font-medium text-navy-900">{c.cliente.nombre}</span>
                    </Td>
                    <Td>
                      <span className="text-slate-500">{fmtDate(c.createdAt)}</span>
                    </Td>
                    <Td className="text-right">
                      <span className="font-mono text-sm text-navy-800">
                        {formatMoney(c.total)}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={ESTADO_TONE[c.estado]}>{ESTADO_LABEL[c.estado]}</Badge>
                    </Td>
                  </tr>
                ))
              ) : (
                <RowMessage>
                  {filter.q || filter.estado
                    ? 'Ninguna cotización coincide.'
                    : 'Aún no hay cotizaciones. Crea la primera.'}
                </RowMessage>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`px-5 py-3 font-mono text-[0.6rem] font-medium uppercase tracking-[0.14em] text-slate-400 ${className ?? ''}`}
    >
      {children}
    </th>
  );
}
function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-3.5 align-middle ${className ?? ''}`}>{children}</td>;
}
function RowMessage({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}
