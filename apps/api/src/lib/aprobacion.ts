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
}

export interface ResultadoEvaluacion {
  requiere: boolean;
  /** "descuento", "monto", "descuento y monto", o null si no requiere. */
  motivo: string | null;
}

/**
 * Lógica OR: la cotización requiere aprobación si alcanza CUALQUIER disparador.
 * Un umbral de 0 hace que todo dispare (regla "todo va a aprobación" del plan §5).
 */
export function evaluarAprobacion(
  datos: DatosCotizacion,
  regla: ReglaAprobacion,
): ResultadoEvaluacion {
  const porDescuento =
    regla.descuentoMinimo !== null && datos.descuentoPctEfectivo >= regla.descuentoMinimo;
  const porMonto = regla.montoMinimo !== null && datos.total >= regla.montoMinimo;

  const motivos: string[] = [];
  if (porDescuento) motivos.push('descuento');
  if (porMonto) motivos.push('monto');

  return { requiere: motivos.length > 0, motivo: motivos.length > 0 ? motivos.join(' y ') : null };
}

/** % de descuento global a partir de los montos almacenados de la cotización. */
export function descuentoPctEfectivo(subtotalNeto: number, descuentoTotal: number): number {
  const bruto = subtotalNeto + descuentoTotal;
  if (bruto <= 0) return 0;
  return Math.round(((descuentoTotal / bruto) * 100 + Number.EPSILON) * 100) / 100;
}
