import { Prisma, prisma } from '@motipreca/database';
import { createSucursalSchema, updateSucursalSchema } from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { conflict, notFound, validationError } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

// Todas las rutas de administración requieren sesión + rol Administrador (regla #16).
const adminOnly = { preHandler: [authenticate, authorize('ADMINISTRADOR')] };

export async function sucursalRoutes(app: FastifyInstance): Promise<void> {
  // ---- GET /sucursales?activa=true|false ----
  app.get('/sucursales', adminOnly, async (request) => {
    const { activa } = request.query as { activa?: string };
    const where: Prisma.SucursalWhereInput =
      activa === undefined ? {} : { activa: activa === 'true' };
    const data = await prisma.sucursal.findMany({ where, orderBy: { nombre: 'asc' } });
    return { data };
  });

  // ---- GET /sucursales/:id ----
  app.get('/sucursales/:id', adminOnly, async (request) => {
    const { id } = request.params as { id: string };
    const sucursal = await prisma.sucursal.findUnique({ where: { id } });
    if (!sucursal) throw notFound('Sucursal no encontrada');
    return { data: sucursal };
  });

  // ---- POST /sucursales ----
  app.post('/sucursales', adminOnly, async (request, reply) => {
    const parsed = createSucursalSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const { nombre, prefijoFolio, direccion, telefono, email } = parsed.data;

    const dup = await prisma.sucursal.findFirst({
      where: { OR: [{ nombre }, { prefijoFolio }] },
      select: { nombre: true, prefijoFolio: true },
    });
    if (dup) {
      throw conflict(
        dup.prefijoFolio === prefijoFolio
          ? `Ya existe una sucursal con el prefijo "${prefijoFolio}"`
          : `Ya existe una sucursal con el nombre "${nombre}"`,
      );
    }

    const sucursal = await prisma.sucursal.create({
      data: { nombre, prefijoFolio, direccion, telefono: telefono ?? null, email: email ?? null },
    });
    reply.code(201);
    return { data: sucursal };
  });

  // ---- PATCH /sucursales/:id ----
  app.patch('/sucursales/:id', adminOnly, async (request) => {
    const { id } = request.params as { id: string };
    const parsed = updateSucursalSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const existing = await prisma.sucursal.findUnique({ where: { id } });
    if (!existing) throw notFound('Sucursal no encontrada');

    const d = parsed.data;
    if (d.nombre && d.nombre !== existing.nombre) {
      const dup = await prisma.sucursal.findUnique({ where: { nombre: d.nombre } });
      if (dup) throw conflict(`Ya existe una sucursal con el nombre "${d.nombre}"`);
    }

    const data: Prisma.SucursalUpdateInput = {};
    if (d.nombre !== undefined) data.nombre = d.nombre;
    if (d.direccion !== undefined) data.direccion = d.direccion;
    if (d.telefono !== undefined) data.telefono = d.telefono;
    if (d.email !== undefined) data.email = d.email;
    if (d.activa !== undefined) data.activa = d.activa;

    const sucursal = await prisma.sucursal.update({ where: { id }, data });
    return { data: sucursal };
  });
}
