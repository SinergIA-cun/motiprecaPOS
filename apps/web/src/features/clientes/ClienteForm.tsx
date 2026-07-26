import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateClienteInput, UpdateClienteInput } from '@motipreca/shared';
import { USOS_CFDI, USO_CFDI_DEFAULT, regimenesPara } from '@motipreca/shared';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../hooks/useAuth';
import type { Cliente, Sucursal } from '../../lib/api';
import {
  formatMontoEntero,
  formatTelefono,
  maskTelefono,
  parseMontoEntero,
} from '../../lib/format';
import { conMascara } from '../../lib/mascara';

const formSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto'),
  tipo: z.enum(['INDIVIDUAL', 'EMPRESA']),
  telefono: z.string().trim().optional(),
  email: z.string().trim().email('Correo inválido').or(z.literal('')).optional(),
  rfc: z.string().trim().optional(),
  sucursalId: z.string(),
  notas: z.string().trim().optional(),
  activo: z.boolean().optional(),
  lineaCredito: z.string().trim().optional(), // solo gerencia; '' = sin crédito
  // ---- Datos fiscales (CFDI 4.0). Opcionales: un cliente de mostrador que no
  // pide factura no tiene por qué traerlos. Alegra los necesita para timbrar.
  razonSocial: z.string().trim().optional(),
  regimenFiscal: z.string().trim().optional(),
  codigoPostalFiscal: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{5}$/.test(v), 'Debe tener 5 dígitos')
    .optional(),
  usoCFDI: z.string().trim().optional(),
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
  const { user } = useAuth();
  const esGerencia = user?.rol === 'GERENTE' || user?.rol === 'ADMINISTRADOR';
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: cliente?.nombre ?? '',
      tipo: cliente?.tipo ?? 'INDIVIDUAL',
      telefono: formatTelefono(cliente?.telefono),
      email: cliente?.email ?? '',
      rfc: cliente?.rfc ?? '',
      sucursalId: cliente?.sucursalId ?? '',
      notas: cliente?.notas ?? '',
      activo: cliente?.activo ?? true,
      lineaCredito:
        cliente?.lineaCredito != null
          ? formatMontoEntero(String(Number(cliente.lineaCredito)))
          : '',
      razonSocial: cliente?.razonSocial ?? '',
      regimenFiscal: cliente?.regimenFiscal ?? '',
      codigoPostalFiscal: cliente?.codigoPostalFiscal ?? '',
      usoCFDI: cliente?.usoCFDI ?? USO_CFDI_DEFAULT,
    },
  });

  // Los regímenes válidos dependen de si es persona física o moral.
  const tipoActual = useWatch({ control, name: 'tipo' }) ?? cliente?.tipo ?? 'INDIVIDUAL';
  const regimenes = regimenesPara(tipoActual);

  const submit = handleSubmit((v) => {
    const base = {
      nombre: v.nombre,
      tipo: v.tipo,
      telefono: v.telefono ? v.telefono : undefined,
      email: v.email ? v.email : undefined,
      rfc: v.rfc ? v.rfc.toUpperCase() : undefined,
      notas: v.notas ? v.notas : undefined,
      sucursalId: v.sucursalId ? v.sucursalId : null,
      razonSocial: v.razonSocial ? v.razonSocial : undefined,
      regimenFiscal: v.regimenFiscal ? v.regimenFiscal : undefined,
      codigoPostalFiscal: v.codigoPostalFiscal ? v.codigoPostalFiscal : undefined,
      usoCFDI: v.usoCFDI ? v.usoCFDI : undefined,
      // El backend rechaza este campo si el rol no es gerencia; no lo mandamos.
      ...(esGerencia ? { lineaCredito: parseMontoEntero(v.lineaCredito ?? '') } : {}),
    };
    onSubmit(isEdit ? { ...base, activo: v.activo } : base);
  });

  return (
    <form onSubmit={submit} noValidate>
      <Field label="Nombre comercial" htmlFor="nombre" error={errors.nombre?.message}>
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
          <Input
            id="telefono"
            type="tel"
            inputMode="tel"
            placeholder="998-123-4567"
            className="font-mono"
            {...conMascara(register('telefono'), maskTelefono)}
          />
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

      <div className="grid grid-cols-2 gap-4">
        <Field label="RFC (opcional)" htmlFor="rfc" error={errors.rfc?.message}>
          <Input id="rfc" {...register('rfc')} maxLength={13} className="font-mono uppercase" />
        </Field>
        {esGerencia ? (
          <Field label="Línea de crédito ($)" htmlFor="lineaCredito">
            <Input
              id="lineaCredito"
              inputMode="numeric"
              placeholder="vacío = contado"
              className="font-mono"
              {...conMascara(register('lineaCredito'), formatMontoEntero)}
            />
          </Field>
        ) : null}
      </div>

      {/* Datos fiscales: sin esto Alegra no puede timbrar el CFDI. */}
      <fieldset className="mb-5 rounded-lg border border-slate-200 bg-paper px-4 py-4">
        <legend className="px-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
          Datos de facturación
        </legend>
        <p className="mb-3 text-xs text-slate-500">
          Necesarios solo si el cliente va a pedir factura. La factura se emite en Alegra, pero
          estos datos viajan desde aquí.
        </p>

        <Field
          label="Razón social (como en la Constancia de Situación Fiscal)"
          htmlFor="razonSocial"
          error={errors.razonSocial?.message}
        >
          <Input id="razonSocial" {...register('razonSocial')} placeholder="Igual que en el SAT" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Régimen fiscal"
            htmlFor="regimenFiscal"
            error={errors.regimenFiscal?.message}
          >
            <Select id="regimenFiscal" {...register('regimenFiscal')}>
              <option value="">Sin especificar</option>
              {regimenes.map((r) => (
                <option key={r.clave} value={r.clave}>
                  {r.clave} — {r.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Código postal fiscal"
            htmlFor="codigoPostalFiscal"
            error={errors.codigoPostalFiscal?.message}
          >
            <Input
              id="codigoPostalFiscal"
              inputMode="numeric"
              maxLength={5}
              placeholder="77500"
              className="font-mono"
              {...register('codigoPostalFiscal')}
              aria-invalid={Boolean(errors.codigoPostalFiscal)}
            />
          </Field>
        </div>

        <Field label="Uso del CFDI" htmlFor="usoCFDI" error={errors.usoCFDI?.message}>
          <Select id="usoCFDI" {...register('usoCFDI')}>
            <option value="">Sin especificar</option>
            {USOS_CFDI.map((u) => (
              <option key={u.clave} value={u.clave}>
                {u.clave} — {u.nombre}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

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
