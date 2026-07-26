import { useState, type ReactNode } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { ApiError, type ResultadoEquivalencias } from '../../../lib/api';
import { useImportarEquivalencias } from '../../productos/hooks';

const EJEMPLO = `codigo,nombre,familia,piezas_por_m2,unidad,PRECIO_POR_M2
CEL-AMAIA-VIB,Celosía Amaia Vibro,Vibrocomprimida,11,M2,
CEL-BACALAR-VIB,Celosía Bacalar Vibro,Vibrocomprimida,25,M2,`;

/**
 * Carga masiva de "piezas por m²" desde CSV.
 *
 * Solo actualiza productos que ya existen, buscándolos por código: el catálogo
 * es de Alegra y la equivalencia es el único dato que Alegra no puede guardar.
 * Siempre se puede revisar antes de escribir.
 */
export function EquivalenciasPage() {
  const [csv, setCsv] = useState('');
  const [resultado, setResultado] = useState<ResultadoEquivalencias | null>(null);
  const mut = useImportarEquivalencias();

  const errorMessage = mut.error instanceof ApiError ? mut.error.message : undefined;

  function ejecutar(simular: boolean) {
    mut.mutate({ csv, simular }, { onSuccess: setResultado });
  }

  function limpiar() {
    setCsv('');
    setResultado(null);
    mut.reset();
  }

  return (
    <>
      <PageHeader title="Equivalencias m²" crumb="Catálogo" />

      <main className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-base font-bold text-navy-900">
              Cuántas piezas cubren 1 m²
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Con este dato el cotizador y el punto de venta permiten capturar la cantidad en m² y
              calculan las piezas solas. Se busca cada producto por su <strong>código</strong> y
              solo se actualiza la equivalencia:{' '}
              <strong>no se crean productos ni se tocan precios</strong>, porque el catálogo viene
              de Alegra.
            </p>

            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Dato termino="Columnas requeridas">
                <code className="font-mono text-xs">codigo</code> y{' '}
                <code className="font-mono text-xs">piezas_por_m2</code>
              </Dato>
              <Dato termino="Columnas extra">
                Se ignoran, así que puedes pegar la plantilla completa del catálogo
              </Dato>
              <Dato termino="Filas sin equivalencia">Se omiten, no borran lo que ya había</Dato>
              <Dato termino="Encabezados">
                No importan mayúsculas ni acentos: <code className="font-mono text-xs">PIEZAS</code>
                , <code className="font-mono text-xs">piezas por m²</code> y{' '}
                <code className="font-mono text-xs">piezas_por_m2</code> son lo mismo
              </Dato>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <label
              htmlFor="csv"
              className="mb-1.5 block text-sm font-semibold tracking-tight text-slate-700"
            >
              Pega el CSV
            </label>
            <Textarea
              id="csv"
              rows={12}
              className="font-mono text-xs"
              placeholder={EJEMPLO}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />

            {errorMessage ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {csv || resultado ? (
                <Button variant="ghost" className="h-10 px-4" onClick={limpiar}>
                  Limpiar
                </Button>
              ) : null}
              <Button
                variant="ghost"
                className="h-10 px-4"
                disabled={!csv.trim() || mut.isPending}
                onClick={() => ejecutar(true)}
              >
                {mut.isPending ? 'Revisando…' : 'Revisar sin aplicar'}
              </Button>
              <Button
                className="h-10 px-4"
                disabled={!csv.trim() || mut.isPending}
                onClick={() => ejecutar(false)}
              >
                {mut.isPending ? 'Aplicando…' : 'Aplicar'}
              </Button>
            </div>
          </section>

          {resultado ? <Resumen resultado={resultado} /> : null}
        </div>
      </main>
    </>
  );
}

function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-paper px-3 py-2.5">
      <dt className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">
        {termino}
      </dt>
      <dd className="mt-0.5 text-xs text-slate-600">{children}</dd>
    </div>
  );
}

function Resumen({ resultado }: { resultado: ResultadoEquivalencias }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
      <div
        className={`rounded-lg border px-3 py-2.5 text-sm ${
          resultado.simulacion
            ? 'border-navy-200 bg-navy-50 text-navy-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}
      >
        <strong>{resultado.simulacion ? 'Revisión' : 'Aplicado'}:</strong> {resultado.resumen}.
        {resultado.simulacion ? ' Nada se ha guardado todavía.' : null}
      </div>

      {resultado.actualizados.length > 0 ? (
        <Lista titulo={resultado.simulacion ? 'Se actualizarían' : 'Actualizados'}>
          {resultado.actualizados.map((a) => (
            <li key={a.codigo} className="font-mono text-xs">
              {a.codigo}: {a.anterior ?? '—'} → <strong>{a.piezasPorM2}</strong> pz/m²
            </li>
          ))}
        </Lista>
      ) : null}

      {resultado.noEncontrados.length > 0 ? (
        <Lista titulo="No existen en el catálogo" tono="warn">
          <li className="font-mono text-xs">{resultado.noEncontrados.join(', ')}</li>
          <li className="mt-1 text-xs text-slate-500">
            Revisa el código, o sincroniza con Alegra si el producto ya está allá.
          </li>
        </Lista>
      ) : null}

      {resultado.yaEnM2.length > 0 ? (
        <Lista titulo="Su unidad ya es m² (no aplica)" tono="warn">
          <li className="font-mono text-xs">{resultado.yaEnM2.join(', ')}</li>
          <li className="mt-1 text-xs text-slate-500">
            Su cantidad ya es superficie y su precio es por m², así que no necesitan conversión.
          </li>
        </Lista>
      ) : null}

      {resultado.invalidos.length > 0 ? (
        <Lista titulo="Valores inválidos" tono="warn">
          {resultado.invalidos.map((i) => (
            <li key={i.codigo} className="font-mono text-xs">
              {i.codigo}: “{i.valor}” — {i.motivo}
            </li>
          ))}
        </Lista>
      ) : null}

      {resultado.omitidos.length > 0 ? (
        <Lista titulo="Sin equivalencia en el CSV (omitidos)">
          <li className="font-mono text-xs text-slate-500">{resultado.omitidos.join(', ')}</li>
        </Lista>
      ) : null}
    </section>
  );
}

function Lista({ titulo, tono, children }: { titulo: string; tono?: 'warn'; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">
        {titulo}
      </p>
      <ul
        className={`max-h-56 space-y-0.5 overflow-auto rounded-lg border p-2.5 ${
          tono === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-paper'
        }`}
      >
        {children}
      </ul>
    </div>
  );
}
