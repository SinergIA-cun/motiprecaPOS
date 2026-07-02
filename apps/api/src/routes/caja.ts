import { prisma } from '@motipreca/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

// Caja en efectivo (auditable). Registro interno del efectivo cobrado sin
// factura. NO es un módulo oculto: sólo Administrador (403 honesto para el
// resto), vive en el panel de Administración y cada consulta queda en bitácora.
const adminOnly = { preHandler: [authenticate, authorize('ADMINISTRADOR')] };
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Deja rastro de quién consultó la caja (regla del módulo: bitácora de accesos). */
async function registrarAcceso(request: FastifyRequest, ruta: string): Promise<void> {
  const usuarioId = request.user?.id;
  if (!usuarioId) return;
  await prisma.accesoCaja.create({ data: { usuarioId, ip: request.ip, ruta } });
}

export async function cajaRoutes(app: FastifyInstance): Promise<void> {
  // ---- GET /caja/efectivo ---- resumen por sucursal/mes + movimientos.
  app.get('/caja/efectivo', adminOnly, async (request) => {
    await registrarAcceso(request, 'consulta');

    const ventas = await prisma.venta.findMany({
      where: { esStandby: true },
      orderBy: { createdAt: 'desc' },
      include: {
        sucursal: { select: { id: true, nombre: true } },
        cliente: { select: { nombre: true } },
      },
    });

    // Agregación en memoria (dataset pequeño): por sucursal + mes (YYYY-MM).
    const grupos = new Map<
      string,
      { sucursal: string; mes: string; total: number; count: number }
    >();
    let totalGeneral = 0;
    for (const v of ventas) {
      const total = Number(v.total);
      totalGeneral += total;
      const mes = v.createdAt.toISOString().slice(0, 7);
      const key = `${v.sucursal.id}|${mes}`;
      const acc = grupos.get(key) ?? { sucursal: v.sucursal.nombre, mes, total: 0, count: 0 };
      acc.total += total;
      acc.count += 1;
      grupos.set(key, acc);
    }

    return {
      data: {
        totalGeneral: round2(totalGeneral),
        resumen: [...grupos.values()].map((g) => ({ ...g, total: round2(g.total) })),
        movimientos: ventas.map((v) => ({
          id: v.id,
          folio: v.folio,
          createdAt: v.createdAt,
          sucursal: v.sucursal.nombre,
          cliente: v.cliente?.nombre ?? null,
          total: v.total,
        })),
      },
    };
  });

  // ---- GET /caja/efectivo/accesos ---- la bitácora, visible (transparencia).
  app.get('/caja/efectivo/accesos', adminOnly, async (request) => {
    await registrarAcceso(request, 'accesos');
    const accesos = await prisma.accesoCaja.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { usuario: { select: { nombre: true, email: true } } },
    });
    return {
      data: accesos.map((a) => ({
        id: a.id,
        usuario: a.usuario.nombre,
        email: a.usuario.email,
        ip: a.ip,
        ruta: a.ruta,
        createdAt: a.createdAt,
      })),
    };
  });
}
