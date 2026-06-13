import type { Rol } from '@motipreca/database';
import type { preHandlerHookHandler } from 'fastify';
import { forbidden, unauthorized } from '../lib/errors.js';

/**
 * preHandler de roles (regla #16). Úsalo después de `authenticate`:
 *   { preHandler: [authenticate, authorize('ADMINISTRADOR')] }
 */
export function authorize(...roles: Rol[]): preHandlerHookHandler {
  return (request, _reply, done) => {
    if (!request.user) {
      throw unauthorized();
    }
    if (!roles.includes(request.user.rol)) {
      throw forbidden();
    }
    done();
  };
}
