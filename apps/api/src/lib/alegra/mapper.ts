// Mapeo puro Alegra → modelos de Motipreca (sin I/O, testeable).
import { EstadoSync, TipoCliente, TipoProducto, Unidad } from '@motipreca/database';
import type { AlegraContact, AlegraItem, AlegraItemPrice } from './client.js';

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
    alegraId: String(contact.id),
    estadoSync: EstadoSync.SINCRONIZADO,
  };
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
