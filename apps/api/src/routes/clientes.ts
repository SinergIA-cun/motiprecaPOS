import { Prisma, prisma } from '@motipreca/database';
import { createClienteSchema, updateClienteSchema } from '@motipreca/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { pushClienteAAlegra } from '../lib/alegra/push.js';
import { creditoDeCliente, invalidarCreditoCache } from '../lib/credito.js';
import { forbidden, notFound, validationError } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';

// Módulo operativo: cualquier usuario autenticado gestiona clientes (regla #15).
const auth = { preHandler: [authenticate] };

/** Campos que Alegra también guarda: solo estos justifican re-empujar el contacto. */
const CAMPOS_ALEGRA = ['nombre', 'rfc', 'email', 'telefono'] as const;

/** La línea de crédito solo la fija gerencia (plan §5: su aumento es decisión de arriba). */
function esGerencia(request: FastifyRequest): boolean {
  const rol = request.user?.rol;
  return rol === 'GERENTE' || rol === 'ADMINISTRADOR';
}

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

  // ---- GET /clientes/:id/credito ----
  // Línea local + adeudo EN VIVO desde Alegra (facturas abiertas del contacto).
  app.get('/clientes/:id/credito', auth, async (request) => {
    const { id } = request.params as { id: string };
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      select: { id: true, alegraId: true, lineaCredito: true },
    });
    if (!cliente) throw notFound('Cliente no encontrado');
    return { data: await creditoDeCliente(cliente) };
  });

  // ---- POST /clientes ----
  app.post('/clientes', auth, async (request, reply) => {
    const parsed = createClienteSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    if (d.lineaCredito !== undefined && !esGerencia(request)) {
      throw forbidden('Solo gerente o administrador pueden fijar la línea de crédito');
    }
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
        lineaCredito: d.lineaCredito ?? null,
      },
    });
    // El alta local ya está firme. El empuje a Alegra va en segundo plano para
    // no dejar al vendedor esperando la red; el resultado queda en estadoSync y
    // el barrido reintenta lo que haya fallado.
    void pushClienteAAlegra(cliente).then((r) => {
      if (!r.ok && !r.omitido) {
        request.log.warn({ clienteId: cliente.id, err: r.error }, 'Push a Alegra falló');
      }
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
    if (d.lineaCredito !== undefined && !esGerencia(request)) {
      throw forbidden('Solo gerente o administrador pueden cambiar la línea de crédito');
    }
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
    if (d.lineaCredito !== undefined) data.lineaCredito = d.lineaCredito;

    const cliente = await prisma.cliente.update({ where: { id }, data });
    invalidarCreditoCache(id);

    // Solo empujamos si cambió algo que Alegra realmente guarda; mover de
    // sucursal o ajustar la línea de crédito son datos nuestros, no suyos.
    if (CAMPOS_ALEGRA.some((c) => d[c] !== undefined)) {
      void pushClienteAAlegra(cliente).then((r) => {
        if (!r.ok && !r.omitido) {
          request.log.warn({ clienteId: id, err: r.error }, 'Push a Alegra falló');
        }
      });
    }

    return { data: cliente };
  });
}
