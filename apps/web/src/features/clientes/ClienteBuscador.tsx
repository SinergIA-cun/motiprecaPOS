import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Input } from '../../components/ui/Input';
import { useDebounce } from '../../hooks/useDebounce';
import { clientesApi, type Cliente } from '../../lib/api';
import { formatTelefono } from '../../lib/format';

type Props = {
  /** Id del cliente seleccionado ('' si ninguno). */
  value: string;
  /** Nombre del cliente ya seleccionado (modo edición). */
  initialLabel?: string;
  onSelect: (cliente: Cliente | null) => void;
};

const MAX_RESULTS = 30;
const MIN_LETRAS = 2;

/**
 * Buscador de cliente con búsqueda en servidor (nombre, RFC, teléfono, correo).
 * Pensado para celular: un solo input, resultados tocables y sin listar los
 * cientos de clientes. Al elegir uno queda fijo hasta que se toque "cambiar".
 */
export function ClienteBuscador({ value, initialLabel, onSelect }: Props) {
  const [label, setLabel] = useState(initialLabel ?? '');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | undefined>(undefined);

  const debounced = useDebounce(query.trim(), 250);
  // Solo busca con 2+ letras: evita traer 200 clientes en el primer foco.
  const activo = debounced.length >= MIN_LETRAS;
  const { data, isFetching } = useQuery({
    queryKey: ['clientes', 'buscar', debounced],
    queryFn: () => clientesApi.list({ q: debounced, activo: true }),
    enabled: activo,
  });
  const resultados = (data ?? []).slice(0, MAX_RESULTS);

  function elegir(c: Cliente) {
    setLabel(c.nombre);
    setQuery('');
    setOpen(false);
    onSelect(c);
  }

  function cambiar() {
    setLabel('');
    setQuery('');
    onSelect(null);
    setOpen(true);
  }

  // Cliente ya elegido: caja compacta con nombre y botón para cambiar.
  if (value && label) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-navy-200 bg-navy-50/50 px-3 py-2.5">
        <span className="min-w-0 truncate text-sm font-medium text-navy-900">{label}</span>
        <button
          type="button"
          onClick={cambiar}
          aria-label="Cambiar cliente"
          className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-white hover:text-navy-700"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search
        size={16}
        strokeWidth={2}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <Input
        type="search"
        aria-label="Buscar cliente"
        placeholder="Buscar por nombre, RFC o teléfono…"
        className="h-11 pl-10 text-sm"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter') {
            const first = resultados[0];
            if (first) {
              e.preventDefault();
              elegir(first);
            }
          }
        }}
      />
      {open ? (
        <div
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          // Evita que el blur cierre el panel antes de registrar el toque.
          onMouseDown={() => blurTimer.current && window.clearTimeout(blurTimer.current)}
        >
          {!activo ? (
            <p className="px-4 py-3 text-sm text-slate-400">
              Escribe al menos {MIN_LETRAS} letras para buscar.
            </p>
          ) : resultados.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">
              {isFetching ? 'Buscando…' : 'Sin resultados'}
            </p>
          ) : (
            <ul className="max-h-72 overflow-auto py-1">
              {resultados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => elegir(c)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-navy-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-navy-900">{c.nombre}</span>
                      <span className="block font-mono text-[0.68rem] text-slate-400">
                        {c.rfc ?? 'Sin RFC'}
                        {c.telefono ? ` · ${formatTelefono(c.telefono)}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-wide text-slate-400">
                      {c.tipo === 'EMPRESA' ? 'Empresa' : 'Individual'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
