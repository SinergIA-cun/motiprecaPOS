import { z } from 'zod';

// Captura de cantidad por m² para productos que se venden por superficie.
// Compartido por las partidas de cotización (cotizacion.ts) y las del POS
// (venta.ts): las dos pantallas deben comportarse igual.
//
// Contrato con el servidor: cuando `unidadCaptura` es 'M2', el servidor IGNORA
// `cantidad` y la recalcula desde `cantidadM2` + `mermaPct` + la equivalencia
// del producto. El cliente puede mandar su cálculo para mostrarlo en pantalla,
// pero nunca es la fuente de verdad — si lo fuera, cualquiera podría pedir 100
// piezas al precio de 2.

export const unidadCapturaSchema = z.enum(['PZA', 'M2']);

const emptyToUndefined = (v: unknown): unknown => (v === '' ? undefined : v);

export const camposCaptura = {
  unidadCaptura: unidadCapturaSchema.default('PZA'),
  /** m² solicitados. Requerido cuando `unidadCaptura` es 'M2'. */
  cantidadM2: z.preprocess(
    emptyToUndefined,
    z.coerce.number().positive('Los m² deben ser mayores a 0').optional(),
  ),
  /** % extra por cortes y piezas rotas. Se aplica antes de convertir a piezas. */
  mermaPct: z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%').default(0),
};

/** Reglas cruzadas de una partida según cómo se capturó. */
export function validarCaptura(
  partida: { unidadCaptura: 'PZA' | 'M2'; cantidad?: number; cantidadM2?: number },
  ctx: z.RefinementCtx,
): void {
  if (partida.unidadCaptura === 'M2') {
    if (partida.cantidadM2 == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cantidadM2'],
        message: 'Indica los m² requeridos',
      });
    }
    return;
  }
  if (partida.cantidad == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cantidad'],
      message: 'Indica la cantidad de piezas',
    });
  }
}

export type UnidadCaptura = z.infer<typeof unidadCapturaSchema>;
