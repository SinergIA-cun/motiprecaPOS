import { MERMA_PCT_DEFAULT, admiteCapturaM2 } from '@motipreca/shared';
import { Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CapturaToggle } from '../../components/CapturaToggle';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import {
  ApiError,
  type MetodoPago,
  type Producto,
  type UnidadCaptura,
  faltantesFiscales,
} from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { convertirSeguro, resumenCaptura } from '../../lib/m2';
import { UNIDAD_LABEL } from '../../lib/unidades';
import { useSucursales } from '../admin/hooks';
import { useClientes } from '../clientes/hooks';
import { useProductos } from '../productos/hooks';
import { CobroModal } from './CobroModal';
import { useCreateVenta } from './hooks';

const IVA_RATE = 0.16;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: string) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

interface CartItem {
  productoId: string;
  descripcion: string;
  precioUnitario: number;
  unidad: Producto['unidad'];
  /** Piezas. En captura por m² es el preview; el servidor recalcula. */
  cantidad: number;
  piezasPorM2: number | null;
  unidadCaptura: UnidadCaptura;
  cantidadM2: string;
  mermaPct: string;
}

export function POSPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: sucursales } = useSucursales();
  const { data: clientes } = useClientes({ activo: true });
  const createMut = useCreateVenta();

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 250);
  const { data: productos } = useProductos({ q: debounced || undefined, activo: true });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [cobroOpen, setCobroOpen] = useState(false);

  const sucursalId = user?.sucursalId || sucursales?.[0]?.id || '';
  const resultados = (productos ?? []).slice(0, 24);

  // Las piezas mandan en el dinero. En m² salen de la conversión; el servidor
  // repite el cálculo y su resultado es el que se guarda.
  const lineas = cart.map((i) => {
    const conv =
      i.unidadCaptura === 'M2'
        ? convertirSeguro(num(i.cantidadM2), i.piezasPorM2, num(i.mermaPct))
        : null;
    const piezas = i.unidadCaptura === 'M2' ? (conv?.piezas ?? 0) : i.cantidad;
    return { ...i, conv, piezas, importe: round2(piezas * i.precioUnitario) };
  });

  const subtotal = round2(lineas.reduce((s, l) => s + l.importe, 0));
  const iva = round2(subtotal * IVA_RATE);
  const total = round2(subtotal + iva);
  const cobrable = total > 0 && lineas.every((l) => l.piezas > 0);

  const clienteSel = clientes?.find((c) => c.id === clienteId) ?? null;
  const faltantes = faltantesFiscales(clienteSel);

  function addProducto(p: Producto) {
    const eq = p.piezasPorM2 == null ? null : Number(p.piezasPorM2);
    const porM2 = admiteCapturaM2(p.unidad, eq);
    setCart((c) => {
      const found = c.find((x) => x.productoId === p.id);
      if (found) {
        // Producto ya en el carrito: en m² sumar 1 pieza no significa nada, así
        // que solo se incrementa cuando la captura es por pieza.
        return c.map((x) =>
          x.productoId === p.id && x.unidadCaptura === 'PZA'
            ? { ...x, cantidad: x.cantidad + 1 }
            : x,
        );
      }
      return [
        ...c,
        {
          productoId: p.id,
          descripcion: p.nombre,
          precioUnitario: Number(p.precioBase),
          unidad: p.unidad,
          cantidad: 1,
          piezasPorM2: eq,
          unidadCaptura: porM2 ? 'M2' : 'PZA',
          cantidadM2: porM2 ? '1' : '',
          mermaPct: porM2 ? String(MERMA_PCT_DEFAULT) : '0',
        },
      ];
    });
  }

  function cambiarQty(id: string, delta: number) {
    setCart((c) =>
      c.flatMap((x) => {
        if (x.productoId !== id) return [x];
        const q = x.cantidad + delta;
        return q <= 0 ? [] : [{ ...x, cantidad: q }];
      }),
    );
  }

  function actualizarItem(id: string, campo: 'cantidadM2' | 'mermaPct', valor: string) {
    setCart((c) => c.map((x) => (x.productoId === id ? { ...x, [campo]: valor } : x)));
  }

  function cambiarCaptura(id: string, unidadCaptura: UnidadCaptura) {
    setCart((c) =>
      c.map((x) => {
        if (x.productoId !== id) return x;
        if (unidadCaptura === 'M2') {
          return {
            ...x,
            unidadCaptura,
            cantidadM2: x.cantidadM2 || '1',
            mermaPct: x.mermaPct === '0' ? String(MERMA_PCT_DEFAULT) : x.mermaPct,
          };
        }
        const conv = convertirSeguro(num(x.cantidadM2), x.piezasPorM2, num(x.mermaPct));
        return { ...x, unidadCaptura, cantidad: conv?.piezas ?? x.cantidad, mermaPct: '0' };
      }),
    );
  }

  function quitar(id: string) {
    setCart((c) => c.filter((x) => x.productoId !== id));
  }

  // Venta de mostrador: siempre al 100% (el anticipo es solo para cotizaciones §10).
  function cobrar(metodo: MetodoPago, monto: number, referencia?: string) {
    if (!sucursalId) return;
    createMut.mutate(
      {
        sucursalId,
        clienteId: clienteId || undefined,
        requiereFactura,
        items: lineas.map((i) => ({
          productoId: i.productoId,
          cantidad: i.piezas,
          precioUnitario: i.precioUnitario,
          descuentoPct: 0,
          unidadCaptura: i.unidadCaptura,
          cantidadM2: i.unidadCaptura === 'M2' ? num(i.cantidadM2) : undefined,
          mermaPct: i.unidadCaptura === 'M2' ? num(i.mermaPct) : 0,
        })),
        pagos: [{ metodoPago: metodo, monto, referencia }],
      },
      { onSuccess: (venta) => navigate(`/ventas/${venta.id}/ticket`) },
    );
  }

  const errorMessage = createMut.error instanceof ApiError ? createMut.error.message : undefined;

  return (
    <>
      <PageHeader title="Punto de venta" crumb="Mostrador" />
      <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1fr_380px]">
        {/* Productos */}
        <section className="flex flex-col overflow-hidden px-8 py-6">
          <div className="relative mb-4 max-w-lg">
            <Search
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              type="search"
              autoFocus
              placeholder="Buscar producto por código o nombre…"
              className="h-11 pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-auto pb-4 sm:grid-cols-3 xl:grid-cols-4">
            {resultados.length === 0 ? (
              <p className="col-span-full py-12 text-center text-sm text-slate-400">
                {debounced ? 'Sin resultados.' : 'Busca un producto para empezar.'}
              </p>
            ) : (
              resultados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProducto(p)}
                  className="flex h-28 flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-md active:translate-y-0"
                >
                  <span className="font-mono text-[0.6rem] text-navy-500">{p.codigo}</span>
                  <span className="line-clamp-2 text-sm font-medium leading-tight text-navy-900">
                    {p.nombre}
                  </span>
                  <span className="font-mono text-sm font-bold text-navy-700">
                    {formatMoney(p.precioBase)}
                    <span className="ml-1 text-[0.6rem] font-normal text-slate-400">
                      /{UNIDAD_LABEL[p.unidad]}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Carrito */}
        <aside className="flex flex-col border-l border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="mb-3 flex items-center gap-2 font-display font-bold text-navy-900">
              <ShoppingCart size={18} strokeWidth={2} />
              Venta
            </div>
            <Select
              aria-label="Cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Público en general</option>
              {clientes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
            {/* Lo primero que se pregunta en mostrador. */}
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm font-medium text-navy-900">
              <input
                type="checkbox"
                checked={requiereFactura}
                onChange={(e) => setRequiereFactura(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-navy-700"
              />
              Requiere factura
            </label>
            {requiereFactura && !clienteId ? (
              <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                Para facturar hace falta elegir un cliente con datos fiscales; “público en general”
                no se puede facturar.
              </p>
            ) : null}
            {requiereFactura && clienteId && faltantes.length > 0 ? (
              <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                Falta <strong>{faltantes.join(', ')}</strong> de este cliente para emitir el CFDI.
              </p>
            ) : null}
          </div>

          <div className="flex-1 overflow-auto px-3 py-3">
            {cart.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">Agrega productos.</p>
            ) : (
              <ul className="space-y-1">
                {lineas.map((i) => (
                  <li key={i.productoId} className="rounded-lg px-2 py-2 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight text-navy-900">
                        {i.descripcion}
                      </p>
                      <button
                        type="button"
                        onClick={() => quitar(i.productoId)}
                        aria-label="Quitar"
                        className="text-slate-300 transition-colors hover:text-red-600"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                    {admiteCapturaM2(i.unidad, i.piezasPorM2) ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <CapturaToggle
                          value={i.unidadCaptura}
                          etiquetaPza={UNIDAD_LABEL[i.unidad]}
                          onChange={(v) => cambiarCaptura(i.productoId, v)}
                        />
                        {i.unidadCaptura === 'M2' ? (
                          <label className="flex items-center gap-1 font-mono text-[0.6rem] text-slate-400">
                            merma
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              aria-label={`Merma de ${i.descripcion}`}
                              className="h-7 w-12 text-right font-mono text-xs"
                              value={i.mermaPct}
                              onChange={(e) =>
                                actualizarItem(i.productoId, 'mermaPct', e.target.value)
                              }
                            />
                            %
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-1 flex items-center justify-between">
                      {i.unidadCaptura === 'M2' ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            aria-label={`Metros cuadrados de ${i.descripcion}`}
                            className="h-8 w-20 text-right font-mono text-sm"
                            value={i.cantidadM2}
                            onChange={(e) =>
                              actualizarItem(i.productoId, 'cantidadM2', e.target.value)
                            }
                          />
                          <span className="font-mono text-[0.65rem] text-slate-400">m²</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <StepBtn onClick={() => cambiarQty(i.productoId, -1)} aria-label="Menos">
                            <Minus size={13} strokeWidth={2.5} />
                          </StepBtn>
                          <span className="w-8 text-center font-mono text-sm">{i.cantidad}</span>
                          <StepBtn onClick={() => cambiarQty(i.productoId, 1)} aria-label="Más">
                            <Plus size={13} strokeWidth={2.5} />
                          </StepBtn>
                          <span className="ml-1 font-mono text-[0.65rem] text-slate-400">
                            {UNIDAD_LABEL[i.unidad]}
                          </span>
                        </div>
                      )}
                      <span className="font-mono text-sm text-navy-800">
                        {formatMoney(i.importe)}
                      </span>
                    </div>
                    {i.conv ? (
                      <p className="mt-1 font-mono text-[0.6rem] text-navy-500">
                        {resumenCaptura(i.conv)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            <dl className="mb-3 space-y-1 font-mono text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="text-navy-800">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">IVA (16%)</dt>
                <dd className="text-navy-800">{formatMoney(iva)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-display text-lg font-bold text-navy-900">
                <dt>Total</dt>
                <dd>{formatMoney(total)}</dd>
              </div>
            </dl>
            <Button
              className="h-12 w-full text-base"
              disabled={cart.length === 0 || !cobrable}
              onClick={() => setCobroOpen(true)}
            >
              Cobrar {formatMoney(total)}
            </Button>
          </div>
        </aside>
      </div>

      <CobroModal
        key={cobroOpen ? 'open' : 'closed'}
        open={cobroOpen}
        total={total}
        pending={createMut.isPending}
        errorMessage={errorMessage}
        onClose={() => setCobroOpen(false)}
        onConfirm={cobrar}
      />
    </>
  );
}

function StepBtn({
  children,
  onClick,
  ...rest
}: {
  children: ReactNode;
  onClick: () => void;
  'aria-label': string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-navy-700 transition-colors hover:bg-navy-50"
      {...rest}
    >
      {children}
    </button>
  );
}
