import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { syncFromAlegra } from '../lib/alegra/sync.js';

// Sincronización con Alegra: escribe catálogo y clientes → solo Gerente/Admin.
const gestor = { preHandler: [authenticate, authorize('GERENTE', 'ADMINISTRADOR')] };

/** Mensaje legible incluyendo la causa (undici envuelve los errores de red en `cause`). */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return 'Error desconocido';
  const cause = (error as { cause?: unknown }).cause;
  const causeMsg = cause instanceof Error ? ` (causa: ${cause.message})` : '';
  return `${error.message}${causeMsg}`;
}

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  // ---- POST /sync/alegra ----  trae contactos (clientes) e items de Alegra.
  app.post('/sync/alegra', gestor, async (request) => {
    try {
      const data = await syncFromAlegra();
      return { ok: true, data };
    } catch (error) {
      const message = describeError(error);
      request.log.error({ err: error, reqId: request.id }, 'Sincronización con Alegra falló');
      // 200 deliberado: el proxy de EasyPanel enmascara los 5xx con su propia
      // página de error y oculta el cuerpo. Devolvemos el fallo como reporte
      // para que el cliente (y la UI) vean la causa real.
      return { ok: false, error: message };
    }
  });
}
