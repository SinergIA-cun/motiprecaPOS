import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../hooks/useAuth';
import { ApiError, type Producto, type Unidad } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { UNIDAD_LABEL } from '../../lib/unidades';
import { useSucursales } from '../admin/hooks';
import { useClientes } from '../clientes/hooks';
import { ProductoPicker } from './ProductoPicker';
import { useCreateCotizacion } from './hooks';

const IVA_RATE = 0.16;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: string) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

interface Row {
  key: string;
  productoId: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  descuentoPct: string;
  unidad: Unidad;
}

export function CotizacionBuilderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: clientes } = useClientes({ activo: true });
  const { data: sucursales } = useSucursales();
  const createMut = useCreateCotizacion();

  const [clienteId, setClienteId] = useState('');
  const [sucursalSel, setSucursalSel] = useState('');
  const [vigencia, setVigencia] = useState('15');
  const [observaciones, setObservaciones] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const sucursalId = sucursalSel || user?.sucursalId || sucursales?.[0]?.id || '';

  function addProducto(p: Producto) {
    setRows((r) => [
      ...r,
      {
        key: crypto.randomUUID(),
        productoId: p.id,
        descripcion: p.nombre,
        cantidad: '1',
        precioUnitario: p.precioBase,
        descuentoPct: '0',
        unidad: p.unidad,
      },
    ]);
  }

  function updateRow(key: string, field: keyof Row, value: string) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }
  function removeRow(key: string) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

  const lineas = rows.map((r) => ({
    ...r,
    importe: round2(num(r.cantidad) * num(r.precioUnitario) * (1 - num(r.descuentoPct) / 100)),
  }));
  const bruto = round2(lineas.reduce((s, l) => s + num(l.cantidad) * num(l.precioUnitario), 0));
  const subtotalNeto = round2(lineas.reduce((s, l) => s + l.importe, 0));
  const descuentoTotal = round2(bruto - subtotalNeto);
  const iva = round2(subtotalNeto * IVA_RATE);
  const total = round2(subtotalNeto + iva);

  const apiError = createMut.error instanceof ApiError ? createMut.error.message : undefined;

  function guardar() {
    setFormError(null);
    if (!clienteId) return setFormError('Selecciona un cliente.');
    if (!sucursalId) return setFormError('Selecciona una sucursal.');
    if (rows.length === 0) return setFormError('Agrega al menos una partida.');
    if (rows.some((r) => num(r.cantidad) <= 0))
      return setFormError('Las cantidades deben ser mayores a 0.');

    createMut.mutate(
      {
        clienteId,
        sucursalId,
        vigencia: Number(vigencia) || 15,
        observaciones: observaciones || undefined,
        items: rows.map((r) => ({
          productoId: r.productoId,
          cantidad: num(r.cantidad),
          precioUnitario: num(r.precioUnitario),
          descuentoPct: num(r.descuentoPct),
        })),
      },
      { onSuccess: (data) => navigate(`/cotizaciones/${data.id}`) },
    );
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-8 py-4">
        <button
          type="button"
          onClick={() => navigate('/cotizaciones')}
          aria-label="Volver"
          className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy-700"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="font-display text-lg font-bold tracking-tight text-navy-900">
          Nueva cotización
        </h1>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-400">
          / Ventas
        </span>
      </header>

      <main className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Datos generales */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Cliente" htmlFor="cliente">
                <Select
                  id="cliente"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                >
                  <option value="">Selecciona un cliente…</option>
                  {clientes?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sucursal" htmlFor="sucursal">
                <Select
                  id="sucursal"
                  value={sucursalId}
                  onChange={(e) => setSucursalSel(e.target.value)}
                >
                  {sucursales?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Vigencia (días)" htmlFor="vigencia">
                <Input
                  id="vigencia"
                  type="number"
                  min="1"
                  max="365"
                  className="font-mono"
                  value={vigencia}
                  onChange={(e) => setVigencia(e.target.value)}
                />
              </Field>
            </div>
          </section>

          {/* Partidas */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-paper px-5 py-3">
              <ProductoPicker onSelect={addProducto} />
            </div>

            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400">
                  <th className="px-5 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.14em]">
                    Producto
                  </th>
                  <th className="w-36 px-3 py-2.5 text-right font-mono text-[0.6rem] uppercase tracking-[0.14em]">
                    Cantidad
                  </th>
                  <th className="w-32 px-3 py-2.5 text-right font-mono text-[0.6rem] uppercase tracking-[0.14em]">
                    P. unitario
                  </th>
                  <th className="w-24 px-3 py-2.5 text-right font-mono text-[0.6rem] uppercase tracking-[0.14em]">
                    Desc %
                  </th>
                  <th className="w-32 px-3 py-2.5 text-right font-mono text-[0.6rem] uppercase tracking-[0.14em]">
                    Importe
                  </th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {lineas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                      Agrega productos a la cotización.
                    </td>
                  </tr>
                ) : (
                  lineas.map((l) => (
                    <tr key={l.key} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-navy-900">{l.descripcion}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            aria-label="Cantidad"
                            className="h-9 w-20 text-right font-mono text-sm"
                            value={l.cantidad}
                            onChange={(e) => updateRow(l.key, 'cantidad', e.target.value)}
                          />
                          <span className="w-7 shrink-0 font-mono text-[0.65rem] text-slate-400">
                            {UNIDAD_LABEL[l.unidad]}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label="Precio unitario"
                          className="h-9 text-right font-mono text-sm"
                          value={l.precioUnitario}
                          onChange={(e) => updateRow(l.key, 'precioUnitario', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            aria-label="Descuento"
                            className="h-9 w-14 text-right font-mono text-sm"
                            value={l.descuentoPct}
                            onChange={(e) => updateRow(l.key, 'descuentoPct', e.target.value)}
                          />
                          <span className="font-mono text-[0.65rem] text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-mono text-sm text-navy-800">
                          {formatMoney(l.importe)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(l.key)}
                          aria-label="Quitar partida"
                          className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={15} strokeWidth={2} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          {/* Totales + observaciones */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <label
                htmlFor="observaciones"
                className="mb-1.5 block text-sm font-semibold tracking-tight text-slate-700"
              >
                Observaciones
              </label>
              <Textarea
                id="observaciones"
                rows={4}
                placeholder="Condiciones, notas para el cliente…"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <dl className="space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="text-navy-800">{formatMoney(bruto)}</dd>
                </div>
                {descuentoTotal > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Descuento</dt>
                    <dd className="text-red-600">−{formatMoney(descuentoTotal)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-slate-500">IVA (16%)</dt>
                  <dd className="text-navy-800">{formatMoney(iva)}</dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <dt className="font-display text-base font-bold text-navy-900">Total</dt>
                  <dd className="font-display text-base font-bold text-navy-900">
                    {formatMoney(total)}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          {formError || apiError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError ?? apiError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="h-11" onClick={() => navigate('/cotizaciones')}>
              Cancelar
            </Button>
            <Button className="h-11" disabled={createMut.isPending} onClick={guardar}>
              {createMut.isPending ? 'Guardando…' : 'Guardar cotización'}
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
