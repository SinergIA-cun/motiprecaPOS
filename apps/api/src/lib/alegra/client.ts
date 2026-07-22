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

// ---- Serialización y reintentos ----
// Dos mecanismos, ambos necesarios (medido contra el Alegra real):
//
// 1) SERIALIZACIÓN: dejamos UNA sola solicitud en vuelo a la vez. Sin esto, el
//    sync disparaba contactos e items en paralelo y, como cada request tarda
//    ~4.5 s, se apilaban ~10 en vuelo y Alegra las rechazaba con 429.
//
// 2) REINTENTO HONRANDO `reset`: aun en serie, /contacts tiene un límite de
//    RÁFAGA de ventana corta (deja pasar ~5 páginas y luego 429, aunque quede
//    cupo de la ventana de 100/min). Alegra dice en `reset` cuántos segundos
//    faltan para reabrir; esperamos eso y reintentamos. Un backoff corto NO
//    alcanza —se midió—.
//
// Ojo: Alegra a veces envuelve el 429 como HTTP 400 con `"code":429` en el
// cuerpo, y la info del límite viaja en el cuerpo, no en headers.

const MAX_REINTENTOS = 5;
const ESPERA_MAX_MS = 35_000;
const TIMEOUT_MS = 25_000;

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cola de un solo carril: cada solicitud corre completa (fetch incluido) antes
// de soltar el turno a la siguiente. Garantiza una sola request en vuelo aunque
// haya llamados concurrentes (contactos e items del sync, o un chequeo de
// crédito durante el barrido). Un fallo no rompe la cadena: el turno se libera
// igual.
let cola: Promise<unknown> = Promise.resolve();
function enSerie<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = cola.then(fn, fn);
  cola = resultado.then(
    () => undefined,
    () => undefined,
  );
  return resultado;
}

interface RateInfo {
  esLimite: boolean;
  remaining: number | null;
  reset: number | null; // segundos hasta que se reabre la ventana
}

function aNumero(v: unknown): number | null {
  // Ojo: Number(null) === 0 y Number('') === 0, así que hay que descartar
  // vacíos ANTES de convertir; si no, un header ausente se leería como 0 y
  // taparía el valor real que viene en el cuerpo (bug real que teníamos).
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ¿La respuesta es un rate-limit? Alegra lo manda como status 429 o como 400
 *  con `"code":429` y la info del límite dentro del cuerpo (no en headers). */
function leerRate(res: Response, body: string): RateInfo {
  let remaining = aNumero(res.headers.get('x-rate-limit-remaining'));
  let reset = aNumero(res.headers.get('x-rate-limit-reset'));
  let code: number | null = null;
  try {
    const j = JSON.parse(body) as {
      code?: number;
      headers?: Record<string, unknown>;
    };
    code = aNumero(j.code);
    if (j.headers) {
      remaining = remaining ?? aNumero(j.headers['x-rate-limit-remaining']);
      reset = reset ?? aNumero(j.headers['x-rate-limit-reset']);
    }
  } catch {
    // cuerpo no-JSON: nos quedamos con lo de los headers
  }
  const esLimite =
    res.status === 429 || code === 429 || remaining === 0 || /too many requests/i.test(body);
  return { esLimite, remaining, reset };
}

/** Cuánto esperar antes de reintentar. Alegra nos dice en `reset` cuántos
 *  segundos faltan para que se reabra la ventana; lo honramos (con tope) porque
 *  el límite de ráfaga de /contacts solo se libera al reabrirse —un backoff
 *  corto no alcanza, como se midió—. Sin `reset`, backoff exponencial. */
function esperaTrasLimite(info: RateInfo, intento: number): number {
  if (info.reset && info.reset > 0) {
    return Math.min(info.reset * 1000 + 500, ESPERA_MAX_MS);
  }
  return Math.min(1000 * 2 ** intento, ESPERA_MAX_MS);
}

async function ejecutar<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  payload?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    Accept: 'application/json',
  };
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  const body = payload !== undefined ? JSON.stringify(payload) : undefined;

  for (let intento = 0; ; intento += 1) {
    // Signal nuevo por intento: AbortSignal.timeout cuenta desde su creación y
    // no se puede reusar tras un reintento.
    const res = await fetch(`${env.ALEGRA_API_URL}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return (await res.json()) as T;

    const texto = await res.text();
    const rate = leerRate(res, texto);
    if (rate.esLimite && intento < MAX_REINTENTOS) {
      await dormir(esperaTrasLimite(rate, intento));
      continue;
    }
    // Adjuntamos status y cuerpo parseado al error para que el llamador pueda
    // reaccionar (p. ej. RFC duplicado → vincular al contacto que ya existe).
    const err = new Error(
      `Alegra ${method} ${path} → ${res.status}: ${texto.slice(0, 300)}`,
    ) as AlegraError;
    err.status = res.status;
    try {
      err.body = JSON.parse(texto);
    } catch {
      err.body = undefined;
    }
    throw err;
  }
}

/** Error de Alegra con el status y el cuerpo parseado, para reaccionar al código. */
export interface AlegraError extends Error {
  status?: number;
  body?: { code?: number; message?: string; contactId?: string | number } & Record<string, unknown>;
}

function alegraGet<T>(path: string): Promise<T> {
  return enSerie(() => ejecutar<T>('GET', path));
}

function alegraWrite<T>(method: 'POST' | 'PUT', path: string, payload: unknown): Promise<T> {
  return enSerie(() => ejecutar<T>(method, path, payload));
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
  // Alegra exige el país en la dirección al crear un contacto ("El país es
  // obligatorio", code 2008). Motipos aún no captura domicilio, así que va el
  // país por defecto y contabilidad completa el resto antes de facturar.
  address?: { country: string };
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
