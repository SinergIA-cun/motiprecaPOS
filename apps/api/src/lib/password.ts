import { hash, verify } from '@node-rs/argon2';

/** Hash de password con argon2id (regla de seguridad #5). */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/** Verifica un password contra su hash argon2id. Devuelve false si no coincide. */
export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

// Hash dummy para igualar el tiempo de respuesta cuando el usuario no existe,
// evitando enumeración de cuentas por timing. No es un secreto (es un valor fijo).
let dummyHashPromise: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummyHashPromise ??= hash('motipreca-timing-equalizer');
  return dummyHashPromise;
}
