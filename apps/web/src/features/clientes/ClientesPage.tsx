import type { CreateClienteInput, UpdateClienteInput } from '@motipreca/shared';
import { Pencil, Plus, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ApiError, type Cliente, type ClientesFilter } from '../../lib/api';
import { formatTelefono } from '../../lib/format';
import { useSucursales } from '../admin/hooks';
import { ClienteForm } from './ClienteForm';
import { useClientes, useCreateCliente, useUpdateCliente } from './hooks';

export function ClientesPage() {
  const [filter, setFilter] = useState<ClientesFilter>({});
  const { data: clientes, isLoading, isError } = useClientes(filter);
  const { data: sucursales } = useSucursales();
  const createMut = useCreateCliente();
  const updateMut = useUpdateCliente();
  const [editing, setEditing] = useState<Cliente | null>(null);
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

  function handleSubmit(input: CreateClienteInput | UpdateClienteInput) {
    if (editing) {
      updateMut.mutate(
        { id: editing.id, input: input as UpdateClienteInput },
        { onSuccess: close },
      );
    } else {
      createMut.mutate(input as CreateClienteInput, { onSuccess: close });
    }
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        crumb="CRM"
        right={
          <Button className="h-10 px-4" onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={2.5} className="mr-2" />
            Nuevo cliente
          </Button>
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
            placeholder="Buscar por nombre, correo, RFC o teléfono…"
            className="h-10 pl-10 text-sm"
            value={filter.q ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-paper">
                <Th>Cliente</Th>
                <Th>Contacto</Th>
                <Th>RFC</Th>
                <Th>Estado</Th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <RowMessage>Cargando…</RowMessage>
              ) : isError ? (
                <RowMessage>No se pudieron cargar los clientes.</RowMessage>
              ) : clientes && clientes.length > 0 ? (
                clientes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-navy-50/40"
                  >
                    <Td>
                      <p className="font-medium text-navy-900">{c.nombre}</p>
                      <p className="font-mono text-[0.62rem] uppercase tracking-wide text-slate-400">
                        {c.tipo === 'EMPRESA' ? 'Empresa' : 'Individual'}
                      </p>
                    </Td>
                    <Td>
                      <span className="block font-mono text-slate-600">
                        {formatTelefono(c.telefono) || '—'}
                      </span>
                      {c.email ? (
                        <span className="block text-xs text-slate-400">{c.email}</span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-500">{c.rfc ?? '—'}</span>
                    </Td>
                    <Td>
                      {c.activo ? <Badge tone="success">Activo</Badge> : <Badge>Inactivo</Badge>}
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        aria-label={`Editar ${c.nombre}`}
                        className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-navy-100 hover:text-navy-700"
                      >
                        <Pencil size={15} strokeWidth={2} />
                      </button>
                    </Td>
                  </tr>
                ))
              ) : (
                <RowMessage>
                  {filter.q ? 'Ningún cliente coincide con la búsqueda.' : 'Aún no hay clientes.'}
                </RowMessage>
              )}
            </tbody>
          </table>
        </div>
      </main>

      <Modal
        open={isOpen}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        subtitle={editing ? editing.nombre : 'Registra un cliente del CRM'}
        onClose={close}
      >
        <ClienteForm
          cliente={editing ?? undefined}
          sucursales={sucursales ?? []}
          pending={pending}
          errorMessage={errorMessage}
          onSubmit={handleSubmit}
          onCancel={close}
        />
      </Modal>
    </>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-5 py-3 font-mono text-[0.6rem] font-medium uppercase tracking-[0.14em] text-slate-400">
      {children}
    </th>
  );
}
function Td({ children }: { children: ReactNode }) {
  return <td className="px-5 py-3.5 align-middle">{children}</td>;
}
function RowMessage({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}
