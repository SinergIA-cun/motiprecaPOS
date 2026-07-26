// Conversión m² ↔ piezas para productos que se venden por superficie
// (adocreto, adopasto, celosías).
//
// Reglas del negocio, decididas con Motipreca:
//  1. Alegra solo maneja PIEZAS. `cantidad` siempre se guarda en piezas; el m²
//     es una forma de capturar, no una unidad de venta.
//  2. La merma (% extra por cortes y piezas rotas) se aplica sobre el m²
//     solicitado, ANTES de convertir a piezas.
//  3. El redondeo es hacia arriba y a PIEZA SUELTA — no a tarima. No se puede
//     vender media celosía.
//  4. Se reporta el m² REAL que cubren esas piezas, que casi nunca es igual al
//     solicitado. Mostrar el solicitado como si fuera el entregado sería mentir.

/** Merma sugerida por default (%). El vendedor la puede cambiar por partida. */
export const MERMA_PCT_DEFAULT = 5;

export interface ConversionM2 {
  /** Piezas a vender: entero, redondeado hacia arriba. */
  piezas: number;
  /** m² que pidió el cliente. */
  m2Solicitados: number;
  /** m² tras aplicar la merma. */
  m2ConMerma: number;
  /** m² que realmente cubren las piezas resultantes. */
  m2Real: number;
  /** Merma aplicada (%). */
  mermaPct: number;
}

/** Redondeo decimal explícito. `Math.round` solo llega a enteros. */
function redondear(n: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/**
 * m² → piezas.
 *
 * @param m2Solicitados  superficie que pide el cliente (> 0)
 * @param piezasPorM2    equivalencia del producto (> 0)
 * @param mermaPct       % extra por cortes (0–100)
 *
 * @throws si la equivalencia o la superficie no son usables. El llamador debe
 *   haber verificado que el producto tiene equivalencia; llegar aquí sin ella
 *   es un bug, no una entrada de usuario.
 */
export function convertirM2APiezas(
  m2Solicitados: number,
  piezasPorM2: number,
  mermaPct = 0,
): ConversionM2 {
  if (!Number.isFinite(piezasPorM2) || piezasPorM2 <= 0) {
    throw new Error('El producto no tiene equivalencia de piezas por m²');
  }
  if (!Number.isFinite(m2Solicitados) || m2Solicitados <= 0) {
    throw new Error('Los m² deben ser mayores a 0');
  }
  if (!Number.isFinite(mermaPct) || mermaPct < 0 || mermaPct > 100) {
    throw new Error('La merma debe estar entre 0 y 100%');
  }

  const m2ConMerma = redondear(m2Solicitados * (1 + mermaPct / 100), 4);

  // El redondeo a 6 decimales ANTES del ceil no es decorativo: mata el ruido
  // binario del punto flotante. Sin él, 1.1 m² × 10 pz/m² da 11.000000000000002
  // y `Math.ceil` cobraría 12 piezas en vez de 11.
  const piezas = Math.ceil(redondear(m2ConMerma * piezasPorM2, 6));

  return {
    piezas,
    m2Solicitados: redondear(m2Solicitados, 2),
    m2ConMerma,
    m2Real: redondear(piezas / piezasPorM2, 2),
    mermaPct,
  };
}

/** piezas → m² (para mostrar la superficie de una partida ya guardada). */
export function piezasAM2(piezas: number, piezasPorM2: number): number {
  if (!Number.isFinite(piezasPorM2) || piezasPorM2 <= 0) return 0;
  return redondear(piezas / piezasPorM2, 2);
}

/** Precio por m² equivalente, derivado del precio por pieza.
 *
 *  Informativo únicamente: el precio canónico es el de la pieza, porque es el
 *  que viene de Alegra y el que va a la factura. Un catálogo de $500/m² con 11
 *  pz/m² se guarda como $45.45/pza y aquí sale $499.95 — esa diferencia es
 *  deliberada, para que el total de Motipos SIEMPRE cuadre con Alegra. */
export function precioPorM2(precioUnitario: number, piezasPorM2: number): number {
  if (!Number.isFinite(piezasPorM2) || piezasPorM2 <= 0) return 0;
  return redondear(precioUnitario * piezasPorM2, 2);
}

/** ¿La equivalencia es un número usable? */
export function admiteM2(piezasPorM2: number | null | undefined): boolean {
  return piezasPorM2 != null && Number.isFinite(Number(piezasPorM2)) && Number(piezasPorM2) > 0;
}

/**
 * ¿Este producto se puede capturar en m²?
 *
 * Necesita equivalencia Y que su unidad de venta NO sea ya m². Si el producto se
 * vende y se cotiza por metro cuadrado (`unidad: 'M2'`, precio por m²), la
 * cantidad YA es superficie: convertirla a piezas y multiplicar por un precio
 * que es por m² daría un total disparatado. La conversión existe justo para lo
 * contrario — productos que se venden por pieza y el cliente mide en m².
 */
export function admiteCapturaM2(
  unidad: string | null | undefined,
  piezasPorM2: number | null | undefined,
): boolean {
  return unidad !== 'M2' && admiteM2(piezasPorM2);
}
