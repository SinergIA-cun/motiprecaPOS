import { z } from 'zod';

const emptyToUndefined = (v: unknown): unknown => (v === '' ? undefined : v);

export const unidadSchema = z.enum(['M2', 'PZA', 'ML', 'KG', 'JGO', 'LT', 'M3', 'TON']);
export const tipoProductoSchema = z.enum(['BAJO_PEDIDO', 'STOCK_SIN_REPOSICION', 'STOCK_MINIMO']);

const codigoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, 'Código muy corto')
  .max(30, 'Código muy largo');
const descripcionOpcional = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(500, 'Descripción demasiado larga').optional(),
);
const categoriaOpcional = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(80, 'Categoría demasiado larga').optional(),
);
const precioSchema = z.coerce
  .number()
  .min(0, 'El precio no puede ser negativo')
  .max(99_999_999, 'Precio demasiado alto');

/** Alta de producto. */
export const createProductoSchema = z.object({
  codigo: codigoSchema,
  nombre: z.string().trim().min(2, 'El nombre es muy corto'),
  descripcion: descripcionOpcional,
  categoria: categoriaOpcional,
  unidad: unidadSchema.default('PZA'),
  tipoProducto: tipoProductoSchema.default('BAJO_PEDIDO'),
  precioBase: precioSchema,
});

/** Edición de producto. */
export const updateProductoSchema = z.object({
  codigo: codigoSchema.optional(),
  nombre: z.string().trim().min(2, 'El nombre es muy corto').optional(),
  descripcion: descripcionOpcional,
  categoria: categoriaOpcional,
  unidad: unidadSchema.optional(),
  tipoProducto: tipoProductoSchema.optional(),
  precioBase: precioSchema.optional(),
  activo: z.boolean().optional(),
});

export type CreateProductoInput = z.infer<typeof createProductoSchema>;
export type UpdateProductoInput = z.infer<typeof updateProductoSchema>;
