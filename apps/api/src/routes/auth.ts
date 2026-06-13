import { prisma, type Usuario } from '@motipreca/database';
import { loginSchema } from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { env } from '../lib/env.js';
import { rateLimited, unauthorized, validationError } from '../lib/errors.js';
import { signAccessToken } from '../lib/jwt.js';
import { dummyHash, verifyPassword } from '../lib/password.js';
import { isLoginBlocked, registerLoginFailure, resetLoginFailures } from '../lib/login-throttle.js';
import {
  generateRefreshToken,
  getRefreshTokenUserId,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  revokeRefreshToken,
  storeRefreshToken,
} from '../lib/tokens.js';
import { authenticate } from '../middleware/authenticate.js';
import type { AuthUser } from '../types/auth.js';

const isProd = env.NODE_ENV === 'production';

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd, // sólo HTTPS en producción (regla #7)
  sameSite: 'strict' as const,
  path: '/auth',
  maxAge: REFRESH_TTL_SECONDS,
};

function toPublicUser(u: Usuario): AuthUser {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    sucursalId: u.sucursalId,
    iniciales: u.iniciales,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ---- POST /auth/login ----
  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const { email, password } = parsed.data;

    // Mensaje genérico siempre (no revelar si el email existe — regla #22).
    const genericFail = unauthorized('Correo o contraseña incorrectos');

    if (await isLoginBlocked(email)) {
      throw rateLimited(
        'Cuenta bloqueada temporalmente por intentos fallidos. Espera unos minutos.',
      );
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    // Siempre corre una verificación argon2 (real o dummy) para igualar el timing
    // y no delatar si el email existe.
    const ok = await verifyPassword(usuario?.passwordHash ?? (await dummyHash()), password);
    if (!usuario || !usuario.activo || !ok) {
      await registerLoginFailure(email);
      throw genericFail;
    }

    await resetLoginFailures(email);

    const accessToken = await signAccessToken(usuario.id);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(refreshToken, usuario.id);
    reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLoginAt: new Date() },
    });

    return { accessToken, user: toPublicUser(usuario) };
  });

  // ---- POST /auth/refresh ----
  app.post(
    '/auth/refresh',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
          keyGenerator: (request) => request.cookies[REFRESH_COOKIE] ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (!token) {
        throw unauthorized('Sin sesión activa');
      }

      const userId = await getRefreshTokenUserId(token);
      if (!userId) {
        reply.clearCookie(REFRESH_COOKIE, { path: '/auth' });
        throw unauthorized('Sesión inválida o expirada');
      }

      // Rotación: el refresh usado se invalida y se emite uno nuevo.
      await revokeRefreshToken(token);

      const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
      if (!usuario || !usuario.activo) {
        reply.clearCookie(REFRESH_COOKIE, { path: '/auth' });
        throw unauthorized('Usuario inactivo');
      }

      const newRefresh = generateRefreshToken();
      await storeRefreshToken(newRefresh, usuario.id);
      reply.setCookie(REFRESH_COOKIE, newRefresh, refreshCookieOptions);

      const accessToken = await signAccessToken(usuario.id);
      return { accessToken, user: toPublicUser(usuario) };
    },
  );

  // ---- POST /auth/logout ----
  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (token) {
      await revokeRefreshToken(token);
    }
    reply.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    return { ok: true };
  });

  // ---- GET /auth/me (protegido) ----
  app.get('/auth/me', { preHandler: [authenticate] }, async (request) => {
    return { user: request.user };
  });
}
