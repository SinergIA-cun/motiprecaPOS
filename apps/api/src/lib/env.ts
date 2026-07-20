import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

// En desarrollo carga el .env de la raíz del monorepo. En producción las variables
// vienen del entorno del contenedor: el archivo no existe y dotenv simplemente no
// hace nada (no sobreescribe variables ya presentes).
const thisDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(thisDir, '../../../../.env') });

/**
 * Validación de variables de entorno al arranque (regla de seguridad:
 * "validar que los secrets requeridos están presentes al startup").
 * Si falta algo crítico, el proceso no arranca.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  REDIS_URL: z.string().min(1, 'REDIS_URL es requerida'),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET es requerida'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET es requerida'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Integración Alegra (Fase 1.5). Opcional: la app arranca sin estas; el
  // cliente de Alegra falla con un mensaje claro si se intenta sincronizar
  // sin email/token configurados.
  ALEGRA_API_URL: z.string().url().default('https://api.alegra.com/api/v1'),
  ALEGRA_API_EMAIL: z.string().optional(),
  ALEGRA_API_TOKEN: z.string().optional(),
  // Segmento secreto de la URL del webhook. Alegra NO firma sus webhooks ni
  // permite headers propios, así que el secreto viaja en la ruta (sobre HTTPS)
  // y además nunca confiamos en el payload: re-consultamos el dato a su API.
  ALEGRA_WEBHOOK_SECRET: z.string().optional(),
  // URL pública de esta API (para registrar la suscripción en Alegra).
  API_PUBLIC_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // No imprimimos los valores, solo qué campos fallaron.
  console.error('❌ Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
