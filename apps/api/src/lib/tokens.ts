import { randomBytes } from 'node:crypto';
import { redis } from './redis.js';

/**
 * Refresh tokens como valores opacos guardados en Redis (whitelist de sesión).
 * - Logout / rotación → se borra la clave (regla #9: logout invalida el refresh).
 * - Si un refresh ya rotado se reintenta, no existe en Redis → 401.
 * Esto cumple la intención de la "lista negra con TTL" con un default-deny más fuerte.
 */

export const REFRESH_COOKIE = 'motipreca_rt';
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días

const PREFIX = 'refresh:';

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export async function storeRefreshToken(token: string, userId: string): Promise<void> {
  await redis.set(`${PREFIX}${token}`, userId, 'EX', REFRESH_TTL_SECONDS);
}

export function getRefreshTokenUserId(token: string): Promise<string | null> {
  return redis.get(`${PREFIX}${token}`);
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await redis.del(`${PREFIX}${token}`);
}
