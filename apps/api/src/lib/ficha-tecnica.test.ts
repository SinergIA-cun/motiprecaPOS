import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  leerFilaFicha,
  medidasDesdeTexto,
  revisarSuperficie,
  TOLERANCIA_SUPERFICIE,
} from './ficha-tecnica.ts';

describe('leerFilaFicha', () => {
  it('lee los cinco campos de una fila completa', () => {
    const fila = leerFilaFicha({
      codigo: 'cel-013',
      piezas_por_m2: '11',
      familia: 'Vibrocomprimida',
      dimensiones_cm: '30 x 30 x 10',
      superficie_m2: '0.0909',
      peso_kg: '10.6',
    });
    assert.ok(fila);
    assert.equal(fila.codigo, 'CEL-013', 'el código se normaliza a mayúsculas');
    assert.equal(fila.invalidos.length, 0);
    assert.deepEqual(fila.valores, [
      { columna: 'piezas_por_m2', valor: 11 },
      { columna: 'familia', valor: 'Vibrocomprimida' },
      { columna: 'dimensiones_cm', valor: '30 x 30 x 10' },
      { columna: 'superficie_m2', valor: 0.0909 },
      { columna: 'peso_kg', valor: 10.6 },
    ]);
  });

  it('omite las celdas vacías en vez de borrar el dato que ya había', () => {
    // El caso real: 4 celosías del catálogo no traen peso en el PDF.
    const fila = leerFilaFicha({
      codigo: 'CEL-039',
      piezas_por_m2: '6.25',
      peso_kg: '',
    });
    assert.ok(fila);
    assert.deepEqual(fila.valores, [{ columna: 'piezas_por_m2', valor: 6.25 }]);
    assert.equal(fila.invalidos.length, 0, 'una celda vacía no es un error');
  });

  it('trata una columna ausente igual que una vacía', () => {
    const fila = leerFilaFicha({ codigo: 'CEL-013', familia: 'Concreto' });
    assert.ok(fila);
    assert.deepEqual(fila.valores, [{ columna: 'familia', valor: 'Concreto' }]);
  });

  it('devuelve null cuando la fila no trae código', () => {
    // Excel deja renglones en blanco al final del archivo casi siempre.
    assert.equal(leerFilaFicha({ codigo: '', peso_kg: '10' }), null);
    assert.equal(leerFilaFicha({}), null);
  });

  it('acepta coma decimal porque Excel en español la escribe así', () => {
    const fila = leerFilaFicha({ codigo: 'CEL-013', superficie_m2: '0,0909' });
    assert.ok(fila);
    assert.deepEqual(fila.valores, [{ columna: 'superficie_m2', valor: 0.0909 }]);
  });

  it('redondea a la escala de la columna para no reportar lo que la BD trunca', () => {
    const fila = leerFilaFicha({
      codigo: 'CEL-013',
      superficie_m2: '0.090909', // Decimal(10,4)
      peso_kg: '10.6666', //        Decimal(10,3)
    });
    assert.ok(fila);
    assert.deepEqual(fila.valores, [
      { columna: 'superficie_m2', valor: 0.0909 },
      { columna: 'peso_kg', valor: 10.667 },
    ]);
  });

  it('rechaza lo que no es número sin tumbar el resto de la fila', () => {
    const fila = leerFilaFicha({
      codigo: 'CEL-013',
      piezas_por_m2: 'once',
      familia: 'Concreto',
    });
    assert.ok(fila);
    assert.deepEqual(fila.valores, [{ columna: 'familia', valor: 'Concreto' }]);
    assert.deepEqual(fila.invalidos, [
      { columna: 'piezas_por_m2', valor: 'once', motivo: 'No es un número' },
    ]);
  });

  it('rechaza ceros y negativos', () => {
    const fila = leerFilaFicha({ codigo: 'CEL-013', piezas_por_m2: '0', peso_kg: '-3' });
    assert.ok(fila);
    assert.equal(fila.valores.length, 0);
    assert.equal(fila.invalidos.length, 2);
    assert.ok(fila.invalidos.every((i) => i.motivo === 'Debe ser mayor a 0'));
  });

  it('rechaza valores fuera de rango', () => {
    const fila = leerFilaFicha({
      codigo: 'CEL-013',
      piezas_por_m2: '20000',
      superficie_m2: '500',
      peso_kg: '9000',
    });
    assert.ok(fila);
    assert.equal(fila.valores.length, 0);
    assert.equal(fila.invalidos.length, 3);
  });

  it('rechaza texto demasiado largo', () => {
    const fila = leerFilaFicha({ codigo: 'CEL-013', familia: 'x'.repeat(61) });
    assert.ok(fila);
    assert.equal(fila.valores.length, 0);
    assert.match(fila.invalidos[0]!.motivo, /60 caracteres/);
  });
});

describe('medidasDesdeTexto', () => {
  it('toma las dos primeras medidas e ignora el espesor', () => {
    assert.deepEqual(medidasDesdeTexto('30 x 30 x 10'), { largoCm: 30, anchoCm: 30 });
    assert.deepEqual(medidasDesdeTexto('39.5 x 49 x 4.6'), { largoCm: 39.5, anchoCm: 49 });
  });

  it('aguanta separadores y coma decimal', () => {
    assert.deepEqual(medidasDesdeTexto('45,5x7x6'), { largoCm: 45.5, anchoCm: 7 });
    assert.deepEqual(medidasDesdeTexto('20 × 20 cm'), { largoCm: 20, anchoCm: 20 });
  });

  it('devuelve null si no hay al menos dos números', () => {
    assert.equal(medidasDesdeTexto('30 cm'), null);
    assert.equal(medidasDesdeTexto('sin medidas'), null);
    assert.equal(medidasDesdeTexto(''), null);
  });
});

describe('revisarSuperficie', () => {
  it('no dice nada cuando las medidas y la superficie cuadran', () => {
    // Amaia: 30x30 → 0.09, declara 0.0909. Diferencia < 1%.
    assert.equal(revisarSuperficie('CEL-013', '30 x 30 x 10', 0.0909), null);
  });

  it('detecta el error de dedo real de la celosía Aura', () => {
    // El catálogo dice 25x25 (=0.0625 m²) pero declara 0.04, que es 20x20.
    const d = revisarSuperficie('CEL-021', '25 x 25 x 10', 0.04);
    assert.ok(d, 'debe avisar: cargar la equivalencia mala cotizaría 56% más piezas');
    assert.equal(d.superficieSegunMedidas, 0.0625);
    assert.equal(d.superficieDeclarada, 0.04);
    assert.equal(d.diferenciaPct, 56);
  });

  it('calla cuando falta cualquiera de los dos datos', () => {
    assert.equal(revisarSuperficie('X', undefined, 0.04), null);
    assert.equal(revisarSuperficie('X', '25 x 25', undefined), null);
    assert.equal(revisarSuperficie('X', 'sin medidas', 0.04), null);
  });

  it('deja pasar diferencias dentro de la tolerancia', () => {
    // Española: 75x45 = 0.3375 vs 0.3425 declarado ≈ 1.5%.
    assert.equal(revisarSuperficie('CEL-034', '75 x 45 x 7', 0.3425), null);
    // Justo en el límite tampoco avisa.
    const limite = 0.09 * (1 + TOLERANCIA_SUPERFICIE);
    assert.equal(revisarSuperficie('X', '30 x 30', limite), null);
  });

  it('avisa de las piezas no rectangulares, y eso está bien', () => {
    // La hexagonal cubre menos que su rectángulo envolvente por geometría, no
    // por error. Se reporta a propósito: el texto del aviso lo aclara y es
    // preferible a subir la tolerancia y dejar pasar errores reales.
    assert.ok(revisarSuperficie('CEL-028', '30.4 x 35 x 6', 0.0769));
  });
});
