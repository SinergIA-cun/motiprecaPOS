import { z } from 'zod';

// Convierte '' (campos vacíos de formularios) en undefined para que `.optional()` aplique.
const emptyToUndefined = (v: unknown): unknown => (v === '' ? undefined : v);

const prefijoFolioSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,4}$/, 'El prefijo debe ser de 2 a 4 letras (ej. CUN)');

const telefonoOpcional = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(7, 'Teléfono inválido').max(20, 'Teléfono demasiado largo').optional(),
);

const emailOpcional = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email('Correo inválido').optional(),
);

/** Alta de sucursal (solo Admin). El prefijo de folio se fija al crear. */
export const createSucursalSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto'),
  prefijoFolio: prefijoFolioSchema,
  direccion: z.string().trim().min(3, 'La dirección es muy corta'),
  telefono: telefonoOpcional,
  email: emailOpcional,
});

/** Edición de sucursal. El prefijo NO es editable (está ligado a los folios emitidos). */
export const updateSucursalSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto').optional(),
  direccion: z.string().trim().min(3, 'La dirección es muy corta').optional(),
  telefono: telefonoOpcional,
  email: emailOpcional,
  activa: z.boolean().optional(),
});

export type CreateSucursalInput = z.infer<typeof createSucursalSchema>;
export type UpdateSucursalInput = z.infer<typeof updateSucursalSchema>;
