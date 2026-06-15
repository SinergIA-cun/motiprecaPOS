import { Prisma, prisma, type Usuario } from '@motipreca/database';
import { createUsuarioSchema, rolSchema, updateUsuarioSchema } from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { conflict, forbidden, notFound, validationError } from '../lib/errors.js';
import { hashPassword } from '../lib/password.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const adminOnly = { preHandler: [authenticate, authorize('ADMINISTRADOR')] };

/** Proyección pública: nunca exponer passwordHash ni totpSecret (regla #4/#22). */
function toPublic(u: Usuario) {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    telefono: u.telefono,
    rol: u.rol,
    iniciales: u.iniciales,
    sucursalId: u.sucursalId,
    activo: u.activo,
    has2FA: u.has2FA,
    ultimoLoginAt: u.ultimoLoginAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/** Valida que la sucursal exista antes de asignarla (evita FK rota). */
async function ensureSucursalExists(sucursalId: string | null): Promise<void> {
  if (!sucursalId) return;
  const s = await prisma.sucursal.findUnique({ where: { id: sucursalId }, select: { id: true } });
  if (!s) throw validationError('La sucursal indicada no existe');
}

export async function usuarioRoutes(app: FastifyInstance): Promise<void> {
  // ---- GET /usuarios?sucursalId=&rol=&activo= ----
  app.get('/usuarios', adminOnly, async (request) => {
    const q = request.query as { sucursalId?: string; rol?: string; activo?: string };
    const where: Prisma.UsuarioWhereInput = {};
    if (q.sucursalId) where.sucursalId = q.sucursalId;
    if (q.rol) {
      const rol = rolSchema.safeParse(q.rol);
      if (rol.success) where.rol = rol.data;
    }
    if (q.activo !== undefined) where.activo = q.activo === 'true';

    const usuarios = await prisma.usuario.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { sucursal: { select: { id: true, nombre: true, prefijoFolio: true } } },
    });
    return { data: usuarios.map((u) => ({ ...toPublic(u), sucursal: u.sucursal })) };
  });

  // ---- GET /usuarios/:id ----
  app.get('/usuarios/:id', adminOnly, async (request) => {
    const { id } = request.params as { id: string };
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw notFound('Usuario no encontrado');
    return { data: toPublic(usuario) };
  });

  // ---- POST /usuarios ----
  app.post('/usuarios', adminOnly, async (request, reply) => {
    const parsed = createUsuarioSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;

    const dup = await prisma.usuario.findUnique({ where: { email: d.email } });
    if (dup) throw conflict('Ya existe un usuario con ese correo');

    await ensureSucursalExists(d.sucursalId);

    const passwordHash = await hashPassword(d.password);
    const usuario = await prisma.usuario.create({
      data: {
        email: d.email,
        passwordHash,
        nombre: d.nombre,
        rol: d.rol,
        iniciales: d.iniciales,
        sucursalId: d.sucursalId,
        telefono: d.telefono ?? null,
      },
    });
    reply.code(201);
    return { data: toPublic(usuario) };
  });

  // ---- PATCH /usuarios/:id ----
  app.patch('/usuarios/:id', adminOnly, async (request) => {
    const { id } = request.params as { id: string };
    const parsed = updateUsuarioSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) throw notFound('Usuario no encontrado');

    const d = parsed.data;

    // Anti-bloqueo: el admin no puede desactivarse ni quitarse el rol a sí mismo.
    if (request.user?.id === id) {
      if (d.activo === false) throw forbidden('No puedes desactivar tu propia cuenta');
      if (d.rol !== undefined && d.rol !== 'ADMINISTRADOR') {
        throw forbidden('No puedes cambiar tu propio rol de administrador');
      }
    }

    if (d.sucursalId) await ensureSucursalExists(d.sucursalId);

    const data: Prisma.UsuarioUncheckedUpdateInput = {};
    if (d.nombre !== undefined) data.nombre = d.nombre;
    if (d.rol !== undefined) data.rol = d.rol;
    if (d.iniciales !== undefined) data.iniciales = d.iniciales;
    if (d.telefono !== undefined) data.telefono = d.telefono;
    if (d.sucursalId !== undefined) data.sucursalId = d.sucursalId;
    if (d.activo !== undefined) data.activo = d.activo;
    if (d.password) data.passwordHash = await hashPassword(d.password);

    const usuario = await prisma.usuario.update({ where: { id }, data });
    return { data: toPublic(usuario) };
  });
}
