import { type JWTPayload, jwtVerify, SignJWT } from 'jose';
import { env } from './env.js';

const SECRET = new TextEncoder().encode(env.JWT_SECRET);
const ALG = 'HS256';

/** Access token de vida corta (regla #6: máx 15 min, configurable por env). */
export function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES)
    .sign(SECRET);
}

/** Verifica el access token. Lanza si es inválido o expiró. */
export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALG] });
  return payload;
}
