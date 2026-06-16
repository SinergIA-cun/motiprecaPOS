import type { CreateUsuarioInput, Rol, UpdateUsuarioInput } from '@motipreca/shared';
import { Pencil, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { ApiError, type UsuariosFilter, type UsuarioAdmin } from '../../../lib/api';
import { useCreateUsuario, useSucursales, useUpdateUsuario, useUsuarios } from '../hooks';
import { UsuarioForm } from './UsuarioForm';

const ROLE_LABEL: Record<Rol, string> = {
  ASESOR: 'Asesor',
  CAJERO: 'Cajero',
  JEFE_DEPARTAMENTO: 'Jefe de depto',
  GERENTE: 'Gerente',
  ADMINISTRADOR: 'Administrador',
};

const dateFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
function formatDate(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : '—';
}

export function UsuariosPage() {
  const [filter, setFilter] = useState<UsuariosFilter>({});
  const { data: usuarios, isLoading, isError } = useUsuarios(filter);
  const { data: sucursales } = useSucursales();
  const createMut = useCreateUsuario();
  const updateMut = useUpdateUsuario();
  const [editing, setEditing] = useState<UsuarioAdmin | null>(null);
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

  function handleSubmit(input: CreateUsuarioInput | UpdateUsuarioInput) {
    if (editing) {
      updateMut.mutate(
        { id: editing.id, input: input as UpdateUsuarioInput },
        { onSuccess: close },
      );
    } else {
      createMut.mutate(input as CreateUsuarioInput, { onSuccess: close });
    }
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        crumb="Administración"
        right={
          <Button className="h-10 px-4" onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={2.5} className="mr-2" />
            Nuevo usuario
          </Button>
        }
      />

      <main className="flex-1 px-8 py-8">
        {/* Filtros */}
        <div className="mb-4 flex flex-wrap gap-3">
          <Select
            aria-label="Filtrar por rol"
            className="h-10 w-auto min-w-44 text-sm"
            value={filter.rol ?? ''}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                rol: e.target.value ? (e.target.value as Rol) : undefined,
              }))
            }
          >
            <option value="">Todos los roles</option>
            {(Object.keys(ROLE_LABEL) as Rol[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filtrar por sucursal"
            className="h-10 w-auto min-w-48 text-sm"
            value={filter.sucursalId ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, sucursalId: e.target.value || undefined }))}
          >
            <option value="">Todas las sucursales</option>
            {sucursales?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filtrar por estado"
            className="h-10 w-auto min-w-40 text-sm"
            value={filter.activo === undefined ? '' : String(filter.activo)}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                activo: e.target.value === '' ? undefined : e.target.value === 'true',
              }))
            }
          >
            <option value="">Activos e inactivos</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-paper">
                <Th>Usuario</Th>
                <Th>Rol</Th>
                <Th>Sucursal</Th>
                <Th>Estado</Th>
                <Th>Último acceso</Th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <RowMessage>Cargando…</RowMessage>
              ) : isError ? (
                <RowMessage>No se pudieron cargar los usuarios.</RowMessage>
              ) : usuarios && usuarios.length > 0 ? (
                usuarios.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-navy-50/40"
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-navy-700 font-display text-xs font-bold text-white">
                          {u.iniciales}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-navy-900">{u.nombre}</p>
                          <p className="truncate text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone="navy">{ROLE_LABEL[u.rol]}</Badge>
                    </Td>
                    <Td>
                      <span className="text-slate-600">
                        {u.sucursal?.nombre ?? <span className="text-slate-400">Global</span>}
                      </span>
                    </Td>
                    <Td>
                      {u.activo ? <Badge tone="success">Activo</Badge> : <Badge>Inactivo</Badge>}
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-500">
                        {formatDate(u.ultimoLoginAt)}
                      </span>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setEditing(u)}
                        aria-label={`Editar ${u.nombre}`}
                        className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-navy-100 hover:text-navy-700"
                      >
                        <Pencil size={15} strokeWidth={2} />
                      </button>
                    </Td>
                  </tr>
                ))
              ) : (
                <RowMessage>No hay usuarios que coincidan.</RowMessage>
              )}
            </tbody>
          </table>
        </div>
      </main>

      <Modal
        open={isOpen}
        title={editing ? 'Editar usuario' : 'Nuevo usuario'}
        subtitle={editing ? editing.email : 'Crea una cuenta de acceso al sistema'}
        onClose={close}
      >
        <UsuarioForm
          usuario={editing ?? undefined}
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
      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}
