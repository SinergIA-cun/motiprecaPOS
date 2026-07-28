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

/** Campo numérico de la ficha técnica: '' significa "no lo tengo", no cero. */
const numeroOpcional = z
  .string()
  .refine(
    (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) > 0),
    'Debe ser un número mayor a 0, o vacío',
  );

/** Decimal de Prisma → texto para el input, sin ceros de relleno ("11.0000" → "11"). */
function aTexto(valor: string | null | undefined): string {
  return valor == null ? '' : String(Number(valor));
}

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
  // '' = el producto no se vende por m². Cualquier otro valor debe ser > 0.
  piezasPorM2: z
    .string()
    .refine(
      (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) > 0),
      'Debe ser un número mayor a 0, o vacío si no se vende por m²',
    ),
  familia: z.string().trim().optional(),
  dimensionesCm: z.string().trim().optional(),
  superficieM2: numeroOpcional,
  pesoKg: numeroOpcional,
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
      piezasPorM2: aTexto(producto?.piezasPorM2),
      familia: producto?.familia ?? '',
      dimensionesCm: producto?.dimensionesCm ?? '',
      superficieM2: aTexto(producto?.superficieM2),
      pesoKg: aTexto(producto?.pesoKg),
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
      // Vacío = borra el dato (null), no "no lo mandes": así se puede quitar una
      // equivalencia mal cargada desde el formulario.
      piezasPorM2: v.piezasPorM2 === '' ? null : Number(v.piezasPorM2),
      familia: v.familia ? v.familia : null,
      dimensionesCm: v.dimensionesCm ? v.dimensionesCm : null,
      superficieM2: v.superficieM2 === '' ? null : Number(v.superficieM2),
      pesoKg: v.pesoKg === '' ? null : Number(v.pesoKg),
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

      <fieldset className="mb-5 rounded-lg border border-slate-200 bg-paper px-4 pb-1 pt-3">
        <legend className="px-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">
          Ficha técnica
        </legend>
        <p className="mb-3 text-xs text-slate-500">
          Datos de Motipos que Alegra no guarda. Todos son opcionales, y se pueden cargar en bloque
          desde Catálogo → Ficha técnica.
        </p>

        <Field label="Piezas por m²" htmlFor="piezasPorM2" error={errors.piezasPorM2?.message}>
          <Input
            id="piezasPorM2"
            type="number"
            step="0.0001"
            min="0"
            inputMode="decimal"
            className="font-mono"
            placeholder="Ej. 54 para adocreto huesito"
            {...register('piezasPorM2')}
            aria-invalid={Boolean(errors.piezasPorM2)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Al llenarlo, el cotizador y el POS permiten capturar la cantidad en m² y calculan las
            piezas solas. Déjalo vacío si no aplica.
          </p>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Familia" htmlFor="familia" error={errors.familia?.message}>
            <Input id="familia" {...register('familia')} placeholder="Ej. Vibrocomprimida" />
          </Field>
          <Field label="Dimensiones" htmlFor="dimensionesCm" error={errors.dimensionesCm?.message}>
            <Input
              id="dimensionesCm"
              {...register('dimensionesCm')}
              placeholder="Ej. 30 x 30 x 10"
              className="font-mono"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Superficie de 1 pieza (m²)"
            htmlFor="superficieM2"
            error={errors.superficieM2?.message}
          >
            <Input
              id="superficieM2"
              type="number"
              step="0.0001"
              min="0"
              inputMode="decimal"
              className="font-mono"
              placeholder="Ej. 0.0909"
              {...register('superficieM2')}
              aria-invalid={Boolean(errors.superficieM2)}
            />
          </Field>
          <Field label="Peso de 1 pieza (kg)" htmlFor="pesoKg" error={errors.pesoKg?.message}>
            <Input
              id="pesoKg"
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              className="font-mono"
              placeholder="Ej. 10.6"
              {...register('pesoKg')}
              aria-invalid={Boolean(errors.pesoKg)}
            />
          </Field>
        </div>
      </fieldset>

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
