import type { FastifyInstance } from 'fastify';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { syncFromAlegra } from '../lib/alegra/sync.js';

// Sincronización con Alegra: escribe catálogo y clientes → solo Gerente/Admin.
const gestor = { preHandler: [authenticate, authorize('GERENTE', 'ADMINISTRADOR')] };

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  // ---- POST /sync/alegra ----  trae contactos (clientes) e items de Alegra.
  app.post('/sync/alegra', gestor, async () => {
    try {
      const data = await syncFromAlegra();
      return { data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new AppError(502, 'INTERNAL_ERROR', `Sincronización con Alegra falló: ${message}`);
    }
  });
}
