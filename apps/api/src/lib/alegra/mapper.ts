// Mapeo puro Alegra → modelos de Motipreca (sin I/O, testeable).
import { EstadoSync, TipoCliente, TipoProducto, Unidad } from '@motipreca/database';
import {
  USO_CFDI_DEFAULT,
  alegraRegimeDesdeClave,
  claveDesdeAlegraRegime,
} from '@motipreca/shared';
import type { AlegraContact, AlegraContactPayload, AlegraItem, AlegraItemPrice } from './client.js';

// Alegra entrega unidades en código UN/CEFACT, no en nombre. Traducimos a
// nuestro enum; lo no reconocido cae en PZA (default razonable para catálogo).
const UNIDAD_MAP: Record<string, Unidad> = {
  KGM: Unidad.KG,
  H87: Unidad.PZA,
  C62: Unidad.PZA,
  EA: Unidad.PZA,
  MTK: Unidad.M2,
  MTR: Unidad.ML,
  LTR: Unidad.LT,
  MTQ: Unidad.M3,
  TNE: Unidad.TON,
  SET: Unidad.JGO,
};

export function mapUnidad(code?: string | null): Unidad {
  if (!code) return Unidad.PZA;
  return UNIDAD_MAP[code.trim().toUpperCase()] ?? Unidad.PZA;
}

// RFC de 12 dígitos = persona moral (empresa); 13 = persona física (individual).
export function tipoClienteFromRfc(rfc?: string | null): TipoCliente {
  return (rfc ?? '').trim().length === 12 ? TipoCliente.EMPRESA : TipoCliente.INDIVIDUAL;
}

function cleanStr(value?: string | null): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Precio principal de la lista de precios de Alegra, redondeado a 2 decimales
// (precioBase es Decimal(12,2): mayor precisión se truncaría en la BD).
export function mainPrice(item: AlegraItem): number {
  const prices: AlegraItemPrice[] = item.price ?? [];
  const main = prices.find((p) => p.main) ?? prices[0];
  return Math.round((main?.price ?? 0) * 100) / 100;
}

export function isCliente(contact: AlegraContact): boolean {
  return (contact.type ?? []).includes('client');
}

export function mapContactToCliente(contact: AlegraContact) {
  return {
    nombre: contact.name.trim(),
    tipo: tipoClienteFromRfc(contact.identification),
    rfc: cleanStr(contact.identification)?.toUpperCase(),
    email: cleanStr(contact.email)?.toLowerCase(),
    telefono: cleanStr(contact.phonePrimary) ?? cleanStr(contact.mobile),
    // En Alegra `name` ES la razón social (así están los 150 contactos reales),
    // así que sirve para los dos campos: el comercial y el fiscal.
    razonSocial: contact.name.trim(),
    regimenFiscal: claveDesdeAlegraRegime(contact.regime),
    codigoPostalFiscal: cleanStr(contact.address?.zipCode),
    usoCFDI: cleanStr(contact.cfdiUse),
    alegraId: String(contact.id),
    estadoSync: EstadoSync.SINCRONIZADO,
  };
}

// NOTA HISTÓRICA — no volver a hacer esto:
// aquí vivía `REGIMEN_DEFAULT = 'SIMPLIFIED_REGIME'`, que se enviaba a TODO
// contacto nuevo porque Motipos no capturaba el régimen. El resultado real fue
// que "Constructora del Caribe SA de CV" (contacto 365 de Alegra) quedó con
// régimen simplificado, sin domicilio fiscal y sin uso de CFDI — una persona
// moral marcada con un régimen que no le corresponde. Contabilidad tenía que
// corregirlo a mano o el SAT rechazaba el timbrado.
//
// Ahora el régimen se captura en Motipos y se manda tal cual; si no lo tenemos,
// se OMITE el campo. Es preferible que Alegra conserve lo que ya tenía (o que
// falle el alta y quede en estadoSync) que escribir un dato fiscal falso.

/** País por defecto (código de Alegra). Motipreca opera en México; Alegra exige
 *  el país en la dirección al crear el contacto. */
export const PAIS_DEFAULT = 'MEX';

interface ClienteParaAlegra {
  nombre: string;
  rfc?: string | null;
  email?: string | null;
  telefono?: string | null;
  razonSocial?: string | null;
  regimenFiscal?: string | null;
  codigoPostalFiscal?: string | null;
  usoCFDI?: string | null;
}

/** Motipreca → Alegra. Inverso de mapContactToCliente.
 *
 *  `name` lleva la RAZÓN SOCIAL cuando la hay: es el nombre que va en el CFDI y
 *  el que usan todos los contactos reales de Motipreca en Alegra. El `nombre`
 *  comercial (con el que los vendedores buscan) se queda en Motipos. */
export function mapClienteToContact(cliente: ClienteParaAlegra): AlegraContactPayload {
  const regime = alegraRegimeDesdeClave(cliente.regimenFiscal);
  const zipCode = cleanStr(cliente.codigoPostalFiscal);

  const payload: AlegraContactPayload = {
    name: (cleanStr(cliente.razonSocial) ?? cliente.nombre).trim(),
    identification: cleanStr(cliente.rfc)?.toUpperCase(),
    email: cleanStr(cliente.email)?.toLowerCase(),
    phonePrimary: cleanStr(cliente.telefono),
    type: ['client'],
    thirdType: 'NATIONAL',
    address: zipCode ? { country: PAIS_DEFAULT, zipCode } : { country: PAIS_DEFAULT },
    // 149 de los 150 contactos reales de Motipreca usan G03; el único sin valor
    // es el que creó Motipos con el push incompleto.
    cfdiUse: cleanStr(cliente.usoCFDI) ?? USO_CFDI_DEFAULT,
  };

  // Sin régimen NO se manda el campo: mejor que Alegra conserve el suyo a que
  // escribamos uno inventado. PENDIENTE DE VERIFICAR con Fer: si Alegra exige
  // `regime` al CREAR un contacto, el alta fallará y quedará en estadoSync
  // hasta que se capture el dato — que es justo lo que queremos que pase.
  if (regime) payload.regime = regime;

  return payload;
}

export function mapItemToProducto(item: AlegraItem) {
  return {
    codigo: (cleanStr(item.reference) ?? `ALG-${item.id}`).toUpperCase(),
    nombre: item.name.trim(),
    descripcion: cleanStr(item.description),
    categoria: cleanStr(item.category?.name),
    unidad: mapUnidad(item.inventory?.unit),
    tipoProducto: item.inventory ? TipoProducto.STOCK_MINIMO : TipoProducto.BAJO_PEDIDO,
    precioBase: mainPrice(item),
    alegraId: String(item.id),
    estadoSync: EstadoSync.SINCRONIZADO,
  };
}
