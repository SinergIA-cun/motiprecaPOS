// Tests de la conversión m² ↔ piezas.
// Se corren con el runner nativo de Node (sin dependencias): `pnpm test`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { admiteCapturaM2, admiteM2, convertirM2APiezas, piezasAM2, precioPorM2 } from './m2.ts';

describe('convertirM2APiezas', () => {
  it('convierte m² exactos sin merma (adocreto huesito, 54 pz/m²)', () => {
    const r = convertirM2APiezas(2, 54);
    assert.equal(r.piezas, 108);
    assert.equal(r.m2Real, 2);
    assert.equal(r.m2ConMerma, 2);
  });

  it('redondea hacia arriba a pieza suelta cuando no cierra exacto', () => {
    // Celosía Amaia: 11 pz/m². 1.5 × 11 = 16.5 → 17 piezas.
    const r = convertirM2APiezas(1.5, 11);
    assert.equal(r.piezas, 17);
  });

  it('reporta el m² REAL que cubren las piezas, no el solicitado', () => {
    const r = convertirM2APiezas(1.5, 11);
    assert.equal(r.m2Solicitados, 1.5);
    assert.equal(r.m2Real, 1.55); // 17 / 11 = 1.5454…
    assert.notEqual(r.m2Real, r.m2Solicitados);
  });

  it('NO infla la cantidad por ruido de punto flotante', () => {
    // 1.1 × 10 = 11.000000000000002 en binario. Sin el redondeo previo al
    // ceil, esto cobraría 12 piezas en vez de 11.
    assert.equal(convertirM2APiezas(1.1, 10).piezas, 11);
    assert.equal(convertirM2APiezas(0.3, 10).piezas, 3);
    assert.equal(convertirM2APiezas(2.9, 100).piezas, 290);
    assert.equal(convertirM2APiezas(8.2, 5).piezas, 41);
  });

  it('aplica la merma sobre los m² antes de convertir', () => {
    // 2 m² + 5% = 2.10 m² × 54 = 113.4 → 114 piezas.
    const r = convertirM2APiezas(2, 54, 5);
    assert.equal(r.m2ConMerma, 2.1);
    assert.equal(r.piezas, 114);
    assert.equal(r.mermaPct, 5);
  });

  it('con merma 0 entrega lo mismo que sin merma', () => {
    assert.deepEqual(convertirM2APiezas(3, 16, 0), convertirM2APiezas(3, 16));
  });

  it('acepta equivalencias fraccionarias', () => {
    const r = convertirM2APiezas(2, 12.5);
    assert.equal(r.piezas, 25);
  });

  it('siempre entrega un entero de piezas', () => {
    for (const m2 of [0.01, 0.37, 1, 1.73, 12.4, 99.99]) {
      for (const eq of [11, 16, 25, 54, 12.5]) {
        const { piezas } = convertirM2APiezas(m2, eq, 5);
        assert.equal(Number.isInteger(piezas), true, `m2=${m2} eq=${eq} → ${piezas}`);
      }
    }
  });

  it('nunca entrega menos superficie de la solicitada', () => {
    for (const m2 of [0.5, 1.3, 2, 7.7, 40.2]) {
      for (const eq of [11, 16, 25, 54]) {
        const r = convertirM2APiezas(m2, eq);
        assert.ok(r.m2Real >= r.m2Solicitados - 0.01, `m2=${m2} eq=${eq} → ${r.m2Real}`);
      }
    }
  });

  it('rechaza un producto sin equivalencia', () => {
    assert.throws(() => convertirM2APiezas(2, 0), /equivalencia/);
    assert.throws(() => convertirM2APiezas(2, Number.NaN), /equivalencia/);
    assert.throws(() => convertirM2APiezas(2, -54), /equivalencia/);
  });

  it('rechaza superficies no positivas', () => {
    assert.throws(() => convertirM2APiezas(0, 54), /mayores a 0/);
    assert.throws(() => convertirM2APiezas(-2, 54), /mayores a 0/);
  });

  it('rechaza mermas fuera de rango', () => {
    assert.throws(() => convertirM2APiezas(2, 54, -1), /merma/i);
    assert.throws(() => convertirM2APiezas(2, 54, 101), /merma/i);
  });
});

describe('piezasAM2', () => {
  it('convierte de vuelta a superficie', () => {
    assert.equal(piezasAM2(108, 54), 2);
    assert.equal(piezasAM2(17, 11), 1.55);
  });

  it('devuelve 0 sin equivalencia usable en vez de Infinity', () => {
    assert.equal(piezasAM2(10, 0), 0);
  });
});

describe('precioPorM2', () => {
  it('deriva el precio por m² del precio por pieza', () => {
    assert.equal(precioPorM2(18.14, 54), 979.56);
  });

  it('expone la diferencia de centavos contra un catálogo en $/m²', () => {
    // $500/m² con 11 pz/m² se guarda como $45.45/pza → el m² sale en $499.95.
    // Es deliberado: el total debe cuadrar con la factura de Alegra.
    assert.equal(precioPorM2(45.45, 11), 499.95);
  });
});

describe('admiteM2', () => {
  it('acepta equivalencias válidas', () => {
    assert.equal(admiteM2(54), true);
    assert.equal(admiteM2(12.5), true);
  });

  it('rechaza ausencia o valores inservibles', () => {
    assert.equal(admiteM2(null), false);
    assert.equal(admiteM2(undefined), false);
    assert.equal(admiteM2(0), false);
    assert.equal(admiteM2(-1), false);
  });
});

describe('admiteCapturaM2', () => {
  it('acepta un producto por pieza con equivalencia', () => {
    assert.equal(admiteCapturaM2('PZA', 54), true);
    assert.equal(admiteCapturaM2('ML', 11), true);
  });

  it('RECHAZA un producto que ya se vende por m²', () => {
    // Su precio ya es por m² y su cantidad ya es superficie: convertir a piezas
    // y multiplicar daría un total disparatado.
    assert.equal(admiteCapturaM2('M2', 54), false);
  });

  it('rechaza cuando no hay equivalencia', () => {
    assert.equal(admiteCapturaM2('PZA', null), false);
  });
});
