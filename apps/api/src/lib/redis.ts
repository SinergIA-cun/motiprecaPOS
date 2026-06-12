import { Redis } from 'ioredis';
import { env } from './env.js';

/** Cliente Redis compartido (cache, blacklist de tokens, colas más adelante). */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});
