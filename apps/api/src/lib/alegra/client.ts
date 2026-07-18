// Cliente REST de Alegra (solo lectura, Fase 1.5).
// Autenticación HTTP Basic con email:token (variables ALEGRA_API_* del entorno).
import { env } from '../env.js';

export interface AlegraContact {
  id: string;
  name: string;
  identification?: string | null;
  email?: string | null;
  phonePrimary?: string | null;
  mobile?: string | null;
  type?: string[];
}

export interface AlegraItemPrice {
  price: number;
  main?: boolean;
}

export interface AlegraItem {
  id: string;
  name: string;
  description?: string | null;
  reference?: string | null;
  category?: { id: string; name: string } | null;
  price?: AlegraItemPrice[];
  inventory?: { unit?: string | null } | null;
}

function authHeader(): string {
  const { ALEGRA_API_EMAIL: email, ALEGRA_API_TOKEN: token } = env;
  if (!email || !token) {
    throw new Error(
      'Alegra no está configurado: faltan ALEGRA_API_EMAIL / ALEGRA_API_TOKEN en el entorno.',
    );
  }
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

async function alegraGet<T>(path: string): Promise<T> {
  const res = await fetch(`${env.ALEGRA_API_URL}${path}`, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Alegra GET ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export function fetchContacts(limit = 30): Promise<AlegraContact[]> {
  return alegraGet<AlegraContact[]>(`/contacts?limit=${limit}`);
}

export function fetchItems(limit = 30): Promise<AlegraItem[]> {
  return alegraGet<AlegraItem[]>(`/items?limit=${limit}`);
}

export interface AlegraInvoice {
  id: string;
  status?: string | null;
  total?: number | string | null;
  balance?: number | string | null; // saldo pendiente de la factura
  client?: { id?: string | number | null } | null;
}

/** Facturas abiertas (con saldo) de un contacto de Alegra. */
export function fetchOpenInvoicesByClient(alegraClientId: string): Promise<AlegraInvoice[]> {
  return alegraGet<AlegraInvoice[]>(
    `/invoices?client_id=${encodeURIComponent(alegraClientId)}&status=open&limit=30`,
  );
}
