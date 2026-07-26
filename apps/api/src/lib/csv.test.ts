import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { normalizarEncabezado, parseCsv, parseCsvConEncabezado } from './csv.ts';

describe('parseCsv', () => {
  it('separa celdas simples', () => {
    assert.deepEqual(parseCsv('a,b,c'), [['a', 'b', 'c']]);
  });

  it('respeta comas dentro de comillas', () => {
    assert.deepEqual(parseCsv('a,"b,c",d'), [['a', 'b,c', 'd']]);
  });

  it('entiende comillas escapadas', () => {
    assert.deepEqual(parseCsv('a,"dice ""hola""",b'), [['a', 'dice "hola"', 'b']]);
  });

  it('maneja CRLF y filas vacías', () => {
    assert.deepEqual(parseCsv('a,b\r\nc,d\r\n\r\n'), [
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('no pierde la última celda sin salto final', () => {
    assert.deepEqual(parseCsv('a,b\nc,d'), [
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('normalizarEncabezado', () => {
  it('unifica variantes de la misma columna', () => {
    const esperado = 'piezas_por_m2';
    for (const v of ['piezas_por_m2', 'PIEZAS_POR_M2', 'Piezas Por M2', 'piezas por m²']) {
      assert.equal(normalizarEncabezado(v), esperado, `falló con "${v}"`);
    }
  });

  it('quita acentos', () => {
    assert.equal(normalizarEncabezado('Código'), 'codigo');
    assert.equal(normalizarEncabezado('DIMENSIÓN'), 'dimension');
  });
});

describe('parseCsvConEncabezado sobre la plantilla real de celosías', () => {
  const csv = readFileSync(
    new URL('../../../../docs/catalogos/celosias-precios-plantilla.csv', import.meta.url),
    'utf8',
  );
  const { columnas, filas } = parseCsvConEncabezado(csv);

  it('reconoce las columnas que nos importan', () => {
    assert.ok(columnas.includes('codigo'), `columnas: ${columnas.join('|')}`);
    assert.ok(columnas.includes('piezas_por_m2'));
  });

  it('lee la equivalencia correcta aunque las notas traigan comas', () => {
    // Esta fila trae "error de dedo, es 0.0625" en la última columna SIN comillas
    // (la plantilla se escribió a mano). Esa coma parte la columna de notas en
    // dos, pero `piezas_por_m2` va antes, así que el dato que nos importa se lee
    // bien. Si algún día hay que conservar las notas completas, la plantilla
    // tiene que entrecomillar ese campo — no es cosa del parser.
    const mahahual = filas.find((f) => f.codigo === 'CEL-MAHAHUAL-VIB');
    assert.ok(mahahual, 'no se encontró CEL-MAHAHUAL-VIB');
    assert.equal(mahahual.piezas_por_m2, '16');
    assert.equal(mahahual.unidad, 'M2');
  });

  it('lee las demás equivalencias conocidas', () => {
    const porCodigo = new Map(filas.map((f) => [f.codigo, f.piezas_por_m2]));
    assert.equal(porCodigo.get('CEL-AMAIA-VIB'), '11');
    assert.equal(porCodigo.get('CEL-BACALAR-VIB'), '25');
  });

  it('todas las filas traen código', () => {
    for (const f of filas) assert.notEqual(f.codigo, '', JSON.stringify(f));
  });
});
