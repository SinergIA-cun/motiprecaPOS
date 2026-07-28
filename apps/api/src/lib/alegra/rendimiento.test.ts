import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluarRendimiento, leerRendimiento } from './rendimiento.ts';

// Descripciones copiadas tal cual de la cuenta real de Alegra (jul-2026).
const REAL_3D = 'Precio de referencia por m²: $754.00 MXN · Rendimiento: 12.5 piezas/m²';
const REAL_SIRENA =
  'Precio de referencia por m²: $155.00 MXN · Rendimiento: 6.75 piezas/m² (calculado como 1 / (0.26m x 0.57m); validar)';

describe('leerRendimiento', () => {
  it('lee el formato real de Alegra', () => {
    assert.deepEqual(leerRendimiento(REAL_3D), { piezasPorM2: 12.5, precioM2ConIva: 754 });
  });

  it('lee la variante que trae el cálculo entre paréntesis', () => {
    // Ojo: el paréntesis trae más números; no deben ganarle al rendimiento.
    assert.deepEqual(leerRendimiento(REAL_SIRENA), { piezasPorM2: 6.75, precioM2ConIva: 155 });
  });

  it('quita la coma de los miles', () => {
    const r = leerRendimiento(
      'Precio de referencia por m²: $1,379.31 MXN · Rendimiento: 25 piezas/m²',
    );
    assert.deepEqual(r, { piezasPorM2: 25, precioM2ConIva: 1379.31 });
  });

  it('tolera variantes de escritura', () => {
    assert.equal(leerRendimiento('Rendimiento: 16 pieza/m2')?.piezasPorM2, 16);
    assert.equal(leerRendimiento('rendimiento: 11.11 PIEZAS / M²')?.piezasPorM2, 11.11);
  });

  it('devuelve null cuando no hay rendimiento', () => {
    assert.equal(leerRendimiento('Adocreto rojo de 10x40'), null);
    assert.equal(leerRendimiento(''), null);
    assert.equal(leerRendimiento(null), null);
    assert.equal(leerRendimiento(undefined), null);
  });

  it('rechaza valores absurdos', () => {
    assert.equal(leerRendimiento('Rendimiento: 0 piezas/m²'), null);
    assert.equal(leerRendimiento('Rendimiento: 99999 piezas/m²'), null);
  });
});

describe('evaluarRendimiento', () => {
  it('verifica la equivalencia contra el precio (caso real)', () => {
    // $52.00 × 12.5 × 1.16 = $754.00 exacto.
    assert.deepEqual(evaluarRendimiento(REAL_3D, 52), { estado: 'verificado', piezasPorM2: 12.5 });
  });

  it('aguanta el redondeo con el que Motipreca publica', () => {
    // Amaia Vibro: $7.68 × 11.11 × 1.16 = $98.98 y la descripción dice $99.00.
    const r = evaluarRendimiento(
      'Precio de referencia por m²: $99.00 MXN · Rendimiento: 11.11 piezas/m²',
      7.68,
    );
    assert.equal(r.estado, 'verificado');
  });

  it('rechaza la equivalencia cuando el precio no reconcilia', () => {
    // Si la descripción dijera 25 pz/m² con ese precio, sobra por mucho: es el
    // caso que protege de guardar una equivalencia mal escrita.
    const r = evaluarRendimiento(
      'Precio de referencia por m²: $754.00 MXN · Rendimiento: 25 piezas/m²',
      52,
    );
    assert.equal(r.estado, 'incoherente');
    if (r.estado !== 'incoherente') return;
    assert.equal(r.piezasPorM2, 25);
    assert.equal(r.esperado, 1508);
    assert.equal(r.recibido, 754);
  });

  it('marca sin_verificar cuando no hay con qué comparar', () => {
    assert.deepEqual(evaluarRendimiento('Rendimiento: 16 piezas/m²', 10), {
      estado: 'sin_verificar',
      piezasPorM2: 16,
    });
    // Precio base en 0: la multiplicación no dice nada.
    assert.equal(evaluarRendimiento(REAL_3D, 0).estado, 'sin_verificar');
  });

  it('reporta ausente cuando la descripción no trae el dato', () => {
    assert.deepEqual(evaluarRendimiento('Celosía de concreto', 100), { estado: 'ausente' });
  });

  it('el IVA no es opcional en la cuenta', () => {
    // Sin considerar IVA, $52 × 12.5 = $650 y la descripción dice $754: si el
    // cálculo olvidara el IVA rechazaría los 209 productos buenos.
    const r = evaluarRendimiento(REAL_3D, 52);
    assert.equal(r.estado, 'verificado', 'el 16% tiene que estar en la comparación');
  });
});
