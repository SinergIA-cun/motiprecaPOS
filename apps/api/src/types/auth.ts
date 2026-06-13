import type { Rol } from '@motipreca/database';

/** Usuario autenticado adjuntado a la request por el middleware de autenticación. */
export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  sucursalId: string | null;
  iniciales: string;
}
