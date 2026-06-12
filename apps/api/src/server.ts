import Fastify from 'fastify';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = '0.0.0.0';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});

// Día 2 ampliará /health para validar conexión a BD (Postgres) y Redis.
app.get('/health', async () => {
  return { status: 'ok' };
});

async function start(): Promise<void> {
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
