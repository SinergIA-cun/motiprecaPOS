import { prisma } from '@motipreca/database';

/**
 * Throttle de login por cuenta (email), no por IP.
 * En una tienda todas las terminales comparten una IP pública (NAT); limitar por IP
 * bloquearía a toda la sucursal. Limitar por cuenta ataca el brute-force real.
 * Regla #10 (5 intentos / 15 min), reinterpretada por cuenta.
 *
 * Vivía en Redis hasta nov-2026; ahora es la tabla `IntentoLogin`. La ventana es
 * fija y arranca en el primer fallo, igual que antes con INCR + EXPIRE.
 */
const MAX_FAILS = 5;
const WINDOW_MINUTES = 15;

/** ¿La cuenta está bloqueada por exceso de intentos fallidos? */
export async function isLoginBlocked(email: string): Promise<boolean> {
  const fila = await prisma.intentoLogin.findUnique({ where: { email } });
  return fila !== null && fila.ventanaHasta > new Date() && fila.fallos >= MAX_FAILS;
}

/**
 * Registra un intento fallido.
 *
 * Un solo INSERT … ON CONFLICT para que dos intentos simultáneos no se pisen el
 * contador. Si la ventana anterior ya venció, reinicia en 1 con ventana nueva.
 *
 * El `::int` no es decorativo: Prisma manda los números como bigint y
 * `make_interval(mins => …)` solo acepta integer. Sin el cast, cada login
 * fallido respondía 500 en vez de 401.
 */
export async function registerLoginFailure(email: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "IntentoLogin" ("email", "fallos", "ventanaHasta")
    VALUES (${email}, 1, now() + make_interval(mins => ${WINDOW_MINUTES}::int))
    ON CONFLICT ("email") DO UPDATE SET
      "fallos" = CASE WHEN "IntentoLogin"."ventanaHasta" <= now()
                      THEN 1 ELSE "IntentoLogin"."fallos" + 1 END,
      "ventanaHasta" = CASE WHEN "IntentoLogin"."ventanaHasta" <= now()
                            THEN now() + make_interval(mins => ${WINDOW_MINUTES}::int)
                            ELSE "IntentoLogin"."ventanaHasta" END
  `;
}

/** Limpia el contador tras un login exitoso. */
export async function resetLoginFailures(email: string): Promise<void> {
  await prisma.intentoLogin.deleteMany({ where: { email } });
}
