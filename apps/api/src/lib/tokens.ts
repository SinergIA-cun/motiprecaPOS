import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@motipreca/database';

/**
 * Refresh tokens como valores opacos guardados en Postgres (whitelist de sesión).
 * - Logout / rotación → se borra la fila (regla #9: logout invalida el refresh).
 * - Un refresh ya rotado no existe → 401. Default-deny.
 *
 * Vivían en Redis hasta nov-2026. Se movieron para quitar un servicio entero:
 * cuando el contenedor de Redis se cayó, el login completo dejó de funcionar
 * con el API vivo.
 *
 * Se guarda el SHA-256 del token, nunca el token en claro: con la base filtrada
 * no se pueden secuestrar sesiones. SHA-256 sin sal basta porque el token ya
 * trae 384 bits de azar; no es una contraseña que se pueda adivinar.
 */

export const REFRESH_COOKIE = 'motipreca_rt';
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function storeRefreshToken(token: string, userId: string): Promise<void> {
  const ahora = new Date();
  // Redis expiraba solo con TTL; aquí se limpia de paso. La tabla es chica
  // (una fila por sesión abierta) y `expiraEn` tiene índice, así que es barato.
  await prisma.sesionRefresh.deleteMany({ where: { expiraEn: { lt: ahora } } });
  await prisma.sesionRefresh.create({
    data: {
      tokenHash: hashToken(token),
      usuarioId: userId,
      expiraEn: new Date(ahora.getTime() + REFRESH_TTL_SECONDS * 1000),
    },
  });
}

/**
 * Valida el refresh y lo invalida en la MISMA operación (rotación).
 *
 * Antes era "leer y luego borrar" en dos pasos: dos refrescos simultáneos con
 * el mismo token pasaban los dos y abrían dos sesiones. Un solo DELETE …
 * RETURNING lo hace atómico: solo una petición encuentra la fila.
 *
 * Devuelve el id del usuario, o `null` si el token no existe o ya expiró.
 */
export async function consumeRefreshToken(token: string): Promise<string | null> {
  const filas = await prisma.$queryRaw<{ usuarioId: string; expiraEn: Date }[]>`
    DELETE FROM "SesionRefresh"
    WHERE "tokenHash" = ${hashToken(token)}
    RETURNING "usuarioId", "expiraEn"
  `;
  const fila = filas[0];
  if (!fila || fila.expiraEn.getTime() <= Date.now()) return null;
  return fila.usuarioId;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.sesionRefresh.deleteMany({ where: { tokenHash: hashToken(token) } });
}
