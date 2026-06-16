// @motipreca/shared — tipos, enums y validaciones Zod compartidos entre front y back.

export const APP_NAME = 'Motipreca' as const;

export * from './schemas/auth.js';
export * from './schemas/cliente.js';
export * from './schemas/cotizacion.js';
export * from './schemas/producto.js';
export * from './schemas/sucursal.js';
export * from './schemas/usuario.js';
export * from './types/user.js';
