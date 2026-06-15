import { Redis } from 'ioredis';
import { env } from './env.js';

/** Cliente Redis compartido (cache, blacklist de tokens, colas más adelante). */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

// Sin un listener de 'error', un fallo de conexión de ioredis (Redis caído,
// password equivocado, corte de red) queda como "unhandled error event" y puede
// tumbar el proceso de Node. Lo registramos y dejamos que ioredis reintente solo.
redis.on('error', (err: unknown) => {
  console.error('[redis] error de conexión:', err instanceof Error ? err.message : err);
});
