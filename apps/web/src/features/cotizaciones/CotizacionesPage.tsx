import { Plus, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import type { CotizacionesFilter, EstadoCotizacion } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { ESTADO_LABEL, ESTADO_TONE, ETAPA_LABEL } from './estado';
import { useAsesores, useCotizaciones } from './hooks';

const dateFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

/** Roles que pueden filtrar por vendedor (plan §11: gerencia ve todo). */
const ROLES_VE_VENDEDORES = ['JEFE_DEPARTAMENTO', 'GERENTE', 'ADMINISTRADOR'];

/** Etapas del pipeline en orden operativo para los chips. */
const ETAPAS_CHIPS: EstadoCotizacion[] = [
  'ABIERTA',
  'PENDIENTE_APROBACION_INTERNA',
  'APROBADA',
  'COBRADA',
  'RECHAZADA_INTERNA',
  'RECHAZADA',
  'EXPIRADA',
];

export function CotizacionesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const veVendedores = ROLES_VE_VENDEDORES.includes(user?.rol ?? '');

  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<EstadoCotizacion | undefined>(undefined);
  const [asesorId, setAsesorId] = useState<string | undefined>(undefined);
  const q = useDebounce(busqueda.trim(), 300);

  const filter: CotizacionesFilter = { q: q || undefined, estado, asesorId };
  const { data: cotizaciones, isLoading, isError } = useCotizaciones(filter);
  const { data: asesores } = useAsesores();

  const hayFiltro = Boolean(q || estado || asesorId);

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
        {/* Búsqueda amplia + vendedor */}
        <div className="mb-3 flex flex-wrap gap-3">
          <div className="relative max-w-md flex-1">
            <Search
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              type="search"
              placeholder="Buscar por folio, cliente, RFC o producto…"
              className="h-10 pl-10 text-sm"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          {veVendedores ? (
            <Select
              aria-label="Filtrar por vendedor"
              className="h-10 w-auto min-w-48 text-sm"
              value={asesorId ?? ''}
              onChange={(e) => setAsesorId(e.target.value || undefined)}
            >
              <option value="">Todos los vendedores</option>
              {(asesores ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        {/* Chips por etapa */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Chip active={!estado} onClick={() => setEstado(undefined)}>
            Todas
          </Chip>
          {ETAPAS_CHIPS.map((e) => (
            <Chip key={e} active={estado === e} onClick={() => setEstado(e)}>
              {ESTADO_LABEL[e]}
            </Chip>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-paper">
                <Th>Folio</Th>
                <Th>Cliente</Th>
                <Th>Vendedor</Th>
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
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="grid h-6 w-6 flex-none place-items-center rounded bg-navy-50 font-mono text-[0.6rem] font-bold text-navy-700">
                          {c.asesor.iniciales}
                        </span>
                        {c.asesor.nombre}
                      </span>
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
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={ESTADO_TONE[c.estado]}>{ESTADO_LABEL[c.estado]}</Badge>
                        {c.estado === 'COBRADA' && c.etapaPedido ? (
                          <Badge tone="navy">{ETAPA_LABEL[c.etapaPedido]}</Badge>
                        ) : null}
                      </span>
                    </Td>
                  </tr>
                ))
              ) : (
                <RowMessage>
                  {hayFiltro
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-navy-700 bg-navy-700 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-navy-200 hover:text-navy-800',
      )}
    >
      {children}
    </button>
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
      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}
