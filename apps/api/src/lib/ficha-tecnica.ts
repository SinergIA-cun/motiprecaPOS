/**
 * Lectura y validación de la ficha técnica que llega por CSV.
 *
 * Sin I/O ni Prisma a propósito: aquí vive solo el criterio de "qué es un dato
 * válido y qué cambió", que es lo que vale la pena probar. La ruta
 * (`routes/productos.ts`) se queda con la parte de base de datos.
 *
 * Son los cinco datos que Alegra NO guarda y Motipos sí necesita: la
 * equivalencia por m², la familia, las medidas, la superficie y el peso.
 */

/** Columnas de datos que entiende el importador, en el orden en que se reportan. */
export const CAMPOS_FICHA = [
  'piezas_por_m2',
  'familia',
  'dimensiones_cm',
  'superficie_m2',
  'peso_kg',
] as const;

export type CampoFicha = (typeof CAMPOS_FICHA)[number];

/** Nombre de la columna del CSV → propiedad de `Producto`. */
export const COLUMNA_A_CAMPO = {
  piezas_por_m2: 'piezasPorM2',
  familia: 'familia',
  dimensiones_cm: 'dimensionesCm',
  superficie_m2: 'superficieM2',
  peso_kg: 'pesoKg',
} as const satisfies Record<CampoFicha, string>;

export const ETIQUETA_CAMPO = {
  piezas_por_m2: 'piezas por m²',
  familia: 'familia',
  dimensiones_cm: 'dimensiones',
  superficie_m2: 'superficie',
  peso_kg: 'peso',
} as const satisfies Record<CampoFicha, string>;

export interface ValorFicha {
  columna: CampoFicha;
  valor: string | number;
}

export interface ErrorFicha {
  columna: CampoFicha;
  valor: string;
  motivo: string;
}

export interface FilaFicha {
  codigo: string;
  /** Datos válidos listos para guardar (ya redondeados a la escala de la columna). */
  valores: ValorFicha[];
  invalidos: ErrorFicha[];
}

/** Los `Decimal` de Postgres truncan lo que sobra. Redondeamos aquí para que lo
 *  que se reporta como guardado sea exactamente lo que quedó en la BD. */
function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/** Acepta coma decimal ("0,0909") porque Excel en español la escribe así. */
function aNumero(crudo: string): number | null {
  const limpio = crudo.replace(/\s/g, '').replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

interface ReglaNumero {
  max: number;
  decimales: number;
}

const REGLAS_NUMERO: Partial<Record<CampoFicha, ReglaNumero>> = {
  // La equivalencia y la superficie son Decimal(10,4); el peso, Decimal(10,3).
  piezas_por_m2: { max: 10_000, decimales: 4 },
  superficie_m2: { max: 100, decimales: 4 },
  peso_kg: { max: 5_000, decimales: 3 },
};

const LARGO_MAXIMO: Partial<Record<CampoFicha, number>> = {
  familia: 60,
  dimensiones_cm: 40,
};

/**
 * Lee una fila del CSV. Una celda vacía o ausente NO es un error: significa
 * "este dato no lo traigo, no lo toques" — así la misma plantilla sirve aunque
 * solo la mitad de las filas esté completa.
 *
 * Devuelve `null` si la fila no trae código (renglones en blanco al final del
 * archivo, que Excel genera con frecuencia).
 */
export function leerFilaFicha(fila: Record<string, string | undefined>): FilaFicha | null {
  const codigo = fila.codigo?.trim().toUpperCase();
  if (!codigo) return null;

  const valores: ValorFicha[] = [];
  const invalidos: ErrorFicha[] = [];

  for (const columna of CAMPOS_FICHA) {
    const crudo = fila[columna]?.trim() ?? '';
    if (crudo === '') continue;

    const regla = REGLAS_NUMERO[columna];
    if (!regla) {
      const largo = LARGO_MAXIMO[columna] ?? 100;
      if (crudo.length > largo) {
        invalidos.push({ columna, valor: crudo, motivo: `Más de ${largo} caracteres` });
        continue;
      }
      valores.push({ columna, valor: crudo });
      continue;
    }

    const n = aNumero(crudo);
    if (n === null) {
      invalidos.push({ columna, valor: crudo, motivo: 'No es un número' });
      continue;
    }
    if (n <= 0) {
      invalidos.push({ columna, valor: crudo, motivo: 'Debe ser mayor a 0' });
      continue;
    }
    if (n > regla.max) {
      invalidos.push({ columna, valor: crudo, motivo: `No puede pasar de ${regla.max}` });
      continue;
    }
    valores.push({ columna, valor: redondear(n, regla.decimales) });
  }

  return { codigo, valores, invalidos };
}

/**
 * Saca los dos primeros números de un texto de medidas: "30 x 30 x 10" → 30 y 30.
 * El tercero es el espesor y no entra en la superficie.
 */
export function medidasDesdeTexto(texto: string): { largoCm: number; anchoCm: number } | null {
  const numeros = texto.match(/\d+(?:[.,]\d+)?/g);
  if (!numeros || numeros.length < 2) return null;
  const largoCm = Number(numeros[0]!.replace(',', '.'));
  const anchoCm = Number(numeros[1]!.replace(',', '.'));
  if (!Number.isFinite(largoCm) || !Number.isFinite(anchoCm)) return null;
  if (largoCm <= 0 || anchoCm <= 0) return null;
  return { largoCm, anchoCm };
}

/** A partir de qué diferencia entre la superficie declarada y la que dan las
 *  medidas vale la pena avisar. Se eligió holgado (10%) porque las piezas no
 *  rectangulares —hexágono, círculo— legítimamente cubren menos que su
 *  rectángulo envolvente y no queremos ahogar el reporte en falsas alarmas. */
export const TOLERANCIA_SUPERFICIE = 0.1;

export interface Discrepancia {
  codigo: string;
  dimensiones: string;
  superficieDeclarada: number;
  superficieSegunMedidas: number;
  diferenciaPct: number;
}

/**
 * Compara la superficie declarada con la que resulta de las medidas.
 *
 * Vale la pena porque la plantilla real traía errores de dedo justo aquí: la
 * celosía Aura dice "25 x 25" pero 0.04 m², que es la superficie de una de
 * 20x20. Cargar la equivalencia equivocada haría cotizar 56% más piezas de las
 * necesarias, y nadie lo notaría hasta la obra.
 *
 * Devuelve `null` cuando falta cualquiera de los dos datos, o cuando cuadran.
 */
export function revisarSuperficie(
  codigo: string,
  dimensiones: string | undefined,
  superficieDeclarada: number | undefined,
): Discrepancia | null {
  if (!dimensiones || superficieDeclarada === undefined) return null;
  const medidas = medidasDesdeTexto(dimensiones);
  if (!medidas) return null;

  const superficieSegunMedidas = redondear((medidas.largoCm * medidas.anchoCm) / 10_000, 4);
  const diferencia = Math.abs(superficieSegunMedidas - superficieDeclarada) / superficieDeclarada;
  if (diferencia <= TOLERANCIA_SUPERFICIE) return null;

  return {
    codigo,
    dimensiones,
    superficieDeclarada,
    superficieSegunMedidas,
    diferenciaPct: Math.round(diferencia * 100),
  };
}
