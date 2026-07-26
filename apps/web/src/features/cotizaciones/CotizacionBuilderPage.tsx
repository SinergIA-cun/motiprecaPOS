import { MERMA_PCT_DEFAULT, admiteCapturaM2 } from '@motipreca/shared';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CapturaToggle } from '../../components/CapturaToggle';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../hooks/useAuth';
import {
  ApiError,
  type ClienteFiscal,
  type CotizacionDetail,
  type Producto,
  type Unidad,
  type UnidadCaptura,
  faltantesFiscales,
} from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { convertirSeguro, resumenCaptura } from '../../lib/m2';
import { UNIDAD_LABEL } from '../../lib/unidades';
import { useSucursales } from '../admin/hooks';
import { ClienteBuscador } from '../clientes/ClienteBuscador';
import { CreditoPanel } from '../clientes/CreditoPanel';
import { ProductoPicker } from './ProductoPicker';
import { useCotizacion, useCreateCotizacion, useUpdateCotizacion } from './hooks';

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
  /** Piezas. Cuando se captura en m², la calcula el servidor y esto es preview. */
  cantidad: string;
  precioUnitario: string;
  descuentoPct: string;
  unidad: Unidad;
  /** Equivalencia del producto. null = no se puede capturar en m². */
  piezasPorM2: number | null;
  unidadCaptura: UnidadCaptura;
  cantidadM2: string;
  mermaPct: string;
}

export function CotizacionBuilderPage() {
  // Modo edición: /cotizaciones/:id/editar carga la cotización y prellena el form
  // (remontaje por key, mismo patrón que ReglaForm).
  const { id: editId = '' } = useParams();
  const { data: editCot, isLoading } = useCotizacion(editId);

  if (editId && (isLoading || !editCot)) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-slate-400">
        Cargando cotización…
      </div>
    );
  }
  return <BuilderForm key={editId || 'nueva'} editCot={editId ? editCot : undefined} />;
}

function BuilderForm({ editCot }: { editCot?: CotizacionDetail }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: sucursales } = useSucursales();
  const createMut = useCreateCotizacion();
  const updateMut = useUpdateCotizacion();
  const esEdicion = Boolean(editCot);

  const [clienteId, setClienteId] = useState(editCot?.cliente.id ?? '');
  // Se guarda el cliente completo (no solo el id) para poder avisar si le faltan
  // datos fiscales cuando se marca "requiere factura".
  const [clienteFiscal, setClienteFiscal] = useState<ClienteFiscal | null>(
    editCot?.cliente ?? null,
  );
  const [requiereFactura, setRequiereFactura] = useState(editCot?.requiereFactura ?? false);
  const [sucursalSel, setSucursalSel] = useState(editCot?.sucursal.id ?? '');
  const [vigencia, setVigencia] = useState(editCot ? String(editCot.vigencia) : '15');
  const [anticipoPct, setAnticipoPct] = useState(
    editCot ? String(Number(editCot.anticipoPct)) : '60', // §10: default 60%
  );
  const [observaciones, setObservaciones] = useState(editCot?.observaciones ?? '');
  const [rows, setRows] = useState<Row[]>(
    editCot
      ? editCot.items.map((i) => ({
          key: i.id,
          productoId: i.productoId,
          descripcion: i.descripcion,
          cantidad: String(Number(i.cantidad)),
          precioUnitario: String(Number(i.precioUnitario)),
          descuentoPct: String(Number(i.descuentoPct)),
          unidad: i.producto.unidad,
          piezasPorM2: i.producto.piezasPorM2 == null ? null : Number(i.producto.piezasPorM2),
          unidadCaptura: i.unidadCaptura,
          cantidadM2: i.cantidadM2 == null ? '' : String(Number(i.cantidadM2)),
          mermaPct: String(Number(i.mermaPct)),
        }))
      : [],
  );
  const [formError, setFormError] = useState<string | null>(null);

  const sucursalId = sucursalSel || user?.sucursalId || sucursales?.[0]?.id || '';
  const faltantes = faltantesFiscales(clienteFiscal);

  function addProducto(p: Producto) {
    const eq = p.piezasPorM2 == null ? null : Number(p.piezasPorM2);
    // Si el producto se vende por superficie, arranca en m²: es como lo pide el
    // cliente ("necesito 2 m² de adocreto"). El toggle permite volver a piezas.
    const porM2 = admiteCapturaM2(p.unidad, eq);
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
        piezasPorM2: eq,
        unidadCaptura: porM2 ? 'M2' : 'PZA',
        cantidadM2: porM2 ? '1' : '',
        mermaPct: porM2 ? String(MERMA_PCT_DEFAULT) : '0',
      },
    ]);
  }

  function updateRow(key: string, field: keyof Row, value: string) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }
  function cambiarCaptura(key: string, unidadCaptura: UnidadCaptura) {
    setRows((r) =>
      r.map((row) => {
        if (row.key !== key) return row;
        if (unidadCaptura === 'M2') {
          return {
            ...row,
            unidadCaptura,
            cantidadM2: row.cantidadM2 || '1',
            mermaPct: row.mermaPct === '0' ? String(MERMA_PCT_DEFAULT) : row.mermaPct,
          };
        }
        // De vuelta a piezas: se conserva lo calculado para no perder el número.
        const conv = convertirSeguro(num(row.cantidadM2), row.piezasPorM2, num(row.mermaPct));
        return {
          ...row,
          unidadCaptura,
          cantidad: conv ? String(conv.piezas) : row.cantidad,
          mermaPct: '0',
        };
      }),
    );
  }
  function removeRow(key: string) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

  const lineas = rows.map((r) => {
    const conv =
      r.unidadCaptura === 'M2'
        ? convertirSeguro(num(r.cantidadM2), r.piezasPorM2, num(r.mermaPct))
        : null;
    // Las piezas mandan en el dinero, siempre. En m² son las que salieron de la
    // conversión; el servidor repite este cálculo y su resultado es el que vale.
    const piezas = r.unidadCaptura === 'M2' ? (conv?.piezas ?? 0) : num(r.cantidad);
    return {
      ...r,
      conv,
      piezas,
      importe: round2(piezas * num(r.precioUnitario) * (1 - num(r.descuentoPct) / 100)),
    };
  });
  const bruto = round2(lineas.reduce((s, l) => s + l.piezas * num(l.precioUnitario), 0));
  const subtotalNeto = round2(lineas.reduce((s, l) => s + l.importe, 0));
  const descuentoTotal = round2(bruto - subtotalNeto);
  const iva = round2(subtotalNeto * IVA_RATE);
  const total = round2(subtotalNeto + iva);

  const mutActiva = esEdicion ? updateMut : createMut;
  const apiError = mutActiva.error instanceof ApiError ? mutActiva.error.message : undefined;

  function guardar() {
    setFormError(null);
    if (!clienteId) return setFormError('Selecciona un cliente.');
    if (!sucursalId) return setFormError('Selecciona una sucursal.');
    if (rows.length === 0) return setFormError('Agrega al menos una partida.');
    const invalida = lineas.find((l) => l.piezas <= 0);
    if (invalida) {
      return setFormError(
        invalida.unidadCaptura === 'M2'
          ? `Indica los m² de "${invalida.descripcion}".`
          : `La cantidad de "${invalida.descripcion}" debe ser mayor a 0.`,
      );
    }

    const base = {
      clienteId,
      vigencia: Number(vigencia) || 15,
      anticipoPct: Number(anticipoPct) || 60,
      observaciones: observaciones || undefined,
      requiereFactura,
      items: lineas.map((r) => ({
        productoId: r.productoId,
        // En m² se manda como referencia: el servidor la recalcula y su número
        // es el que se guarda.
        cantidad: r.piezas,
        precioUnitario: num(r.precioUnitario),
        descuentoPct: num(r.descuentoPct),
        unidadCaptura: r.unidadCaptura,
        cantidadM2: r.unidadCaptura === 'M2' ? num(r.cantidadM2) : undefined,
        mermaPct: r.unidadCaptura === 'M2' ? num(r.mermaPct) : 0,
      })),
    };
    if (esEdicion && editCot) {
      updateMut.mutate(
        { id: editCot.id, input: base },
        { onSuccess: (data) => navigate(`/cotizaciones/${data.id}`) },
      );
    } else {
      createMut.mutate(
        { ...base, sucursalId },
        { onSuccess: (data) => navigate(`/cotizaciones/${data.id}`) },
      );
    }
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
          {esEdicion ? `Editar ${editCot?.folio}` : 'Nueva cotización'}
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
                <ClienteBuscador
                  value={clienteId}
                  initialLabel={editCot?.cliente.nombre}
                  onSelect={(c) => {
                    setClienteId(c?.id ?? '');
                    setClienteFiscal(c);
                  }}
                />
              </Field>
              <Field label="Sucursal" htmlFor="sucursal">
                <Select
                  id="sucursal"
                  value={sucursalId}
                  disabled={esEdicion} // el folio pertenece a la sucursal original
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
              <Field label="Anticipo al cobrar (%)" htmlFor="anticipo">
                <Input
                  id="anticipo"
                  type="number"
                  min="1"
                  max="100"
                  className="font-mono"
                  value={anticipoPct}
                  onChange={(e) => setAnticipoPct(e.target.value)}
                />
              </Field>
            </div>
            {/* Factura: la emite Alegra, pero aquí se decide si va a hacer falta. */}
            <div className="mt-4 rounded-lg border border-slate-200 bg-paper px-4 py-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-navy-900">
                <input
                  type="checkbox"
                  checked={requiereFactura}
                  onChange={(e) => setRequiereFactura(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-navy-700"
                />
                El cliente requiere factura
              </label>
              {requiereFactura && faltantes.length > 0 ? (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  A este cliente le falta <strong>{faltantes.join(', ')}</strong> para poder
                  facturarle. Se puede cotizar igual, pero hay que completar sus datos fiscales
                  antes de emitir el CFDI en Alegra.
                </p>
              ) : null}
            </div>
            {clienteId ? (
              <div className="mt-4">
                <CreditoPanel clienteId={clienteId} />
              </div>
            ) : null}
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
                        {admiteCapturaM2(l.unidad, l.piezasPorM2) ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <CapturaToggle
                              value={l.unidadCaptura}
                              etiquetaPza={UNIDAD_LABEL[l.unidad]}
                              onChange={(v) => cambiarCaptura(l.key, v)}
                            />
                            <span className="font-mono text-[0.62rem] text-slate-400">
                              {l.piezasPorM2} pz/m²
                            </span>
                            {l.unidadCaptura === 'M2' ? (
                              <label className="flex items-center gap-1 font-mono text-[0.62rem] text-slate-400">
                                merma
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  aria-label={`Merma de ${l.descripcion}`}
                                  className="h-7 w-14 text-right font-mono text-xs"
                                  value={l.mermaPct}
                                  onChange={(e) => updateRow(l.key, 'mermaPct', e.target.value)}
                                />
                                %
                              </label>
                            ) : null}
                          </div>
                        ) : null}
                        {l.conv ? (
                          <p className="mt-1 font-mono text-[0.62rem] text-navy-500">
                            {resumenCaptura(l.conv)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {l.unidadCaptura === 'M2' ? (
                            <>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                aria-label={`Metros cuadrados de ${l.descripcion}`}
                                className="h-9 w-20 text-right font-mono text-sm"
                                value={l.cantidadM2}
                                onChange={(e) => updateRow(l.key, 'cantidadM2', e.target.value)}
                              />
                              <span className="w-7 shrink-0 font-mono text-[0.65rem] text-slate-400">
                                m²
                              </span>
                            </>
                          ) : (
                            <>
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
                            </>
                          )}
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
            <Button className="h-11" disabled={mutActiva.isPending} onClick={guardar}>
              {mutActiva.isPending
                ? 'Guardando…'
                : esEdicion
                  ? 'Guardar cambios'
                  : 'Guardar cotización'}
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
