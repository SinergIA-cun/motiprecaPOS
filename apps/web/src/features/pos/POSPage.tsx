import { Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { ApiError, type MetodoPago, type Producto } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { UNIDAD_LABEL } from '../../lib/unidades';
import { useSucursales } from '../admin/hooks';
import { useClientes } from '../clientes/hooks';
import { useProductos } from '../productos/hooks';
import { CobroModal } from './CobroModal';
import { useCreateVenta } from './hooks';

const IVA_RATE = 0.16;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface CartItem {
  productoId: string;
  descripcion: string;
  precioUnitario: number;
  unidad: Producto['unidad'];
  cantidad: number;
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
  const [cobroOpen, setCobroOpen] = useState(false);

  const sucursalId = user?.sucursalId || sucursales?.[0]?.id || '';
  const resultados = (productos ?? []).slice(0, 24);

  const subtotal = round2(cart.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0));
  const iva = round2(subtotal * IVA_RATE);
  const total = round2(subtotal + iva);

  function addProducto(p: Producto) {
    setCart((c) => {
      const found = c.find((x) => x.productoId === p.id);
      if (found) {
        return c.map((x) => (x.productoId === p.id ? { ...x, cantidad: x.cantidad + 1 } : x));
      }
      return [
        ...c,
        {
          productoId: p.id,
          descripcion: p.nombre,
          precioUnitario: Number(p.precioBase),
          unidad: p.unidad,
          cantidad: 1,
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

  function quitar(id: string) {
    setCart((c) => c.filter((x) => x.productoId !== id));
  }

  function cobrar(metodo: MetodoPago, referencia?: string) {
    if (!sucursalId) return;
    createMut.mutate(
      {
        sucursalId,
        clienteId: clienteId || undefined,
        items: cart.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          descuentoPct: 0,
        })),
        pagos: [{ metodoPago: metodo, monto: total, referencia }],
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
          </div>

          <div className="flex-1 overflow-auto px-3 py-3">
            {cart.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">Agrega productos.</p>
            ) : (
              <ul className="space-y-1">
                {cart.map((i) => (
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
                    <div className="mt-1 flex items-center justify-between">
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
                      <span className="font-mono text-sm text-navy-800">
                        {formatMoney(i.cantidad * i.precioUnitario)}
                      </span>
                    </div>
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
              disabled={cart.length === 0}
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
