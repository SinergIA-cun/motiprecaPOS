import { Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { Input } from '../../components/ui/Input';
import { useDebounce } from '../../hooks/useDebounce';
import type { Producto } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { UNIDAD_LABEL } from '../../lib/unidades';
import { useProductos } from '../productos/hooks';

type Props = {
  onSelect: (producto: Producto) => void;
};

const MAX_RESULTS = 30;

/** Buscador de productos con búsqueda en servidor (escala a miles de productos). */
export function ProductoPicker({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | undefined>(undefined);

  const debounced = useDebounce(query.trim(), 250);
  const { data: productos, isFetching } = useProductos({ q: debounced || undefined, activo: true });
  const resultados = (productos ?? []).slice(0, MAX_RESULTS);

  function handleSelect(p: Producto) {
    onSelect(p);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative max-w-md">
      <Search
        size={16}
        strokeWidth={2}
        className="pointer-events-none absolute left-3.5 top-[1.45rem] -translate-y-1/2 text-slate-400"
      />
      <Input
        type="search"
        aria-label="Buscar producto"
        placeholder="Buscar producto por código o nombre…"
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
              handleSelect(first);
            }
          }
        }}
      />
      {open ? (
        <div
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          // Evita que el blur cierre el panel antes de registrar el click.
          onMouseDown={() => blurTimer.current && window.clearTimeout(blurTimer.current)}
        >
          {resultados.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">
              {isFetching ? 'Buscando…' : 'Sin resultados'}
            </p>
          ) : (
            <ul className="max-h-72 overflow-auto py-1">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-navy-50"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-xs text-navy-600">{p.codigo}</span>
                      <span className="ml-2 text-sm text-navy-900">{p.nombre}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-500">
                      {formatMoney(p.precioBase)} / {UNIDAD_LABEL[p.unidad]}
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
