import { prisma } from '@motipreca/database';
import Fastify from 'fastify';
import { env } from './lib/env.js';
import { redis } from './lib/redis.js';
import { healthRoutes } from './routes/health.js';

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    // Nunca loguear secrets (regla de seguridad).
    redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token', '*.password'],
  },
});

await app.register(healthRoutes);

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
