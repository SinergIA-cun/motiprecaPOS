const moneyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** Formatea un monto (number o Decimal serializado como string) a moneda MXN. */
export function formatMoney(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return moneyFmt.format(Number.isFinite(n) ? n : 0);
}
