import { Prisma, prisma } from '@motipreca/database';
import { createClienteSchema, updateClienteSchema } from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { notFound, validationError } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';

// Módulo operativo: cualquier usuario autenticado gestiona clientes (regla #15).
const auth = { preHandler: [authenticate] };

async function ensureSucursal(sucursalId: string | null): Promise<void> {
  if (!sucursalId) return;
  const s = await prisma.sucursal.findUnique({ where: { id: sucursalId }, select: { id: true } });
  if (!s) throw validationError('La sucursal indicada no existe');
}

export async function clienteRoutes(app: FastifyInstance): Promise<void> {
  // ---- GET /clientes?q=&activo=&sucursalId= ----
  app.get('/clientes', auth, async (request) => {
    const q = request.query as { q?: string; activo?: string; sucursalId?: string };
    const where: Prisma.ClienteWhereInput = {};
    if (q.activo !== undefined) where.activo = q.activo === 'true';
    if (q.sucursalId) where.sucursalId = q.sucursalId;
    if (q.q?.trim()) {
      const term = q.q.trim();
      where.OR = [
        { nombre: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { rfc: { contains: term, mode: 'insensitive' } },
        { telefono: { contains: term } },
      ];
    }
    const data = await prisma.cliente.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      take: 200,
    });
    return { data };
  });

  // ---- GET /clientes/:id ----
  app.get('/clientes/:id', auth, async (request) => {
    const { id } = request.params as { id: string };
    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw notFound('Cliente no encontrado');
    return { data: cliente };
  });

  // ---- POST /clientes ----
  app.post('/clientes', auth, async (request, reply) => {
    const parsed = createClienteSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    await ensureSucursal(d.sucursalId);
    const cliente = await prisma.cliente.create({
      data: {
        nombre: d.nombre,
        tipo: d.tipo,
        telefono: d.telefono ?? null,
        email: d.email ?? null,
        rfc: d.rfc ?? null,
        notas: d.notas ?? null,
        sucursalId: d.sucursalId,
      },
    });
    reply.code(201);
    return { data: cliente };
  });

  // ---- PATCH /clientes/:id ----
  app.patch('/clientes/:id', auth, async (request) => {
    const { id } = request.params as { id: string };
    const parsed = updateClienteSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const existing = await prisma.cliente.findUnique({ where: { id } });
    if (!existing) throw notFound('Cliente no encontrado');

    const d = parsed.data;
    if (d.sucursalId) await ensureSucursal(d.sucursalId);

    const data: Prisma.ClienteUncheckedUpdateInput = {};
    if (d.nombre !== undefined) data.nombre = d.nombre;
    if (d.tipo !== undefined) data.tipo = d.tipo;
    if (d.telefono !== undefined) data.telefono = d.telefono;
    if (d.email !== undefined) data.email = d.email;
    if (d.rfc !== undefined) data.rfc = d.rfc;
    if (d.notas !== undefined) data.notas = d.notas;
    if (d.sucursalId !== undefined) data.sucursalId = d.sucursalId;
    if (d.activo !== undefined) data.activo = d.activo;

    const cliente = await prisma.cliente.update({ where: { id }, data });
    return { data: cliente };
  });
}
