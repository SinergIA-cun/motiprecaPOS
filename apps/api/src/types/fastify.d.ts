import type { AuthUser } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Presente sólo en rutas protegidas por el middleware `authenticate`. */
    user?: AuthUser;
  }
}
