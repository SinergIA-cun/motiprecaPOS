import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateUsuarioInput, Rol, UpdateUsuarioInput } from '@motipreca/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { Sucursal, UsuarioAdmin } from '../../../lib/api';

const ROLES: { value: Rol; label: string }[] = [
  { value: 'ASESOR', label: 'Asesor' },
  { value: 'CAJERO', label: 'Cajero' },
  { value: 'JEFE_DEPARTAMENTO', label: 'Jefe de departamento' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'ADMINISTRADOR', label: 'Administrador' },
];

const formSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto'),
  email: z.string().trim().email('Correo inválido'),
  rol: z.enum(['ASESOR', 'CAJERO', 'JEFE_DEPARTAMENTO', 'GERENTE', 'ADMINISTRADOR']),
  iniciales: z
    .string()
    .trim()
    .regex(/^[A-Za-zÑñ]{2,4}$/, 'De 2 a 4 letras'),
  sucursalId: z.string(),
  telefono: z.string().trim().optional(),
  activo: z.boolean().optional(),
  password: z.string().min(8, 'Mínimo 8 caracteres').or(z.literal('')).optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface Props {
  usuario?: UsuarioAdmin;
  sucursales: Sucursal[];
  pending: boolean;
  errorMessage?: string;
  onSubmit: (input: CreateUsuarioInput | UpdateUsuarioInput) => void;
  onCancel: () => void;
}

export function UsuarioForm({
  usuario,
  sucursales,
  pending,
  errorMessage,
  onSubmit,
  onCancel,
}: Props) {
  const isEdit = Boolean(usuario);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: usuario?.nombre ?? '',
      email: usuario?.email ?? '',
      rol: usuario?.rol ?? 'ASESOR',
      iniciales: usuario?.iniciales ?? '',
      sucursalId: usuario?.sucursalId ?? '',
      telefono: usuario?.telefono ?? '',
      activo: usuario?.activo ?? true,
      password: '',
    },
  });

  const submit = handleSubmit((v) => {
    if (!isEdit && !v.password) {
      setError('password', { message: 'La contraseña es obligatoria' });
      return;
    }
    const sucursalId = v.sucursalId ? v.sucursalId : null;
    const telefono = v.telefono ? v.telefono : undefined;
    const iniciales = v.iniciales.toUpperCase();

    if (isEdit) {
      onSubmit({
        nombre: v.nombre,
        rol: v.rol,
        iniciales,
        sucursalId,
        telefono,
        activo: v.activo,
        password: v.password ? v.password : undefined,
      });
    } else {
      onSubmit({
        email: v.email,
        password: v.password ?? '',
        nombre: v.nombre,
        rol: v.rol,
        iniciales,
        sucursalId,
        telefono,
      });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <Field label="Nombre completo" htmlFor="nombre" error={errors.nombre?.message}>
        <Input
          id="nombre"
          autoFocus
          {...register('nombre')}
          aria-invalid={Boolean(errors.nombre)}
        />
      </Field>

      <Field label="Correo" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          {...register('email')}
          disabled={isEdit}
          className="disabled:bg-slate-50 disabled:text-slate-400"
          aria-invalid={Boolean(errors.email)}
        />
        {isEdit ? <p className="mt-1.5 text-xs text-slate-400">El correo no se edita.</p> : null}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Rol" htmlFor="rol" error={errors.rol?.message}>
          <Select id="rol" {...register('rol')}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sucursal" htmlFor="sucursalId" error={errors.sucursalId?.message}>
          <Select id="sucursalId" {...register('sucursalId')}>
            <option value="">Sin sucursal (global)</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Iniciales (folios)" htmlFor="iniciales" error={errors.iniciales?.message}>
          <Input
            id="iniciales"
            {...register('iniciales')}
            maxLength={4}
            className="font-mono uppercase"
            aria-invalid={Boolean(errors.iniciales)}
          />
        </Field>
        <Field label="Teléfono" htmlFor="telefono" error={errors.telefono?.message}>
          <Input id="telefono" {...register('telefono')} />
        </Field>
      </div>

      <Field
        label={isEdit ? 'Restablecer contraseña' : 'Contraseña inicial'}
        htmlFor="password"
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder={isEdit ? 'Dejar en blanco para no cambiar' : 'Mínimo 8 caracteres'}
          {...register('password')}
          aria-invalid={Boolean(errors.password)}
        />
      </Field>

      {isEdit ? (
        <label className="mb-5 flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            {...register('activo')}
            className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-700/30"
          />
          Usuario activo (puede iniciar sesión)
        </label>
      ) : null}

      {errorMessage ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="h-11" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  );
}
