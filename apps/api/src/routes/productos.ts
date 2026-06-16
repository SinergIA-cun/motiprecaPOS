import { Prisma, prisma } from '@motipreca/database';
import { createProductoSchema, updateProductoSchema } from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { conflict, notFound, validationError } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

// Lectura: cualquier autenticado (asesores cotizan). Escritura del catálogo: Gerente/Admin.
const auth = { preHandler: [authenticate] };
const gestor = { preHandler: [authenticate, authorize('GERENTE', 'ADMINISTRADOR')] };

export async function productoRoutes(app: FastifyInstance): Promise<void> {
  // ---- GET /productos?q=&activo=&categoria= ----
  app.get('/productos', auth, async (request) => {
    const q = request.query as { q?: string; activo?: string; categoria?: string };
    const where: Prisma.ProductoWhereInput = {};
    if (q.activo !== undefined) where.activo = q.activo === 'true';
    if (q.categoria) where.categoria = q.categoria;
    if (q.q?.trim()) {
      const term = q.q.trim();
      where.OR = [
        { codigo: { contains: term, mode: 'insensitive' } },
        { nombre: { contains: term, mode: 'insensitive' } },
        { categoria: { contains: term, mode: 'insensitive' } },
      ];
    }
    const data = await prisma.producto.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      take: 300,
    });
    return { data };
  });

  // ---- GET /productos/:id ----
  app.get('/productos/:id', auth, async (request) => {
    const { id } = request.params as { id: string };
    const producto = await prisma.producto.findUnique({ where: { id } });
    if (!producto) throw notFound('Producto no encontrado');
    return { data: producto };
  });

  // ---- POST /productos ----
  app.post('/productos', gestor, async (request, reply) => {
    const parsed = createProductoSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    const dup = await prisma.producto.findUnique({ where: { codigo: d.codigo } });
    if (dup) throw conflict(`Ya existe un producto con el código "${d.codigo}"`);

    const producto = await prisma.producto.create({
      data: {
        codigo: d.codigo,
        nombre: d.nombre,
        descripcion: d.descripcion ?? null,
        categoria: d.categoria ?? null,
        unidad: d.unidad,
        tipoProducto: d.tipoProducto,
        precioBase: d.precioBase,
      },
    });
    reply.code(201);
    return { data: producto };
  });

  // ---- PATCH /productos/:id ----
  app.patch('/productos/:id', gestor, async (request) => {
    const { id } = request.params as { id: string };
    const parsed = updateProductoSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const existing = await prisma.producto.findUnique({ where: { id } });
    if (!existing) throw notFound('Producto no encontrado');

    const d = parsed.data;
    if (d.codigo && d.codigo !== existing.codigo) {
      const dup = await prisma.producto.findUnique({ where: { codigo: d.codigo } });
      if (dup) throw conflict(`Ya existe un producto con el código "${d.codigo}"`);
    }

    const data: Prisma.ProductoUncheckedUpdateInput = {};
    if (d.codigo !== undefined) data.codigo = d.codigo;
    if (d.nombre !== undefined) data.nombre = d.nombre;
    if (d.descripcion !== undefined) data.descripcion = d.descripcion;
    if (d.categoria !== undefined) data.categoria = d.categoria;
    if (d.unidad !== undefined) data.unidad = d.unidad;
    if (d.tipoProducto !== undefined) data.tipoProducto = d.tipoProducto;
    if (d.precioBase !== undefined) data.precioBase = d.precioBase;
    if (d.activo !== undefined) data.activo = d.activo;

    const producto = await prisma.producto.update({ where: { id }, data });
    return { data: producto };
  });
}
