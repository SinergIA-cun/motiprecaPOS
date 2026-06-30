import { useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { ApiError, type ReglaAprobacion } from '../../../lib/api';
import { useReglaAprobacion, useUpdateReglaAprobacion } from '../../config/hooks';

export function ReglasAprobacionPage() {
  const { data: regla, isLoading } = useReglaAprobacion();

  return (
    <>
      <PageHeader title="Reglas de aprobación" crumb="Administración" />
      <main className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-xl space-y-6">
          <p className="text-sm leading-relaxed text-slate-600">
            Una cotización requiere aprobación del Administrador si alcanza{' '}
            <strong>cualquiera</strong> de estos umbrales (lógica O). Si no alcanza ninguno, se{' '}
            <strong>aprueba automáticamente</strong> al mandarla a aprobación. Deja un campo vacío
            para desactivar ese disparador.
          </p>
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            {isLoading || !regla ? (
              <p className="text-sm text-slate-400">Cargando…</p>
            ) : (
              <ReglaForm key={regla.id} regla={regla} />
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function ReglaForm({ regla }: { regla: ReglaAprobacion }) {
  const updateMut = useUpdateReglaAprobacion();
  const [descuento, setDescuento] = useState(
    regla.descuentoMinimo != null ? String(Number(regla.descuentoMinimo)) : '',
  );
  const [monto, setMonto] = useState(
    regla.montoMinimo != null ? String(Number(regla.montoMinimo)) : '',
  );
  const [saved, setSaved] = useState(false);

  const error = updateMut.error instanceof ApiError ? updateMut.error.message : undefined;

  function guardar() {
    setSaved(false);
    updateMut.mutate(
      {
        descuentoMinimo: descuento.trim() === '' ? null : Number(descuento),
        montoMinimo: monto.trim() === '' ? null : Number(monto),
      },
      { onSuccess: () => setSaved(true) },
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Descuento que requiere aprobación (%)" htmlFor="descuento">
        <Input
          id="descuento"
          type="number"
          min="0"
          max="100"
          step="1"
          className="font-mono"
          placeholder="vacío = desactivado"
          value={descuento}
          onChange={(e) => {
            setDescuento(e.target.value);
            setSaved(false);
          }}
        />
      </Field>
      <Field label="Monto total que requiere aprobación ($)" htmlFor="monto">
        <Input
          id="monto"
          type="number"
          min="0"
          step="100"
          className="font-mono"
          placeholder="vacío = desactivado"
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value);
            setSaved(false);
          }}
        />
      </Field>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button className="h-11" disabled={updateMut.isPending} onClick={guardar}>
          {updateMut.isPending ? 'Guardando…' : 'Guardar reglas'}
        </Button>
        {saved ? <span className="text-sm font-medium text-emerald-600">Guardado ✓</span> : null}
      </div>
    </div>
  );
}
