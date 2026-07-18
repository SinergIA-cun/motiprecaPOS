// Crédito del cliente (plan §5): la línea se configura aquí; el adeudo se
// consulta EN VIVO a Alegra (suma de saldos de facturas abiertas del contacto).
// Caché en memoria corto para no golpear Alegra en cada render.
import { fetchOpenInvoicesByClient } from './alegra/client.js';

const CACHE_TTL_MS = 60_000;

export interface CreditoCliente {
  /** Línea máxima configurada localmente; null = sin crédito (contado). */
  lineaCredito: number | null;
  /** Saldo por cobrar en Alegra; null = sin vínculo o Alegra no disponible. */
  adeudo: number | null;
  /** lineaCredito − adeudo; null si falta alguno de los dos. */
  disponible: number | null;
  /** El cliente tiene alegraId (está sincronizado). */
  vinculado: boolean;
  /** Hubo vínculo pero Alegra no respondió o el contacto ya no existe. */
  errorAlegra: boolean;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const cache = new Map<string, { data: CreditoCliente; expira: number }>();

interface ClienteCredito {
  id: string;
  alegraId: string | null;
  lineaCredito: { toString(): string } | null;
}

/** Consulta el crédito de un cliente (adeudo vivo desde Alegra, con caché de 60s). */
export async function creditoDeCliente(cliente: ClienteCredito): Promise<CreditoCliente> {
  const hit = cache.get(cliente.id);
  if (hit && hit.expira > Date.now()) return hit.data;

  const lineaCredito = cliente.lineaCredito != null ? Number(cliente.lineaCredito) : null;
  let adeudo: number | null = null;
  let errorAlegra = false;

  if (cliente.alegraId) {
    try {
      const facturas = await fetchOpenInvoicesByClient(cliente.alegraId);
      // Defensa: re-filtra por cliente por si Alegra ignora el query param.
      const propias = facturas.filter(
        (f) => f.client?.id == null || String(f.client.id) === cliente.alegraId,
      );
      adeudo = round2(propias.reduce((s, f) => s + (Number(f.balance) || 0), 0));
    } catch {
      errorAlegra = true; // sin dato: el que decide (regla/UI) sabe que no se pudo verificar
    }
  }

  const data: CreditoCliente = {
    lineaCredito,
    adeudo,
    disponible: lineaCredito != null && adeudo != null ? round2(lineaCredito - adeudo) : null,
    vinculado: Boolean(cliente.alegraId),
    errorAlegra,
  };
  cache.set(cliente.id, { data, expira: Date.now() + CACHE_TTL_MS });
  return data;
}

/** Invalida el caché (ej. tras editar la línea de crédito del cliente). */
export function invalidarCreditoCache(clienteId: string): void {
  cache.delete(clienteId);
}
