import { randomUUID } from 'node:crypto';
import { prisma } from '@motipreca/database';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { env } from './lib/env.js';
import { AppError } from './lib/errors.js';
import { redis } from './lib/redis.js';
import { authRoutes } from './routes/auth.js';
import { clienteRoutes } from './routes/clientes.js';
import { cotizacionRoutes } from './routes/cotizaciones.js';
import { healthRoutes } from './routes/health.js';
import { productoRoutes } from './routes/productos.js';
import { sucursalRoutes } from './routes/sucursales.js';
import { syncRoutes } from './routes/sync.js';
import { usuarioRoutes } from './routes/usuarios.js';

const isProd = env.NODE_ENV === 'production';

const app = Fastify({
  genReqId: () => randomUUID(), // trace id por request (regla #47)
  logger: {
    level: env.LOG_LEVEL,
    // Nunca loguear secrets (regla #4).
    redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token', '*.password'],
  },
});

// ---- Plugins de seguridad (reglas #20, #21) ----
await app.register(helmet, {
  global: true,
  frameguard: { action: 'deny' }, // X-Frame-Options: DENY
  referrerPolicy: { policy: 'no-referrer' },
  hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  },
});

await app.register(cors, {
  origin: env.CORS_ORIGIN, // CORS estricto: sólo el frontend autorizado
  credentials: true,
});

await app.register(cookie);

await app.register(rateLimit, {
  global: true,
  max: 100, // 100 req/min por IP por defecto (regla #42)
  timeWindow: '1 minute',
  redis,
  errorResponseBuilder: () => ({
    error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
  }),
});

// ---- Respuesta de error estandarizada (regla #45), sin filtrar internals (regla #22) ----
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    reply.code(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  const err = error as { statusCode?: number; message?: string };
  const status = typeof err.statusCode === 'number' ? err.statusCode : 500;

  if (status >= 400 && status < 500) {
    reply
      .code(status)
      .send({ error: { code: 'BAD_REQUEST', message: err.message ?? 'Solicitud inválida' } });
    return;
  }

  request.log.error({ err: error, reqId: request.id }, 'Error no controlado');
  reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' } });
});

// ---- Rutas ----
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(sucursalRoutes);
await app.register(usuarioRoutes);
await app.register(clienteRoutes);
await app.register(productoRoutes);
await app.register(cotizacionRoutes);
await app.register(syncRoutes);

// ---- Graceful shutdown (regla #57) ----
async function shutdown(signal: string): Promise<void> {
  app.log.info(`Recibido ${signal}, cerrando conexiones...`);
  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal)
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        app.log.error({ err }, 'Error durante el shutdown');
        process.exit(1);
      });
  });
}

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
