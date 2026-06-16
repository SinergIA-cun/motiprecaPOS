import type { CreateSucursalInput, UpdateSucursalInput } from '@motipreca/shared';
import { Pencil, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { ApiError, type Sucursal } from '../../../lib/api';
import { useCreateSucursal, useSucursales, useUpdateSucursal } from '../hooks';
import { SucursalForm } from './SucursalForm';

export function SucursalesPage() {
  const { data: sucursales, isLoading, isError } = useSucursales();
  const createMut = useCreateSucursal();
  const updateMut = useUpdateSucursal();
  const [editing, setEditing] = useState<Sucursal | null>(null);
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

  function handleSubmit(input: CreateSucursalInput | UpdateSucursalInput) {
    if (editing) {
      updateMut.mutate(
        { id: editing.id, input: input as UpdateSucursalInput },
        { onSuccess: close },
      );
    } else {
      createMut.mutate(input as CreateSucursalInput, { onSuccess: close });
    }
  }

  return (
    <>
      <PageHeader
        title="Sucursales"
        crumb="Administración"
        right={
          <Button className="h-10 px-4" onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={2.5} className="mr-2" />
            Nueva sucursal
          </Button>
        }
      />

      <main className="flex-1 px-8 py-8">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-paper">
                <Th>Sucursal</Th>
                <Th>Prefijo</Th>
                <Th>Dirección</Th>
                <Th>Contacto</Th>
                <Th>Estado</Th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <RowMessage>Cargando…</RowMessage>
              ) : isError ? (
                <RowMessage>No se pudieron cargar las sucursales.</RowMessage>
              ) : sucursales && sucursales.length > 0 ? (
                sucursales.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-navy-50/40"
                  >
                    <Td>
                      <span className="font-medium text-navy-900">{s.nombre}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs font-medium text-navy-700">
                        {s.prefijoFolio}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-slate-500">{s.direccion}</span>
                    </Td>
                    <Td>
                      <span className="block text-slate-600">{s.telefono ?? '—'}</span>
                      {s.email ? (
                        <span className="block text-xs text-slate-400">{s.email}</span>
                      ) : null}
                    </Td>
                    <Td>
                      {s.activa ? <Badge tone="success">Activa</Badge> : <Badge>Inactiva</Badge>}
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        aria-label={`Editar ${s.nombre}`}
                        className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-navy-100 hover:text-navy-700"
                      >
                        <Pencil size={15} strokeWidth={2} />
                      </button>
                    </Td>
                  </tr>
                ))
              ) : (
                <RowMessage>Aún no hay sucursales.</RowMessage>
              )}
            </tbody>
          </table>
        </div>
      </main>

      <Modal
        open={isOpen}
        title={editing ? 'Editar sucursal' : 'Nueva sucursal'}
        subtitle={editing ? editing.nombre : 'Registra una sucursal del sistema'}
        onClose={close}
      >
        <SucursalForm
          sucursal={editing ?? undefined}
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
      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}
