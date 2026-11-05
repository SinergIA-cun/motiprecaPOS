import { prisma } from '@motipreca/database';
import type { FastifyInstance } from 'fastify';

/** Healthcheck sin auth: valida la conexión a PostgreSQL, la única dependencia. */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'ok' };
    } catch (err) {
      app.log.error({ err }, 'Healthcheck: fallo de conexión a PostgreSQL');
      reply.code(503);
      return { status: 'degraded', db: 'error' };
    }
  });
}
