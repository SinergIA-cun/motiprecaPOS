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

/** Piezas que cubren 1 m². '' o null = el producto no se vende por m². */
const piezasPorM2Opcional = z.preprocess(
  (v: unknown) => (v === '' || v === undefined ? undefined : v === null ? null : v),
  z.coerce
    .number()
    .positive('Debe ser mayor a 0')
    .max(10_000, 'Equivalencia demasiado alta')
    .nullable()
    .optional(),
);

/** Alta de producto. */
export const createProductoSchema = z.object({
  codigo: codigoSchema,
  nombre: z.string().trim().min(2, 'El nombre es muy corto'),
  descripcion: descripcionOpcional,
  categoria: categoriaOpcional,
  unidad: unidadSchema.default('PZA'),
  tipoProducto: tipoProductoSchema.default('BAJO_PEDIDO'),
  precioBase: precioSchema,
  piezasPorM2: piezasPorM2Opcional,
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
  piezasPorM2: piezasPorM2Opcional,
});

/** Carga masiva de equivalencias por CSV.
 *
 *  Solo actualiza `piezasPorM2` de productos que YA existen, buscándolos por
 *  código. NO crea productos: el catálogo es de Alegra (decisión de Fer, jul
 *  2026) y esta equivalencia es el único dato que Alegra no puede guardar. */
export const importarEquivalenciasSchema = z.object({
  csv: z.string().min(1, 'Pega el contenido del CSV'),
  /** true = solo reporta qué haría, sin escribir. */
  simular: z.boolean().default(false),
});

export type CreateProductoInput = z.infer<typeof createProductoSchema>;
export type UpdateProductoInput = z.infer<typeof updateProductoSchema>;
export type ImportarEquivalenciasInput = z.infer<typeof importarEquivalenciasSchema>;
