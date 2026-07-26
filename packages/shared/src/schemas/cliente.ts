import { z } from 'zod';
import { CLAVES_REGIMEN, CLAVES_USO_CFDI } from '../catalogos-sat.js';

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
/** Línea de crédito (plan §5). '' o null = sin crédito. Solo gerencia la edita. */
const lineaCreditoOpcional = z.preprocess(
  (v: unknown) => (v === '' || v === undefined ? undefined : v === null ? null : v),
  z.coerce.number().min(0, 'No puede ser negativa').nullable().optional(),
);

// ---- Datos fiscales (CFDI 4.0) ----
// Todos opcionales: un cliente de mostrador que no pide factura no tiene por
// qué traerlos. Se vuelven necesarios cuando la venta lleva `requiereFactura`.

/** Razón social exacta como aparece en la Constancia de Situación Fiscal.
 *  Distinta de `nombre`, que es el nombre comercial con el que lo buscan. */
const razonSocialOpcional = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(300, 'Razón social demasiado larga').optional(),
);
const regimenFiscalOpcional = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .refine((v) => CLAVES_REGIMEN.includes(v), 'Régimen fiscal no reconocido')
    .optional(),
);
const codigoPostalFiscalOpcional = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El código postal debe tener 5 dígitos')
    .optional(),
);
const usoCFDIOpcional = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .refine((v) => CLAVES_USO_CFDI.includes(v), 'Uso de CFDI no reconocido')
    .optional(),
);

const camposFiscales = {
  razonSocial: razonSocialOpcional,
  regimenFiscal: regimenFiscalOpcional,
  codigoPostalFiscal: codigoPostalFiscalOpcional,
  usoCFDI: usoCFDIOpcional,
};

/** Alta de cliente. */
export const createClienteSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto'),
  tipo: tipoClienteSchema.default('INDIVIDUAL'),
  telefono: telefonoOpcional,
  email: emailOpcional,
  rfc: rfcOpcional,
  notas: notasOpcional,
  sucursalId: sucursalIdCreate,
  lineaCredito: lineaCreditoOpcional,
  ...camposFiscales,
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
  lineaCredito: lineaCreditoOpcional,
  ...camposFiscales,
});

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type UpdateClienteInput = z.infer<typeof updateClienteSchema>;
