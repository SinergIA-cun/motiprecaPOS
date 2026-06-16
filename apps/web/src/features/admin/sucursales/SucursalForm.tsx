import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateSucursalInput, UpdateSucursalInput } from '@motipreca/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import type { Sucursal } from '../../../lib/api';

const formSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto'),
  prefijoFolio: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,4}$/, 'De 2 a 4 letras (ej. CUN)'),
  direccion: z.string().trim().min(3, 'La dirección es muy corta'),
  telefono: z.string().trim().optional(),
  email: z.string().trim().email('Correo inválido').or(z.literal('')).optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface Props {
  sucursal?: Sucursal;
  pending: boolean;
  errorMessage?: string;
  onSubmit: (input: CreateSucursalInput | UpdateSucursalInput) => void;
  onCancel: () => void;
}

export function SucursalForm({ sucursal, pending, errorMessage, onSubmit, onCancel }: Props) {
  const isEdit = Boolean(sucursal);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: sucursal?.nombre ?? '',
      prefijoFolio: sucursal?.prefijoFolio ?? '',
      direccion: sucursal?.direccion ?? '',
      telefono: sucursal?.telefono ?? '',
      email: sucursal?.email ?? '',
    },
  });

  const submit = handleSubmit((v) => {
    const base = {
      nombre: v.nombre,
      direccion: v.direccion,
      telefono: v.telefono ? v.telefono : undefined,
      email: v.email ? v.email : undefined,
    };
    onSubmit(isEdit ? base : { ...base, prefijoFolio: v.prefijoFolio.toUpperCase() });
  });

  return (
    <form onSubmit={submit} noValidate>
      <Field label="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
        <Input
          id="nombre"
          autoFocus
          {...register('nombre')}
          aria-invalid={Boolean(errors.nombre)}
        />
      </Field>

      <Field label="Prefijo de folio" htmlFor="prefijoFolio" error={errors.prefijoFolio?.message}>
        <Input
          id="prefijoFolio"
          {...register('prefijoFolio')}
          disabled={isEdit}
          maxLength={4}
          className="font-mono uppercase disabled:bg-slate-50 disabled:text-slate-400"
          aria-invalid={Boolean(errors.prefijoFolio)}
        />
        {isEdit ? (
          <p className="mt-1.5 text-xs text-slate-400">
            No editable: está ligado a los folios ya emitidos.
          </p>
        ) : null}
      </Field>

      <Field label="Dirección" htmlFor="direccion" error={errors.direccion?.message}>
        <Input id="direccion" {...register('direccion')} aria-invalid={Boolean(errors.direccion)} />
      </Field>

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

      {errorMessage ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="h-11" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear sucursal'}
        </Button>
      </div>
    </form>
  );
}
