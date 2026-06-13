import { redis } from './redis.js';

/**
 * Throttle de login por cuenta (email), no por IP.
 * En una tienda todas las terminales comparten una IP pública (NAT); limitar por IP
 * bloquearía a toda la sucursal. Limitar por cuenta ataca el brute-force real.
 * Regla #10 (5 intentos / 15 min), reinterpretada por cuenta.
 */
const PREFIX = 'login_fail:';
const MAX_FAILS = 5;
const WINDOW_SECONDS = 15 * 60;

function key(email: string): string {
  return `${PREFIX}${email}`;
}

/** ¿La cuenta está bloqueada por exceso de intentos fallidos? */
export async function isLoginBlocked(email: string): Promise<boolean> {
  const value = await redis.get(key(email));
  return value !== null && Number(value) >= MAX_FAILS;
}

/** Registra un intento fallido e inicia la ventana de 15 min en el primero. */
export async function registerLoginFailure(email: string): Promise<void> {
  const count = await redis.incr(key(email));
  if (count === 1) {
    await redis.expire(key(email), WINDOW_SECONDS);
  }
}

/** Limpia el contador tras un login exitoso. */
export async function resetLoginFailures(email: string): Promise<void> {
  await redis.del(key(email));
}
