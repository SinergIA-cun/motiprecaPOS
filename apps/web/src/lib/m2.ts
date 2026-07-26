// Helpers de UI para la captura en m². La matemática vive en @motipreca/shared
// (una sola fuente para front y back); aquí solo va lo que necesita la pantalla.
import { type ConversionM2, convertirM2APiezas } from '@motipreca/shared';

/**
 * Igual que `convertirM2APiezas` pero devuelve `null` en vez de lanzar.
 *
 * Necesario porque el usuario está escribiendo: mientras el campo de m² está
 * vacío o en "0.", la conversión es inválida y no queremos que un throw tumbe
 * el render en cada tecla.
 */
export function convertirSeguro(
  m2: number,
  piezasPorM2: number | null,
  mermaPct: number,
): ConversionM2 | null {
  if (piezasPorM2 == null || !(piezasPorM2 > 0) || !(m2 > 0)) return null;
  try {
    return convertirM2APiezas(m2, piezasPorM2, mermaPct);
  } catch {
    return null;
  }
}

/** Línea legible del cálculo, para que el vendedor vea de dónde salen las piezas. */
export function resumenCaptura(conv: ConversionM2 | null): string | null {
  if (!conv) return null;
  const merma = conv.mermaPct > 0 ? ` + ${conv.mermaPct}% merma` : '';
  return `${conv.m2Solicitados} m²${merma} → ${conv.piezas} pza (${conv.m2Real} m² reales)`;
}

/** Formato corto para documentos impresos: "114 pza (2.11 m²)". */
export function cantidadConM2(
  cantidad: number,
  cantidadM2: number | null,
  unidadCaptura: 'PZA' | 'M2',
  etiquetaUnidad: string,
): string {
  const base = `${cantidad} ${etiquetaUnidad}`;
  if (unidadCaptura !== 'M2' || cantidadM2 == null) return base;
  return `${base} (${cantidadM2} m²)`;
}
