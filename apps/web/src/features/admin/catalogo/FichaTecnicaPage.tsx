import { useState, type ReactNode } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { ApiError, type ResultadoFicha } from '../../../lib/api';
import { useImportarFicha } from '../../productos/hooks';

const EJEMPLO = `codigo,familia,dimensiones_cm,superficie_m2,peso_kg,piezas_por_m2
CEL-013,Vibrocomprimida,30 x 30 x 10,0.0909,10.6,11
CEL-014,Vibrocomprimida,25 x 25 x 10,0.0625,7.08,16`;

/** Nombre legible de cada columna, para el aviso de "esto cargué". */
const NOMBRE_COLUMNA: Record<string, string> = {
  piezas_por_m2: 'piezas por m²',
  familia: 'familia',
  dimensiones_cm: 'dimensiones',
  superficie_m2: 'superficie',
  peso_kg: 'peso',
};

/**
 * Carga masiva de la ficha técnica desde CSV.
 *
 * Son los cinco datos que Alegra no puede guardar. Solo actualiza productos que
 * ya existen, buscándolos por código: el catálogo es de Alegra. Siempre se
 * puede revisar antes de escribir.
 */
export function FichaTecnicaPage() {
  const [csv, setCsv] = useState('');
  const [resultado, setResultado] = useState<ResultadoFicha | null>(null);
  const mut = useImportarFicha();

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
      <PageHeader title="Ficha técnica" crumb="Catálogo" />

      <main className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-base font-bold text-navy-900">
              Los datos que Alegra no guarda
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Alegra manda en nombre, código, unidad y precio. Estos cinco son de Motipos y se
              cargan aquí. Se busca cada producto por su <strong>código</strong>:{' '}
              <strong>no se crean productos ni se tocan precios</strong>.
            </p>

            <dl className="mt-4 space-y-2">
              <Columna nombre="piezas_por_m2">
                Cuántas piezas cubren 1 m². Con este dato el cotizador y el punto de venta permiten
                capturar la cantidad en m² y calculan las piezas solas.
              </Columna>
              <Columna nombre="familia">
                Agrupación propia, ej. <em>Vibrocomprimida</em> o <em>Concreto</em>. Va aparte de la
                categoría porque esa viene de Alegra y se sobreescribe en cada sincronización.
              </Columna>
              <Columna nombre="dimensiones_cm">
                Medidas del catálogo tal cual, ej. <code className="font-mono">30 x 30 x 10</code>.
              </Columna>
              <Columna nombre="superficie_m2">
                Lo que cubre una sola pieza. Se coteja contra las dimensiones y se avisa si no
                cuadran.
              </Columna>
              <Columna nombre="peso_kg">
                Peso de una pieza, para calcular la carga del camión.
              </Columna>
            </dl>

            <div className="mt-4 rounded-lg border border-slate-200 bg-paper px-3 py-2.5 text-xs text-slate-600">
              La columna <code className="font-mono">codigo</code> es obligatoria; de las demás
              basta una. Las que no reconozca las ignora, así que puedes pegar la plantilla
              completa. No importan mayúsculas ni acentos en los encabezados. Una{' '}
              <strong>celda vacía se omite</strong>: no borra lo que ya había.
            </div>
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

function Columna({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 pt-px font-mono text-[0.68rem] text-navy-700">{nombre}</dt>
      <dd className="text-xs text-slate-600">{children}</dd>
    </div>
  );
}

function Resumen({ resultado }: { resultado: ResultadoFicha }) {
  const columnas = resultado.columnasLeidas.map((c) => NOMBRE_COLUMNA[c] ?? c).join(', ');

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
        <p className="mt-1 text-xs opacity-80">Columnas leídas: {columnas}.</p>
      </div>

      {resultado.discrepancias.length > 0 ? (
        <Lista titulo="Revisa estos datos antes de confiar en ellos" tono="warn">
          {resultado.discrepancias.map((d) => (
            <li key={d.codigo} className="text-xs">
              <span className="font-mono text-navy-800">{d.codigo}</span>: mide{' '}
              <strong>{d.dimensiones}</strong>, que dan {d.superficieSegunMedidas} m², pero el CSV
              declara <strong>{d.superficieDeclarada} m²</strong> ({d.diferenciaPct}% de
              diferencia).
            </li>
          ))}
          <li className="mt-1.5 text-xs text-slate-500">
            En piezas no rectangulares (hexagonal, círculo, cisne) la diferencia es normal: cubren
            menos que su rectángulo. En una pieza cuadrada casi siempre es un error de dedo, y una
            equivalencia mal cargada hace cotizar piezas de más sin que nadie lo note hasta la obra.
          </li>
        </Lista>
      ) : null}

      {resultado.actualizados.length > 0 ? (
        <Lista titulo={resultado.simulacion ? 'Se actualizarían' : 'Actualizados'}>
          {resultado.actualizados.map((a) => (
            <li key={a.codigo} className="text-xs">
              <span className="font-mono font-medium text-navy-800">{a.codigo}</span>{' '}
              <span className="text-slate-600">
                {a.cambios
                  .map((c) => `${c.etiqueta}: ${c.anterior ?? '—'} → ${c.nuevo}`)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </Lista>
      ) : null}

      {resultado.noEncontrados.length > 0 ? (
        <Lista titulo="No existen en el catálogo" tono="warn">
          <li className="font-mono text-xs">{resultado.noEncontrados.join(', ')}</li>
          <li className="mt-1 text-xs text-slate-500">
            Revisa el código: tiene que ser el mismo que en Alegra, no el de tu hoja de cálculo. Si
            el producto ya existe allá, sincroniza primero.
          </li>
        </Lista>
      ) : null}

      {resultado.invalidos.length > 0 ? (
        <Lista titulo="Valores inválidos" tono="warn">
          {resultado.invalidos.map((i) => (
            <li key={`${i.codigo}-${i.columna}`} className="text-xs">
              <span className="font-mono text-navy-800">{i.codigo}</span> ·{' '}
              {NOMBRE_COLUMNA[i.columna] ?? i.columna}: “{i.valor}” — {i.motivo}
            </li>
          ))}
        </Lista>
      ) : null}

      {resultado.yaEnM2.length > 0 ? (
        <Lista titulo="Su equivalencia se descarta (el resto de la ficha, no)" tono="warn">
          <li className="font-mono text-xs">{resultado.yaEnM2.join(', ')}</li>
          <li className="mt-1 text-xs text-slate-500">
            Estos productos ya se venden por m²: su cantidad es superficie y su precio es por m²,
            así que no necesitan conversión a piezas. Familia, medidas, superficie y peso sí se
            toman.
          </li>
        </Lista>
      ) : null}

      {resultado.sinCambio.length > 0 ? (
        <Lista titulo="Ya tenían estos datos (sin cambio)">
          <li className="font-mono text-xs text-slate-500">{resultado.sinCambio.join(', ')}</li>
        </Lista>
      ) : null}

      {resultado.sinDatos.length > 0 ? (
        <Lista titulo="Su fila venía vacía (omitidos)">
          <li className="font-mono text-xs text-slate-500">{resultado.sinDatos.join(', ')}</li>
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
