// Resolución de la cantidad de una partida (cotización o venta).
//
// Regla que sostiene todo esto: `cantidad` SIEMPRE se guarda en piezas, porque
// es lo que ve Alegra y lo que surte almacén. El m² es una forma de capturar.
//
// El cálculo vive en el servidor a propósito. El navegador también lo hace para
// mostrar el resultado en vivo, pero su número no se guarda: si confiáramos en
// él, cualquiera podría mandar `cantidadM2: 2, cantidad: 500` y llevarse 500
// piezas al precio de dos metros.
import { convertirM2APiezas } from '@motipreca/shared';
import { validationError } from './errors.js';

/** Lo que manda el cliente para una partida. */
export interface CapturaInput {
  cantidad?: number;
  unidadCaptura: 'PZA' | 'M2';
  cantidadM2?: number;
  mermaPct: number;
}

/** Lo que necesitamos del producto para resolverla. */
export interface ProductoParaCaptura {
  nombre: string;
  /** Unidad de venta propia del producto. */
  unidad: string;
  /** Prisma entrega Decimal; aceptamos number para poder testear sin DB. */
  piezasPorM2: { toString(): string } | number | null;
}

export interface CantidadResuelta {
  /** Piezas a vender (entero cuando viene de m²). */
  cantidad: number;
  unidadCaptura: 'PZA' | 'M2';
  /** m² solicitados por el cliente, o null si se capturó en piezas. */
  cantidadM2: number | null;
  mermaPct: number;
}

function equivalencia(prod: ProductoParaCaptura): number | null {
  if (prod.piezasPorM2 == null) return null;
  const n = typeof prod.piezasPorM2 === 'number' ? prod.piezasPorM2 : Number(prod.piezasPorM2);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Convierte la captura del vendedor en piezas.
 *
 * @throws validationError (400) con el nombre del producto, para que el
 *   vendedor sepa cuál de las partidas corregir.
 */
export function resolverCantidad(it: CapturaInput, prod: ProductoParaCaptura): CantidadResuelta {
  if (it.unidadCaptura === 'M2') {
    // Un producto que ya se vende por m² no se convierte: su cantidad YA es
    // superficie y su precio es por m². Convertirlo a piezas y multiplicar daría
    // un total disparatado, así que se rechaza en vez de cobrar mal.
    if (prod.unidad === 'M2') {
      throw validationError(
        `"${prod.nombre}" ya se vende por m²: captura los metros directamente como cantidad.`,
      );
    }
    const eq = equivalencia(prod);
    if (eq === null) {
      throw validationError(
        `"${prod.nombre}" no tiene equivalencia de piezas por m². Captúralo en piezas o carga su equivalencia.`,
      );
    }
    if (it.cantidadM2 == null || !(it.cantidadM2 > 0)) {
      throw validationError(`Indica los m² de "${prod.nombre}".`);
    }
    const conv = convertirM2APiezas(it.cantidadM2, eq, it.mermaPct);
    return {
      cantidad: conv.piezas,
      unidadCaptura: 'M2',
      cantidadM2: conv.m2Solicitados,
      mermaPct: it.mermaPct,
    };
  }

  if (it.cantidad == null || !(it.cantidad > 0)) {
    throw validationError(`Indica la cantidad de "${prod.nombre}".`);
  }
  // La merma solo tiene sentido sobre superficie: en piezas se ignora, para que
  // no quede un % guardado que nadie aplicó.
  return { cantidad: it.cantidad, unidadCaptura: 'PZA', cantidadM2: null, mermaPct: 0 };
}
