import { prisma } from '@motipreca/database';
import type { FastifyInstance } from 'fastify';
import { redis } from '../lib/redis.js';

/** Healthcheck sin auth: valida conexión a PostgreSQL y Redis. */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    let db: 'ok' | 'error' = 'error';
    let cache: 'ok' | 'error' = 'error';

    try {
      await prisma.$queryRaw`SELECT 1`;
      db = 'ok';
    } catch (err) {
      app.log.error({ err }, 'Healthcheck: fallo de conexión a PostgreSQL');
    }

    try {
      const pong = await redis.ping();
      cache = pong === 'PONG' ? 'ok' : 'error';
    } catch (err) {
      app.log.error({ err }, 'Healthcheck: fallo de conexión a Redis');
    }

    const healthy = db === 'ok' && cache === 'ok';
    reply.code(healthy ? 200 : 503);
    return { status: healthy ? 'ok' : 'degraded', db, redis: cache };
  });
}
