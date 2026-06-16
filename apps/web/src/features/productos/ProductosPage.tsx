import type { CreateProductoInput, UpdateProductoInput } from '@motipreca/shared';
import { Pencil, Plus, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { ApiError, type Producto, type ProductosFilter, type Unidad } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { ProductoForm } from './ProductoForm';
import { useCreateProducto, useProductos, useUpdateProducto } from './hooks';

const UNIDAD_LABEL: Record<Unidad, string> = {
  PZA: 'pza',
  M2: 'm²',
  ML: 'ml',
  M3: 'm³',
  KG: 'kg',
  TON: 'ton',
  LT: 'lt',
  JGO: 'jgo',
};

export function ProductosPage() {
  const { user } = useAuth();
  const canManage = user?.rol === 'GERENTE' || user?.rol === 'ADMINISTRADOR';

  const [filter, setFilter] = useState<ProductosFilter>({});
  const { data: productos, isLoading, isError } = useProductos(filter);
  const createMut = useCreateProducto();
  const updateMut = useUpdateProducto();
  const [editing, setEditing] = useState<Producto | null>(null);
  const [creating, setCreating] = useState(false);

  const isOpen = creating || editing !== null;
  const pending = createMut.isPending || updateMut.isPending;
  const mutError = createMut.error ?? updateMut.error;
  const errorMessage = mutError instanceof ApiError ? mutError.message : undefined;

  function close() {
    setCreating(false);
    setEditing(null);
    createMut.reset();
    updateMut.reset();
  }

  function handleSubmit(input: CreateProductoInput | UpdateProductoInput) {
    if (editing) {
      updateMut.mutate(
        { id: editing.id, input: input as UpdateProductoInput },
        { onSuccess: close },
      );
    } else {
      createMut.mutate(input as CreateProductoInput, { onSuccess: close });
    }
  }

  return (
    <>
      <PageHeader
        title="Productos"
        crumb="Catálogo"
        right={
          canManage ? (
            <Button className="h-10 px-4" onClick={() => setCreating(true)}>
              <Plus size={16} strokeWidth={2.5} className="mr-2" />
              Nuevo producto
            </Button>
          ) : undefined
        }
      />

      <main className="flex-1 px-8 py-8">
        <div className="relative mb-4 max-w-sm">
          <Search
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            type="search"
            placeholder="Buscar por código, nombre o categoría…"
            className="h-10 pl-10 text-sm"
            value={filter.q ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-paper">
                <Th>Código</Th>
                <Th>Producto</Th>
                <Th>Unidad</Th>
                <Th className="text-right">Precio base</Th>
                <Th>Estado</Th>
                {canManage ? <th className="w-16" /> : null}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <RowMessage span={canManage ? 6 : 5}>Cargando…</RowMessage>
              ) : isError ? (
                <RowMessage span={canManage ? 6 : 5}>
                  No se pudieron cargar los productos.
                </RowMessage>
              ) : productos && productos.length > 0 ? (
                productos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-navy-50/40"
                  >
                    <Td>
                      <span className="font-mono text-xs font-medium text-navy-700">
                        {p.codigo}
                      </span>
                    </Td>
                    <Td>
                      <p className="font-medium text-navy-900">{p.nombre}</p>
                      {p.categoria ? <p className="text-xs text-slate-400">{p.categoria}</p> : null}
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-500">
                        {UNIDAD_LABEL[p.unidad]}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <span className="font-mono text-sm text-navy-800">
                        {formatMoney(p.precioBase)}
                      </span>
                    </Td>
                    <Td>
                      {p.activo ? <Badge tone="success">Activo</Badge> : <Badge>Inactivo</Badge>}
                    </Td>
                    {canManage ? (
                      <Td>
                        <button
                          type="button"
                          onClick={() => setEditing(p)}
                          aria-label={`Editar ${p.nombre}`}
                          className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-navy-100 hover:text-navy-700"
                        >
                          <Pencil size={15} strokeWidth={2} />
                        </button>
                      </Td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <RowMessage span={canManage ? 6 : 5}>
                  {filter.q ? 'Ningún producto coincide.' : 'Aún no hay productos en el catálogo.'}
                </RowMessage>
              )}
            </tbody>
          </table>
        </div>
      </main>

      <Modal
        open={isOpen}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        subtitle={editing ? editing.nombre : 'Agrega un producto al catálogo'}
        onClose={close}
      >
        <ProductoForm
          producto={editing ?? undefined}
          pending={pending}
          errorMessage={errorMessage}
          onSubmit={handleSubmit}
          onCancel={close}
        />
      </Modal>
    </>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`px-5 py-3 font-mono text-[0.6rem] font-medium uppercase tracking-[0.14em] text-slate-400 ${className ?? ''}`}
    >
      {children}
    </th>
  );
}
function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-3.5 align-middle ${className ?? ''}`}>{children}</td>;
}
function RowMessage({ children, span }: { children: ReactNode; span: number }) {
  return (
    <tr>
      <td colSpan={span} className="px-5 py-12 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}
