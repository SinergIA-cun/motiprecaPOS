import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { ApiError, type AlegraSyncResult } from '../../../lib/api';
import { useSyncAlegra } from '../../sync/hooks';

/**
 * Sincronización Alegra → Motipos (Fase 1.5).
 *
 * Alegra es la fuente de verdad de productos y clientes; aquí se jala lo que
 * haya cambiado. Lo que NO viene de Alegra (equivalencias m², línea de crédito,
 * sucursal, notas) no se toca.
 */
export function SincronizacionPage() {
  const syncMut = useSyncAlegra();
  const [resultado, setResultado] = useState<AlegraSyncResult | null>(null);

  function sincronizar() {
    setResultado(null);
    syncMut.mutate(undefined, {
      onSuccess: setResultado,
      onError: (error) =>
        setResultado({
          ok: false,
          error: error instanceof ApiError ? error.message : 'No se pudo conectar con el servidor.',
        }),
    });
  }

  return (
    <>
      <PageHeader title="Sincronización con Alegra" crumb="Catálogo" />

      <main className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-base font-bold text-navy-900">
              Traer productos y clientes de Alegra
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Alegra manda en el catálogo: nombre, código, precio y unidad de los productos, y los
              datos fiscales de los clientes. Lo que es nuestro —{' '}
              <strong>equivalencias por m², línea de crédito, sucursal y notas</strong> — no se
              pisa.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Los clientes también se sincronizan solos por webhook cuando cambian en Alegra; esto
              es para forzar una pasada completa.
            </p>

            <div className="mt-5 flex justify-end">
              <Button className="h-11 px-5" onClick={sincronizar} disabled={syncMut.isPending}>
                <RefreshCw
                  size={16}
                  strokeWidth={2.5}
                  className={`mr-2 ${syncMut.isPending ? 'animate-spin' : ''}`}
                />
                {syncMut.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
              </Button>
            </div>
          </section>

          {resultado?.ok ? (
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap gap-8">
                <Stat
                  label="Clientes"
                  detail={`${resultado.data.clientes.creados} nuevos · ${resultado.data.clientes.actualizados} actualizados · ${resultado.data.clientes.omitidos} omitidos`}
                />
                <Stat
                  label="Productos"
                  detail={`${resultado.data.productos.creados} nuevos · ${resultado.data.productos.actualizados} actualizados`}
                />
              </div>
              <ul className="max-h-80 space-y-1 overflow-auto rounded-lg border border-slate-200 bg-paper p-3 text-xs text-slate-600">
                {resultado.data.detalle.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {resultado && !resultado.ok ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {resultado.error}
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}

function Stat({ label, detail }: { label: string; detail: string }) {
  return (
    <div>
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="text-sm text-navy-900">{detail}</p>
    </div>
  );
}
