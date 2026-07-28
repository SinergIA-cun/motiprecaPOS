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

// Los campos de la ficha técnica se pueden BORRAR, no solo dejar sin tocar, así
// que distinguen `null` (bórralo) de `undefined` (no viene en esta petición).
// Un '' del formulario cuenta como "bórralo".
const borrable = (v: unknown): unknown => (v === '' ? null : v);

const textoBorrable = (max: number, etiqueta: string) =>
  z.preprocess(
    borrable,
    z.string().trim().max(max, `${etiqueta} demasiado largo`).nullable().optional(),
  );

const numeroBorrable = (max: number, etiqueta: string) =>
  z.preprocess(
    borrable,
    z.coerce
      .number()
      .positive('Debe ser mayor a 0')
      .max(max, `${etiqueta} demasiado alto`)
      .nullable()
      .optional(),
  );

/** Piezas que cubren 1 m². '' o null = el producto no se vende por m². */
const piezasPorM2Opcional = numeroBorrable(10_000, 'Equivalencia');
/** Agrupación propia de Motipreca ("Vibrocomprimida"). Distinta de `categoria`. */
const familiaOpcional = textoBorrable(60, 'Familia');
/** Medidas nominales del catálogo: "30 x 30 x 10". Texto libre a propósito. */
const dimensionesOpcional = textoBorrable(40, 'Dimensiones');
/** Superficie de UNA pieza en m². */
const superficieOpcional = numeroBorrable(100, 'Superficie');
/** Peso de UNA pieza en kg. */
const pesoOpcional = numeroBorrable(5_000, 'Peso');

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
  familia: familiaOpcional,
  dimensionesCm: dimensionesOpcional,
  superficieM2: superficieOpcional,
  pesoKg: pesoOpcional,
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
  familia: familiaOpcional,
  dimensionesCm: dimensionesOpcional,
  superficieM2: superficieOpcional,
  pesoKg: pesoOpcional,
});

/** Carga masiva de la ficha técnica por CSV.
 *
 *  Solo actualiza productos que YA existen, buscándolos por código. NO crea
 *  productos: el catálogo es de Alegra (decisión de Fer, jul 2026) y la ficha
 *  técnica es justo lo que Alegra no puede guardar. */
export const importarFichaSchema = z.object({
  csv: z.string().min(1, 'Pega el contenido del CSV'),
  /** true = solo reporta qué haría, sin escribir. */
  simular: z.boolean().default(false),
});

export type CreateProductoInput = z.infer<typeof createProductoSchema>;
export type UpdateProductoInput = z.infer<typeof updateProductoSchema>;
export type ImportarFichaInput = z.infer<typeof importarFichaSchema>;
