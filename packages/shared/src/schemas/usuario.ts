import { z } from 'zod';

const emptyToUndefined = (v: unknown): unknown => (v === '' ? undefined : v);

/** Roles válidos (coinciden con el enum Rol de Prisma). */
export const rolSchema = z.enum([
  'ASESOR',
  'CAJERO',
  'JEFE_DEPARTAMENTO',
  'GERENTE',
  'ADMINISTRADOR',
]);

const inicialesSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-ZÑ]{2,4}$/, 'Las iniciales deben ser de 2 a 4 letras');

const passwordSchema = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres');

const telefonoOpcional = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(7, 'Teléfono inválido').max(20, 'Teléfono demasiado largo').optional(),
);

// En alta: '' o ausente -> null (sin sucursal). En edición: '' -> null (limpiar),
// ausente -> undefined (no cambiar).
const sucursalIdCreate = z.preprocess(
  (v: unknown) => (v === '' || v === undefined ? null : v),
  z.string().min(1).nullable(),
);
const sucursalIdUpdate = z.preprocess(
  (v: unknown) => (v === '' ? null : v),
  z.string().min(1).nullable().optional(),
);

/** Alta de usuario (solo Admin). El admin define la contraseña inicial. */
export const createUsuarioSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: passwordSchema,
  nombre: z.string().trim().min(2, 'El nombre es muy corto'),
  rol: rolSchema,
  iniciales: inicialesSchema,
  sucursalId: sucursalIdCreate,
  telefono: telefonoOpcional,
});

/** Edición de usuario. `password` presente = restablecer contraseña. */
export const updateUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto').optional(),
  rol: rolSchema.optional(),
  iniciales: inicialesSchema.optional(),
  sucursalId: sucursalIdUpdate,
  telefono: telefonoOpcional,
  activo: z.boolean().optional(),
  password: z.preprocess(emptyToUndefined, passwordSchema.optional()),
});

export type CreateUsuarioInput = z.infer<typeof createUsuarioSchema>;
export type UpdateUsuarioInput = z.infer<typeof updateUsuarioSchema>;
