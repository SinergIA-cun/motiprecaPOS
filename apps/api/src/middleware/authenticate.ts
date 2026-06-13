import { prisma } from '@motipreca/database';
import type { FastifyRequest } from 'fastify';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';

/**
 * preHandler de autenticación: valida el access token (Bearer) y carga el usuario
 * fresco desde la BD (rol/sucursal actuales; bloquea usuarios inactivos al instante).
 * Regla #15: requerido en todos los endpoints excepto login/health.
 */
export async function authenticate(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Falta el token de acceso');
  }

  const token = header.slice('Bearer '.length).trim();

  let userId: string;
  try {
    const payload = await verifyAccessToken(token);
    if (typeof payload.sub !== 'string') {
      throw new Error('Token sin sujeto');
    }
    userId = payload.sub;
  } catch {
    throw unauthorized('Token inválido o expirado');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
  if (!usuario || !usuario.activo) {
    throw unauthorized('Usuario no encontrado o inactivo');
  }

  request.user = {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    sucursalId: usuario.sucursalId,
    iniciales: usuario.iniciales,
  };
}
