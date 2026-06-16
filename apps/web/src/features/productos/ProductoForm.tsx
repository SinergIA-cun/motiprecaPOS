import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateProductoInput, UpdateProductoInput } from '@motipreca/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import type { Producto } from '../../lib/api';

const UNIDADES = [
  { value: 'PZA', label: 'Pieza (pza)' },
  { value: 'M2', label: 'Metro² (m²)' },
  { value: 'ML', label: 'Metro lineal (ml)' },
  { value: 'M3', label: 'Metro³ (m³)' },
  { value: 'KG', label: 'Kilogramo (kg)' },
  { value: 'TON', label: 'Tonelada (ton)' },
  { value: 'LT', label: 'Litro (lt)' },
  { value: 'JGO', label: 'Juego (jgo)' },
] as const;

const TIPOS = [
  { value: 'BAJO_PEDIDO', label: 'Bajo pedido' },
  { value: 'STOCK_SIN_REPOSICION', label: 'Stock sin reposición' },
  { value: 'STOCK_MINIMO', label: 'Stock mínimo' },
] as const;

const formSchema = z.object({
  codigo: z.string().trim().min(2, 'Código muy corto'),
  nombre: z.string().trim().min(2, 'El nombre es muy corto'),
  descripcion: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
  unidad: z.enum(['M2', 'PZA', 'ML', 'KG', 'JGO', 'LT', 'M3', 'TON']),
  tipoProducto: z.enum(['BAJO_PEDIDO', 'STOCK_SIN_REPOSICION', 'STOCK_MINIMO']),
  precioBase: z
    .string()
    .refine((v) => v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0, 'Precio inválido'),
  activo: z.boolean().optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface Props {
  producto?: Producto;
  pending: boolean;
  errorMessage?: string;
  onSubmit: (input: CreateProductoInput | UpdateProductoInput) => void;
  onCancel: () => void;
}

export function ProductoForm({ producto, pending, errorMessage, onSubmit, onCancel }: Props) {
  const isEdit = Boolean(producto);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo: producto?.codigo ?? '',
      nombre: producto?.nombre ?? '',
      descripcion: producto?.descripcion ?? '',
      categoria: producto?.categoria ?? '',
      unidad: producto?.unidad ?? 'PZA',
      tipoProducto: producto?.tipoProducto ?? 'BAJO_PEDIDO',
      precioBase: producto?.precioBase ?? '',
      activo: producto?.activo ?? true,
    },
  });

  const submit = handleSubmit((v) => {
    const base = {
      codigo: v.codigo.toUpperCase(),
      nombre: v.nombre,
      descripcion: v.descripcion ? v.descripcion : undefined,
      categoria: v.categoria ? v.categoria : undefined,
      unidad: v.unidad,
      tipoProducto: v.tipoProducto,
      precioBase: Number(v.precioBase),
    };
    onSubmit(isEdit ? { ...base, activo: v.activo } : base);
  });

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-[1fr_2fr] gap-4">
        <Field label="Código" htmlFor="codigo" error={errors.codigo?.message}>
          <Input
            id="codigo"
            autoFocus
            {...register('codigo')}
            className="font-mono uppercase"
            aria-invalid={Boolean(errors.codigo)}
          />
        </Field>
        <Field label="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
          <Input id="nombre" {...register('nombre')} aria-invalid={Boolean(errors.nombre)} />
        </Field>
      </div>

      <Field label="Descripción" htmlFor="descripcion" error={errors.descripcion?.message}>
        <Textarea id="descripcion" rows={2} {...register('descripcion')} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Unidad" htmlFor="unidad" error={errors.unidad?.message}>
          <Select id="unidad" {...register('unidad')}>
            {UNIDADES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo" htmlFor="tipoProducto" error={errors.tipoProducto?.message}>
          <Select id="tipoProducto" {...register('tipoProducto')}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Categoría (opcional)" htmlFor="categoria" error={errors.categoria?.message}>
          <Input id="categoria" {...register('categoria')} placeholder="Ej. Pisos, Adoquín…" />
        </Field>
        <Field label="Precio base (MXN)" htmlFor="precioBase" error={errors.precioBase?.message}>
          <Input
            id="precioBase"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            className="font-mono"
            {...register('precioBase')}
            aria-invalid={Boolean(errors.precioBase)}
          />
        </Field>
      </div>

      {isEdit ? (
        <label className="mb-5 flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            {...register('activo')}
            className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-700/30"
          />
          Producto activo (disponible para cotizar)
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
          {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </div>
    </form>
  );
}
