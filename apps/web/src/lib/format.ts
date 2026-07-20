const moneyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const enteroFmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/** Formatea un monto (number o Decimal serializado como string) a moneda MXN. */
export function formatMoney(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return moneyFmt.format(Number.isFinite(n) ? n : 0);
}

// ---- Captura de montos "redondos" (línea de crédito, metas) ----
// Se muestran con separador de miles y sin centavos: 1,500,000.

/** Solo dígitos → "1,500,000". Cadena vacía si no hay dígitos. */
export function formatMontoEntero(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits ? enteroFmt.format(Number(digits)) : '';
}

/** "1,500,000" → 1500000. Devuelve null si no hay dígitos. */
export function parseMontoEntero(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

// ---- Teléfonos ----
// Formato local mexicano a 10 dígitos: 998-123-4567. Los dígitos extra se
// descartan al capturar; al mostrar, un número que no tenga 10 dígitos se
// devuelve tal cual (hay clientes viejos con formatos heredados).

const TEL_DIGITOS = 10;

/** Aplica la máscara mientras se escribe: "9981234567" → "998-123-4567". */
export function maskTelefono(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, TEL_DIGITOS);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Para mostrar. Si no son 10 dígitos, respeta lo que ya estaba guardado. */
export function formatTelefono(value?: string | null): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  return d.length === TEL_DIGITOS ? maskTelefono(d) : raw;
}
