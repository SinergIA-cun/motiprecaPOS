import { z } from 'zod';

const emptyToUndefined = (v: unknown): unknown => (v === '' ? undefined : v);

export const tipoClienteSchema = z.enum(['INDIVIDUAL', 'EMPRESA']);

const telefonoOpcional = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(7, 'Teléfono inválido').max(20, 'Teléfono demasiado largo').optional(),
);
const emailOpcional = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email('Correo inválido').optional(),
);
const rfcOpcional = z.preprocess(
  emptyToUndefined,
  z.string().trim().toUpperCase().min(12, 'RFC inválido').max(13, 'RFC inválido').optional(),
);
const notasOpcional = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(1000, 'Notas demasiado largas').optional(),
);
const sucursalIdCreate = z.preprocess(
  (v: unknown) => (v === '' || v === undefined ? null : v),
  z.string().min(1).nullable(),
);
const sucursalIdUpdate = z.preprocess(
  (v: unknown) => (v === '' ? null : v),
  z.string().min(1).nullable().optional(),
);

/** Alta de cliente. */
export const createClienteSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto'),
  tipo: tipoClienteSchema.default('INDIVIDUAL'),
  telefono: telefonoOpcional,
  email: emailOpcional,
  rfc: rfcOpcional,
  notas: notasOpcional,
  sucursalId: sucursalIdCreate,
});

/** Edición de cliente. */
export const updateClienteSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto').optional(),
  tipo: tipoClienteSchema.optional(),
  telefono: telefonoOpcional,
  email: emailOpcional,
  rfc: rfcOpcional,
  notas: notasOpcional,
  sucursalId: sucursalIdUpdate,
  activo: z.boolean().optional(),
});

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type UpdateClienteInput = z.infer<typeof updateClienteSchema>;
