/** Roles del sistema (mismo string que el enum Rol de Prisma en el backend). */
export type Rol = 'ASESOR' | 'CAJERO' | 'JEFE_DEPARTAMENTO' | 'GERENTE' | 'ADMINISTRADOR';

/** Usuario público que la API devuelve y el frontend consume. */
export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  sucursalId: string | null;
  iniciales: string;
}
