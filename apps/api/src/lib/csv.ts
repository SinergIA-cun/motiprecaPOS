// Parser de CSV mínimo, suficiente para las plantillas de catálogo de Motipreca.
//
// Por qué no basta con `split(',')`: la plantilla de celosías trae notas con
// comas dentro ("error de dedo, es 0.0625"). Un split simple corre las columnas
// y la equivalencia se lee del campo equivocado.
//
// Soporta: comillas dobles, comas y saltos de línea dentro de comillas, "" como
// comilla escapada, CRLF y BOM. No soporta separadores distintos de la coma —
// si algún día llega un CSV con punto y coma (Excel en español), hay que
// detectar el separador aquí.

/** Separa una línea/documento CSV en filas de celdas. */
export function parseCsv(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, ''); // BOM que mete Excel
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let enComillas = false;

  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio[i];

    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          celda += '"';
          i += 1;
        } else {
          enComillas = false;
        }
      } else {
        celda += c;
      }
      continue;
    }

    if (c === '"') {
      enComillas = true;
    } else if (c === ',') {
      fila.push(celda);
      celda = '';
    } else if (c === '\n') {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else if (c !== '\r') {
      celda += c;
    }
  }
  // Última celda/fila si el archivo no termina en salto de línea.
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }

  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

/**
 * CSV con encabezado → lista de objetos indexados por nombre de columna.
 * Los encabezados se normalizan (minúsculas, sin espacios/acentos) para que
 * `PIEZAS_POR_M2`, `piezas por m2` y `Piezas_Por_M²` sean la misma columna.
 */
export function parseCsvConEncabezado(texto: string): {
  columnas: string[];
  filas: Record<string, string>[];
} {
  const crudas = parseCsv(texto);
  const encabezado = crudas[0];
  if (!encabezado) return { columnas: [], filas: [] };

  const columnas = encabezado.map(normalizarEncabezado);
  const filas = crudas.slice(1).map((f) => {
    const obj: Record<string, string> = {};
    columnas.forEach((col, idx) => {
      obj[col] = (f[idx] ?? '').trim();
    });
    return obj;
  });
  return { columnas, filas };
}

export function normalizarEncabezado(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos (diacríticos combinantes)
    .replace(/²/g, '2')
    .replace(/[\s-]+/g, '_');
}
