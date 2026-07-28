/**
 * IVA único del sistema (MVP: tasa general del 16%, sin productos exentos ni
 * frontera). Vive aquí porque lo usan los totales del cotizador, los del POS y
 * la lectura de las descripciones de Alegra — tres copias del mismo número era
 * pedir que un día dejaran de coincidir.
 */
export const IVA_RATE = 0.16;

/** Agrega IVA a un importe sin impuestos. */
export function conIva(importeSinIva: number): number {
  return importeSinIva * (1 + IVA_RATE);
}
