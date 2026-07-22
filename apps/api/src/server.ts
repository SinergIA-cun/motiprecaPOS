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
import { reintentarClientesPendientes } from './lib/alegra/push.js';
import { asegurarSuscripciones, barridoReconciliacion } from './lib/alegra/suscripciones.js';
import { cajaRoutes } from './routes/caja.js';
import { clienteRoutes } from './routes/clientes.js';
import { configRoutes } from './routes/config.js';
import { cotizacionRoutes } from './routes/cotizaciones.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { healthRoutes } from './routes/health.js';
import { productoRoutes } from './routes/productos.js';
import { publicoRoutes } from './routes/publico.js';
import { sucursalRoutes } from './routes/sucursales.js';
import { syncRoutes } from './routes/sync.js';
import { ventaRoutes } from './routes/ventas.js';
import { usuarioRoutes } from './routes/usuarios.js';
import { webhookRoutes } from './routes/webhooks.js';

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
await app.register(publicoRoutes);
await app.register(webhookRoutes);
await app.register(authRoutes);
await app.register(sucursalRoutes);
await app.register(usuarioRoutes);
await app.register(clienteRoutes);
await app.register(productoRoutes);
await app.register(cotizacionRoutes);
await app.register(dashboardRoutes);
await app.register(configRoutes);
await app.register(ventaRoutes);
await app.register(cajaRoutes);
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

// Asegura la regla de aprobación por defecto (nivel 1 = Administrador) en
// cualquier entorno: la migración crea la tabla pero no siembra la fila.
try {
  await prisma.nivelAprobacion.upsert({
    where: { nivel: 1 },
    update: {},
    create: {
      nivel: 1,
      nombre: 'Administrador',
      rolAprobador: 'ADMINISTRADOR',
      descuentoMinimo: 15,
      montoMinimo: 50_000,
    },
  });
} catch (err) {
  app.log.error({ err }, 'No se pudo asegurar la regla de aprobación por defecto');
}

// §14: expiración automática — al vencer la vigencia, la cotización se marca
// EXPIRADA (se puede reactivar desde el detalle, con aviso de revisar precios).
async function expirarVencidas(): Promise<void> {
  try {
    const vencidas = await prisma.cotizacion.findMany({
      where: {
        estado: { in: ['ABIERTA', 'PENDIENTE_APROBACION_INTERNA', 'APROBADA'] },
        vigenciaHasta: { lt: new Date() },
      },
      select: { id: true, estado: true },
    });
    for (const c of vencidas) {
      // Guarda por estado: si otro proceso ya la expiró, no duplica la bitácora.
      const res = await prisma.cotizacion.updateMany({
        where: { id: c.id, estado: c.estado },
        data: { estado: 'EXPIRADA' },
      });
      if (res.count === 0) continue;
      await prisma.historialCotizacion.create({
        data: {
          cotizacionId: c.id,
          estadoAnterior: c.estado,
          estadoNuevo: 'EXPIRADA',
          comentario: 'Expirada automáticamente al vencer su vigencia',
        },
      });
    }
    if (vencidas.length > 0) {
      app.log.info(`Cotizaciones expiradas automáticamente: ${vencidas.length}`);
    }
  } catch (err) {
    app.log.error({ err }, 'Error al expirar cotizaciones vencidas');
  }
}
await expirarVencidas();
setInterval(() => void expirarVencidas(), 60 * 60 * 1000); // cada hora

// Alegra: re-aseguramos las suscripciones de webhook en cada arranque (Alegra
// las borra tras 10 fallos seguidos de entrega) y dejamos corriendo el barrido
// de reconciliación como red por si se pierde algún evento.
void asegurarSuscripciones(app.log, {
  apiPublicUrl: env.API_PUBLIC_URL,
  secreto: env.ALEGRA_WEBHOOK_SECRET,
});
// Al arrancar reintentamos empujar los clientes que quedaron pendientes/error
// (barato: solo re-empuja los que fallaron). Así un despliegue sana de
// inmediato los clientes que no se sincronizaron, sin esperar al barrido.
void reintentarClientesPendientes()
  .then((r) => {
    if (r.ok || r.fallidos) app.log.info(r, 'Reintento de clientes pendientes con Alegra');
  })
  .catch((err: unknown) => app.log.warn({ err }, 'Reintento de clientes pendientes falló'));
setInterval(() => void barridoReconciliacion(app.log), 6 * 60 * 60 * 1000); // cada 6 h

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
