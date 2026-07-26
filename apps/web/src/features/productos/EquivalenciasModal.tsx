import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { ApiError, type ResultadoEquivalencias } from '../../lib/api';
import { useImportarEquivalencias } from './hooks';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Carga masiva de "piezas por m²" desde un CSV.
 *
 * Solo actualiza productos que ya existen (el catálogo es de Alegra); la
 * equivalencia es el único dato que Alegra no puede guardar. Siempre se simula
 * primero para que nadie descubra los errores después de escribir.
 */
export function EquivalenciasModal({ open, onClose }: Props) {
  const [csv, setCsv] = useState('');
  const [resultado, setResultado] = useState<ResultadoEquivalencias | null>(null);
  const mut = useImportarEquivalencias();

  const errorMessage = mut.error instanceof ApiError ? mut.error.message : undefined;

  function ejecutar(simular: boolean) {
    mut.mutate({ csv, simular }, { onSuccess: setResultado });
  }

  function cerrar() {
    setCsv('');
    setResultado(null);
    mut.reset();
    onClose();
  }

  const aplicado = resultado !== null && !resultado.simulacion;

  return (
    <Modal
      open={open}
      title="Cargar equivalencias por m²"
      subtitle="Pega el CSV con las columnas codigo y piezas_por_m2"
      onClose={cerrar}
    >
      <div className="space-y-4">
        <p className="rounded-lg border border-slate-200 bg-paper px-3 py-2.5 text-xs text-slate-600">
          Actualiza cuántas piezas cubren 1 m² buscando cada producto por su <strong>código</strong>
          . No crea productos: el catálogo viene de Alegra. Las filas sin equivalencia se omiten,
          así que puedes pegar la misma plantilla de precios aunque esté a medias.
        </p>

        <Textarea
          rows={8}
          className="font-mono text-xs"
          placeholder={'codigo,piezas_por_m2\nCEL-AMAIA-VIB,11\nADO-HUESITO,54'}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          disabled={aplicado}
        />

        {errorMessage ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {resultado ? <Resumen resultado={resultado} /> : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="h-10 px-4" onClick={cerrar}>
            {aplicado ? 'Listo' : 'Cancelar'}
          </Button>
          {!aplicado ? (
            <>
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
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function Resumen({ resultado }: { resultado: ResultadoEquivalencias }) {
  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg border px-3 py-2 text-sm ${
          resultado.simulacion
            ? 'border-navy-200 bg-navy-50 text-navy-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}
      >
        <strong>{resultado.simulacion ? 'Simulación' : 'Aplicado'}:</strong> {resultado.resumen}.
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
            Revisa el código o crea/sincroniza el producto primero.
          </li>
        </Lista>
      ) : null}

      {resultado.yaEnM2.length > 0 ? (
        <Lista titulo="Ya se venden por m² (no aplica)" tono="warn">
          <li className="font-mono text-xs">{resultado.yaEnM2.join(', ')}</li>
          <li className="mt-1 text-xs text-slate-500">
            Su cantidad ya es superficie y su precio es por m²; no necesitan equivalencia.
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
    </div>
  );
}

function Lista({
  titulo,
  tono,
  children,
}: {
  titulo: string;
  tono?: 'warn';
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">
        {titulo}
      </p>
      <ul
        className={`max-h-40 space-y-0.5 overflow-auto rounded-lg border p-2.5 ${
          tono === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-paper'
        }`}
      >
        {children}
      </ul>
    </div>
  );
}
