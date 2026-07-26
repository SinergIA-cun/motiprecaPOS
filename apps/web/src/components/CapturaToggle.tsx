import type { UnidadCaptura } from '../lib/api';

interface Props {
  value: UnidadCaptura;
  onChange: (v: UnidadCaptura) => void;
  /** Etiqueta de la unidad propia del producto (pza, ml…). */
  etiquetaPza: string;
  disabled?: boolean;
}

/**
 * Selector piezas ↔ m² de una partida. Solo se muestra cuando el producto tiene
 * equivalencia cargada: si no la tiene, no hay nada que elegir.
 */
export function CapturaToggle({ value, onChange, etiquetaPza, disabled }: Props) {
  return (
    <div
      role="group"
      aria-label="Unidad de captura"
      className="inline-flex overflow-hidden rounded-md border border-slate-200"
    >
      <Opcion
        activo={value === 'PZA'}
        disabled={disabled}
        onClick={() => onChange('PZA')}
        label={etiquetaPza}
      />
      <Opcion
        activo={value === 'M2'}
        disabled={disabled}
        onClick={() => onChange('M2')}
        label="m²"
      />
    </div>
  );
}

function Opcion({
  activo,
  label,
  onClick,
  disabled,
}: {
  activo: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      disabled={disabled}
      onClick={onClick}
      className={`px-2 py-1 font-mono text-[0.62rem] uppercase tracking-wide transition-colors ${
        activo
          ? 'bg-navy-700 text-white'
          : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-navy-700'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  );
}
