// Motor de evaluación de aprobación (Fase 1: 1 nivel, reglas OR).
// Función pura → testeable sin DB.

export interface ReglaAprobacion {
  /** % de descuento que dispara aprobación. `null` = disparador desactivado. */
  descuentoMinimo: number | null;
  /** Total ($) que dispara aprobación. `null` = disparador desactivado. */
  montoMinimo: number | null;
}

export interface DatosCotizacion {
  total: number;
  /** Descuento global efectivo de la cotización, en % (0–100). */
  descuentoPctEfectivo: number;
  /** Crédito del cliente (plan §5). `null` = cliente sin línea configurada (no aplica). */
  credito?: {
    /** lineaCredito − adeudo; `null` = no se pudo verificar el adeudo (Alegra). */
    disponible: number | null;
  } | null;
}

export interface ResultadoEvaluacion {
  requiere: boolean;
  /** "descuento", "monto", "crédito" o combinaciones ("descuento y monto"); null si no requiere. */
  motivo: string | null;
}

/**
 * Lógica OR: la cotización requiere aprobación si alcanza CUALQUIER disparador.
 * Un umbral de 0 hace que todo dispare (regla "todo va a aprobación" del plan §5).
 * Crédito (§5): si el cliente tiene línea configurada y el total excede su
 * disponible → aprobación. Sin dato de adeudo (Alegra caído / sin vínculo) se
 * es conservador: también va a aprobación, con motivo explícito.
 */
export function evaluarAprobacion(
  datos: DatosCotizacion,
  regla: ReglaAprobacion,
): ResultadoEvaluacion {
  const porDescuento =
    regla.descuentoMinimo !== null && datos.descuentoPctEfectivo >= regla.descuentoMinimo;
  const porMonto = regla.montoMinimo !== null && datos.total >= regla.montoMinimo;
  const credito = datos.credito ?? null;
  const porCredito =
    credito !== null && (credito.disponible === null || datos.total > credito.disponible);

  const motivos: string[] = [];
  if (porDescuento) motivos.push('descuento');
  if (porMonto) motivos.push('monto');
  if (porCredito) {
    motivos.push(credito?.disponible === null ? 'crédito (sin verificar en Alegra)' : 'crédito');
  }

  return { requiere: motivos.length > 0, motivo: motivos.length > 0 ? motivos.join(' y ') : null };
}

/** % de descuento global a partir de los montos almacenados de la cotización. */
export function descuentoPctEfectivo(subtotalNeto: number, descuentoTotal: number): number {
  const bruto = subtotalNeto + descuentoTotal;
  if (bruto <= 0) return 0;
  return Math.round(((descuentoTotal / bruto) * 100 + Number.EPSILON) * 100) / 100;
}
