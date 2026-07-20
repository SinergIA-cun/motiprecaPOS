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

/** ¿Hay credenciales de Alegra en el entorno? Sin esto no se sincroniza nada. */
export function alegraConfigurado(): boolean {
  return Boolean(env.ALEGRA_API_EMAIL && env.ALEGRA_API_TOKEN);
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

async function alegraWrite<T>(method: 'POST' | 'PUT', path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${env.ALEGRA_API_URL}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Alegra ${method} ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export function fetchContacts(limit = 30, start = 0): Promise<AlegraContact[]> {
  return alegraGet<AlegraContact[]>(`/contacts?limit=${limit}&start=${start}`);
}

/** Un contacto por id. Base del webhook: nunca confiamos en el payload entrante. */
export function fetchContact(id: string): Promise<AlegraContact> {
  return alegraGet<AlegraContact>(`/contacts/${encodeURIComponent(id)}`);
}

/** Payload de alta/edición de contacto en Alegra (campos que sí capturamos). */
export interface AlegraContactPayload {
  name: string;
  identification?: string;
  email?: string;
  phonePrimary?: string;
  type: string[];
  regime?: string;
  thirdType?: string;
}

export function createContact(payload: AlegraContactPayload): Promise<AlegraContact> {
  return alegraWrite<AlegraContact>('POST', '/contacts', payload);
}

export function updateContact(id: string, payload: AlegraContactPayload): Promise<AlegraContact> {
  return alegraWrite<AlegraContact>('PUT', `/contacts/${encodeURIComponent(id)}`, payload);
}

// ---- Suscripciones de webhooks ----
// Alegra elimina la suscripción tras 10 fallos consecutivos de entrega; por eso
// las re-aseguramos al arrancar y mantenemos un barrido de reconciliación.

export interface AlegraSubscription {
  id: string;
  event: string;
  url: string;
}

export function listSubscriptions(): Promise<AlegraSubscription[]> {
  return alegraGet<AlegraSubscription[]>('/webhooks/subscriptions');
}

export function createSubscription(event: string, url: string): Promise<AlegraSubscription> {
  return alegraWrite<AlegraSubscription>('POST', '/webhooks/subscriptions', { event, url });
}

export function fetchItems(limit = 30, start = 0): Promise<AlegraItem[]> {
  return alegraGet<AlegraItem[]>(`/items?limit=${limit}&start=${start}`);
}

// ---- Paginación ----
// Alegra tope su `limit` en 30 por página. Sin paginar solo veíamos los
// primeros 30 registros, que era exactamente el bug: catálogos y padrones más
// grandes quedaban invisibles para Motipos.

const PAGINA = 30;
/** Tope de seguridad: 100 páginas = 3,000 registros. Evita un bucle infinito
 *  si Alegra ignorara `start` y devolviera siempre la misma página. */
const MAX_PAGINAS = 100;

async function traerTodo<T>(pagina: (start: number) => Promise<T[]>): Promise<T[]> {
  const acumulado: T[] = [];
  for (let i = 0; i < MAX_PAGINAS; i += 1) {
    const lote = await pagina(i * PAGINA);
    acumulado.push(...lote);
    if (lote.length < PAGINA) return acumulado; // última página
  }
  return acumulado;
}

export function fetchAllContacts(): Promise<AlegraContact[]> {
  return traerTodo((start) => fetchContacts(PAGINA, start));
}

export function fetchAllItems(): Promise<AlegraItem[]> {
  return traerTodo((start) => fetchItems(PAGINA, start));
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
