// Datos de la empresa para el PDF/impresión de cotización (plan §13).
// TODO(Motipreca): confirmar datos bancarios reales.
// Los marcados como "(por confirmar)" son placeholders a reemplazar.

export const EMPRESA = {
  nombre: 'Motipreca',
  descripcion: 'Prefabricados de concreto',
  web: 'www.motipreca.com',
  // Solo datos bancarios de Motipreca (sin Petra/Mosaicos) — PENDIENTES de confirmar.
  banco: {
    banco: 'Banco (por confirmar)',
    titular: 'Motipreca (por confirmar)',
    cuenta: '0000 0000 0000 (por confirmar)',
    clabe: '000000000000000000 (por confirmar)',
  },
  // Motipreca no tiene YouTube (confirmado por Fer, jul 2026).
  redes: {
    facebook: 'facebook.com/Motipreca',
    instagram: 'instagram.com/motipreca',
  },
};

/** URL pública de la app (para el QR de verificación de la cotización). */
export const APP_PUBLIC_URL = 'https://motipos.somossinergia.com';
