import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateClienteInput, UpdateClienteInput } from '@motipreca/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import type { Cliente, Sucursal } from '../../lib/api';

const formSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto'),
  tipo: z.enum(['INDIVIDUAL', 'EMPRESA']),
  telefono: z.string().trim().optional(),
  email: z.string().trim().email('Correo inválido').or(z.literal('')).optional(),
  rfc: z.string().trim().optional(),
  sucursalId: z.string(),
  notas: z.string().trim().optional(),
  activo: z.boolean().optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface Props {
  cliente?: Cliente;
  sucursales: Sucursal[];
  pending: boolean;
  errorMessage?: string;
  onSubmit: (input: CreateClienteInput | UpdateClienteInput) => void;
  onCancel: () => void;
}

export function ClienteForm({
  cliente,
  sucursales,
  pending,
  errorMessage,
  onSubmit,
  onCancel,
}: Props) {
  const isEdit = Boolean(cliente);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: cliente?.nombre ?? '',
      tipo: cliente?.tipo ?? 'INDIVIDUAL',
      telefono: cliente?.telefono ?? '',
      email: cliente?.email ?? '',
      rfc: cliente?.rfc ?? '',
      sucursalId: cliente?.sucursalId ?? '',
      notas: cliente?.notas ?? '',
      activo: cliente?.activo ?? true,
    },
  });

  const submit = handleSubmit((v) => {
    const base = {
      nombre: v.nombre,
      tipo: v.tipo,
      telefono: v.telefono ? v.telefono : undefined,
      email: v.email ? v.email : undefined,
      rfc: v.rfc ? v.rfc.toUpperCase() : undefined,
      notas: v.notas ? v.notas : undefined,
      sucursalId: v.sucursalId ? v.sucursalId : null,
    };
    onSubmit(isEdit ? { ...base, activo: v.activo } : base);
  });

  return (
    <form onSubmit={submit} noValidate>
      <Field label="Nombre o razón social" htmlFor="nombre" error={errors.nombre?.message}>
        <Input
          id="nombre"
          autoFocus
          {...register('nombre')}
          aria-invalid={Boolean(errors.nombre)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tipo" htmlFor="tipo" error={errors.tipo?.message}>
          <Select id="tipo" {...register('tipo')}>
            <option value="INDIVIDUAL">Individual</option>
            <option value="EMPRESA">Empresa</option>
          </Select>
        </Field>
        <Field label="Sucursal" htmlFor="sucursalId">
          <Select id="sucursalId" {...register('sucursalId')}>
            <option value="">Sin sucursal</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Teléfono" htmlFor="telefono" error={errors.telefono?.message}>
          <Input id="telefono" {...register('telefono')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            {...register('email')}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>
      </div>

      <Field label="RFC (opcional)" htmlFor="rfc" error={errors.rfc?.message}>
        <Input id="rfc" {...register('rfc')} maxLength={13} className="font-mono uppercase" />
      </Field>

      <Field label="Notas" htmlFor="notas" error={errors.notas?.message}>
        <Textarea id="notas" rows={3} {...register('notas')} />
      </Field>

      {isEdit ? (
        <label className="mb-5 flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            {...register('activo')}
            className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-700/30"
          />
          Cliente activo
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
          {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </div>
    </form>
  );
}
