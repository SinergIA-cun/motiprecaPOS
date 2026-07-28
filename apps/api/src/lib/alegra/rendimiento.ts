/**
 * Lee la equivalencia por m² que Motipreca ya escribe en la descripción de sus
 * productos en Alegra.
 *
 * Las 209 descripciones reales (jul-2026) tienen un solo formato:
 *
 *   "Precio de referencia por m²: $754.00 MXN · Rendimiento: 12.5 piezas/m²"
 *
 * Lo valioso es que trae DOS números, y eso permite **autovalidar** la
 * equivalencia sin ir a medir la pieza:
 *
 *   precioBase × piezasPorM2 × (1 + IVA) = precio de referencia por m²
 *
 * Se cumple en 209 de 209 con menos de 0.3% de desvío. O sea que el rendimiento
 * no es un dato suelto: es el número con el que Motipreca calculó el precio por
 * m² que publica. Si algún día una descripción trae la equivalencia mal escrita,
 * el precio deja de reconciliar y aquí se rechaza en vez de guardar basura.
 *
 * OJO con el IVA: `precioBase` viene de Alegra **sin** IVA y el precio de
 * referencia de la descripción **sí** lo incluye. No es un error de nadie, pero
 * explica por qué el $/m² que muestra Motipos (sin IVA, como todos sus precios)
 * nunca va a coincidir con el del catálogo impreso.
 */
import { IVA_RATE } from '@motipreca/shared';

/** "Rendimiento: 12.5 piezas/m²" → 12.5. Tolera "pieza/m2" y "piezas / m²". */
const RE_RENDIMIENTO = /([\d.,]+)\s*piezas?\s*\/\s*m\s*[²2]?/i;

/** "Precio de referencia por m²: $754.00 MXN" → 754. */
const RE_PRECIO_M2 = /por\s*m\s*[²2]?\s*:\s*\$?\s*([\d.,]+)/i;

/**
 * Margen al reconciliar el precio. Los datos reales se desvían como máximo 0.3%
 * (redondeos de Motipreca al publicar), y una equivalencia equivocada se desvía
 * 30% o más — así que 1% separa las dos cosas de sobra.
 */
export const TOLERANCIA_PRECIO = 0.01;

function aNumero(crudo: string | undefined): number | null {
  if (crudo === undefined) return null;
  // Los miles van con coma ("1,250.00") y no hay decimales con coma en estas
  // descripciones, así que la coma se quita en vez de convertirse en punto.
  const n = Number(crudo.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface Rendimiento {
  piezasPorM2: number;
  /** Precio por m² tal como lo publica el catálogo: CON IVA. */
  precioM2ConIva: number | null;
}

/** Saca los números de la descripción, sin juzgar si son coherentes. */
export function leerRendimiento(descripcion: string | null | undefined): Rendimiento | null {
  if (!descripcion) return null;
  const piezasPorM2 = aNumero(descripcion.match(RE_RENDIMIENTO)?.[1]);
  if (piezasPorM2 === null || piezasPorM2 > 10_000) return null;
  return {
    piezasPorM2,
    precioM2ConIva: aNumero(descripcion.match(RE_PRECIO_M2)?.[1]),
  };
}

export type VeredictoRendimiento =
  /** El precio reconcilia: la equivalencia se puede usar. */
  | { estado: 'verificado'; piezasPorM2: number }
  /** No hay con qué comprobar (sin precio en la descripción, o precio base 0). */
  | { estado: 'sin_verificar'; piezasPorM2: number }
  /** Los números de la descripción se contradicen: NO usar. */
  | { estado: 'incoherente'; piezasPorM2: number; esperado: number; recibido: number }
  /** La descripción no menciona rendimiento. */
  | { estado: 'ausente' };

/**
 * Lee la equivalencia y la contrasta contra el precio.
 *
 * `precioBase` es el precio por pieza de Alegra, sin IVA.
 */
export function evaluarRendimiento(
  descripcion: string | null | undefined,
  precioBase: number,
): VeredictoRendimiento {
  const leido = leerRendimiento(descripcion);
  if (!leido) return { estado: 'ausente' };

  const { piezasPorM2, precioM2ConIva } = leido;
  if (precioM2ConIva === null || precioBase <= 0) {
    return { estado: 'sin_verificar', piezasPorM2 };
  }

  const esperado = precioBase * piezasPorM2 * (1 + IVA_RATE);
  const desvio = Math.abs(esperado - precioM2ConIva) / precioM2ConIva;
  if (desvio > TOLERANCIA_PRECIO) {
    return {
      estado: 'incoherente',
      piezasPorM2,
      esperado: Math.round(esperado * 100) / 100,
      recibido: precioM2ConIva,
    };
  }
  return { estado: 'verificado', piezasPorM2 };
}
