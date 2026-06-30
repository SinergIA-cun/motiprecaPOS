import { prisma } from '@motipreca/database';
import { updateReglaAprobacionSchema } from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { notFound, validationError } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const adminOnly = { preHandler: [authenticate, authorize('ADMINISTRADOR')] };

export async function configRoutes(app: FastifyInstance): Promise<void> {
  // ---- GET /config/aprobacion ----  regla de Fase 1 (nivel 1 = Administrador).
  app.get('/config/aprobacion', adminOnly, async () => {
    const regla = await prisma.nivelAprobacion.findUnique({ where: { nivel: 1 } });
    if (!regla) throw notFound('No hay regla de aprobación configurada');
    return { data: regla };
  });

  // ---- PUT /config/aprobacion ----  actualiza los umbrales OR (nivel 1).
  app.put('/config/aprobacion', adminOnly, async (request) => {
    const parsed = updateReglaAprobacionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const regla = await prisma.nivelAprobacion.update({
      where: { nivel: 1 },
      data: {
        descuentoMinimo: parsed.data.descuentoMinimo,
        montoMinimo: parsed.data.montoMinimo,
      },
    });
    return { data: regla };
  });
}
