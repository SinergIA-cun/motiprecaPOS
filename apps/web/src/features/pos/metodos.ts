import type { MetodoPago } from '../../lib/api';

export const METODO_LABEL: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA_DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  MIXTO: 'Mixto',
};

/** Métodos seleccionables en el POS (pago único; "Mixto" se difiere). */
export const METODOS_POS: MetodoPago[] = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'TARJETA_DEBITO',
  'TARJETA_CREDITO',
];
