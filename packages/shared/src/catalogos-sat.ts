// Catálogos fiscales para que Alegra pueda timbrar el CFDI 4.0 sin corrección
// manual (plan §12.6 / facturación).
//
// PROCEDENCIA DE LOS DATOS — importante para quien mantenga esto:
// las claves y nombres son del catálogo público del SAT, pero la columna
// `alegra` NO está inventada: se extrajo leyendo los 150 contactos reales de la
// cuenta de Alegra de Motipreca (jul 2026, solo lectura). Los 9 regímenes de
// abajo son los que realmente aparecen ahí y cubren el 100% de su cartera.
//
// El catálogo del SAT tiene ~20 regímenes; los que faltan (606 Arrendamiento,
// 622 Agrícolas, 616 Sin obligaciones…) NO se listan porque no sabemos con qué
// nombre los llama Alegra y adivinarlo haría fallar el push. Para agregar uno:
// crear el contacto a mano en Alegra con ese régimen, leerlo con
// `GET /contacts/:id` y copiar el valor exacto de `regime` aquí.

export type AplicaA = 'MORAL' | 'FISICA' | 'AMBAS';

export interface RegimenFiscal {
  /** Clave del SAT (lo que va en el CFDI). */
  clave: string;
  nombre: string;
  /** Valor exacto del enum de Alegra (verificado contra su API). */
  alegra: string;
  aplicaA: AplicaA;
}

export const REGIMENES_FISCALES: readonly RegimenFiscal[] = [
  {
    clave: '601',
    nombre: 'General de Ley Personas Morales',
    alegra: 'GENERAL_REGIME_OF_MORAL_PEOPLE_LAW',
    aplicaA: 'MORAL',
  },
  {
    clave: '603',
    nombre: 'Personas Morales con Fines no Lucrativos',
    alegra: 'REGIME_OF_MORAL_PEOPLE_NOT_PROFIT',
    aplicaA: 'MORAL',
  },
  {
    clave: '605',
    nombre: 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
    alegra: 'SALARIED_REGIME',
    aplicaA: 'FISICA',
  },
  {
    clave: '611',
    nombre: 'Ingresos por Dividendos (socios y accionistas)',
    alegra: 'DIVIDEND_INCOME',
    aplicaA: 'FISICA',
  },
  {
    clave: '612',
    nombre: 'Personas Físicas con Actividades Empresariales y Profesionales',
    alegra: 'BUSINESS_ACTIVITIES_REGIME',
    aplicaA: 'FISICA',
  },
  {
    clave: '621',
    nombre: 'Incorporación Fiscal',
    alegra: 'FISCAL_INCORPORATION_REGIME',
    aplicaA: 'FISICA',
  },
  {
    clave: '624',
    nombre: 'Coordinados',
    alegra: 'REGIME_OF_THE_COORDINATED',
    aplicaA: 'MORAL',
  },
  {
    clave: '626',
    nombre: 'Régimen Simplificado de Confianza (RESICO)',
    alegra: 'REGIME_OF_TRUST',
    aplicaA: 'AMBAS',
  },
] as const;

export interface UsoCFDI {
  clave: string;
  nombre: string;
}

/** Usos de CFDI relevantes para venta de prefabricados de concreto. */
export const USOS_CFDI: readonly UsoCFDI[] = [
  { clave: 'G01', nombre: 'Adquisición de mercancías' },
  { clave: 'G02', nombre: 'Devoluciones, descuentos o bonificaciones' },
  { clave: 'G03', nombre: 'Gastos en general' },
  { clave: 'I01', nombre: 'Construcciones' },
  { clave: 'I08', nombre: 'Otra maquinaria y equipo' },
  { clave: 'S01', nombre: 'Sin efectos fiscales' },
  { clave: 'CP01', nombre: 'Pagos' },
] as const;

/** Uso de CFDI por default.
 *
 *  No es una preferencia nuestra: 149 de los 150 contactos reales de Motipreca
 *  en Alegra tienen `cfdiUse: "G03"`. El único sin valor es el que Motipos creó
 *  con el push incompleto. */
export const USO_CFDI_DEFAULT = 'G03';

const PORCLAVE = new Map(REGIMENES_FISCALES.map((r) => [r.clave, r]));

export function regimenPorClave(clave: string | null | undefined): RegimenFiscal | undefined {
  return clave ? PORCLAVE.get(clave) : undefined;
}

/** Clave SAT → enum de Alegra. `null` si no la conocemos: el llamador NO debe
 *  inventar un valor, mejor omitir el campo y que Alegra conserve el suyo. */
export function alegraRegimeDesdeClave(clave: string | null | undefined): string | null {
  return regimenPorClave(clave)?.alegra ?? null;
}

/** Enum de Alegra → clave SAT (para reflejar lo que ya existe en Alegra). */
export function claveDesdeAlegraRegime(alegra: string | null | undefined): string | null {
  if (!alegra) return null;
  return REGIMENES_FISCALES.find((r) => r.alegra === alegra)?.clave ?? null;
}

/** Regímenes ofrecibles según el tipo de cliente. */
export function regimenesPara(tipo: 'INDIVIDUAL' | 'EMPRESA'): readonly RegimenFiscal[] {
  const buscado: AplicaA = tipo === 'EMPRESA' ? 'MORAL' : 'FISICA';
  return REGIMENES_FISCALES.filter((r) => r.aplicaA === buscado || r.aplicaA === 'AMBAS');
}

export const CLAVES_REGIMEN = REGIMENES_FISCALES.map((r) => r.clave);
export const CLAVES_USO_CFDI = USOS_CFDI.map((u) => u.clave);
