import { Prisma, prisma } from '@motipreca/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { unauthorized } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';

// Dashboard operativo: qué necesita atención hoy y cómo vamos contra el mes pasado.
// Alcance por rol: el asesor ve lo suyo; jefe/gerente/admin ven todo (§11).

const auth = { preHandler: [authenticate] };
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Días de anticipación para considerar una cotización "por vencer". */
const DIAS_POR_VENCER = 7;

const ROLES_VE_TODO = ['JEFE_DEPARTAMENTO', 'GERENTE', 'ADMINISTRADOR'];

function alcance(request: FastifyRequest): { asesorId?: string } {
  const rol = request.user?.rol ?? '';
  return ROLES_VE_TODO.includes(rol) ? {} : { asesorId: request.user?.id };
}

/** Variación % contra el periodo anterior. null cuando no hay base de comparación. */
function variacion(actual: number, previo: number): number | null {
  if (previo === 0) return null;
  return round2(((actual - previo) / previo) * 100);
}

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  // ---- GET /dashboard ----
  app.get('/dashboard', auth, async (request) => {
    if (!request.user) throw unauthorized();
    const { asesorId } = alcance(request);

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesPrevio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const inicioAnio = new Date(ahora.getFullYear(), 0, 1);
    const limitePorVencer = new Date(ahora.getTime() + DIAS_POR_VENCER * 86_400_000);

    // El filtro por asesor aplica a cotizaciones; para ventas se usa la
    // cotización de origen (la venta guarda cajero, no asesor).
    const cotDe = (extra: Prisma.CotizacionWhereInput): Prisma.CotizacionWhereInput =>
      asesorId ? { ...extra, asesorId } : extra;
    const ventaDe = (extra: Prisma.VentaWhereInput): Prisma.VentaWhereInput =>
      asesorId ? { ...extra, cotizacion: { asesorId } } : extra;

    const [
      porVencer,
      porVencerLista,
      cerradasMes,
      cerradasMesPrevio,
      ventasMes,
      ventasMesPrevio,
      topClientesRaw,
      topVentas,
    ] = await Promise.all([
      // Por vencer: vigentes que caducan dentro de la ventana.
      prisma.cotizacion.count({
        where: cotDe({
          estado: { in: ['ABIERTA', 'PENDIENTE_APROBACION_INTERNA', 'APROBADA'] },
          vigenciaHasta: { gte: ahora, lte: limitePorVencer },
        }),
      }),
      prisma.cotizacion.findMany({
        where: cotDe({
          estado: { in: ['ABIERTA', 'PENDIENTE_APROBACION_INTERNA', 'APROBADA'] },
          vigenciaHasta: { gte: ahora, lte: limitePorVencer },
        }),
        orderBy: { vigenciaHasta: 'asc' },
        take: 5,
        select: {
          id: true,
          folio: true,
          total: true,
          vigenciaHasta: true,
          cliente: { select: { nombre: true } },
        },
      }),
      // Cerradas: cotizaciones convertidas en venta.
      prisma.cotizacion.count({
        where: cotDe({ estado: 'COBRADA', venta: { is: { createdAt: { gte: inicioMes } } } }),
      }),
      prisma.cotizacion.count({
        where: cotDe({
          estado: 'COBRADA',
          venta: { is: { createdAt: { gte: inicioMesPrevio, lt: inicioMes } } },
        }),
      }),
      prisma.venta.aggregate({
        where: ventaDe({ createdAt: { gte: inicioMes } }),
        _sum: { total: true },
        _count: true,
      }),
      prisma.venta.aggregate({
        where: ventaDe({ createdAt: { gte: inicioMesPrevio, lt: inicioMes } }),
        _sum: { total: true },
      }),
      // Top clientes del año por monto vendido.
      prisma.venta.groupBy({
        by: ['clienteId'],
        where: ventaDe({ createdAt: { gte: inicioAnio }, clienteId: { not: null } }),
        _sum: { total: true },
        _count: true,
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      // Top 5 ventas del año.
      prisma.venta.findMany({
        where: ventaDe({ createdAt: { gte: inicioAnio } }),
        orderBy: { total: 'desc' },
        take: 5,
        select: {
          id: true,
          folio: true,
          total: true,
          createdAt: true,
          cliente: { select: { nombre: true } },
        },
      }),
    ]);

    // groupBy sólo devuelve ids: resolvemos nombres en una query.
    const clienteIds = topClientesRaw
      .map((c) => c.clienteId)
      .filter((id): id is string => id !== null);
    const clientes = await prisma.cliente.findMany({
      where: { id: { in: clienteIds } },
      select: { id: true, nombre: true },
    });
    const nombrePor = new Map(clientes.map((c) => [c.id, c.nombre]));

    const montoMes = round2(Number(ventasMes._sum.total ?? 0));
    const montoMesPrevio = round2(Number(ventasMesPrevio._sum.total ?? 0));

    return {
      data: {
        alcance: asesorId ? 'propio' : 'global',
        porVencer: {
          cantidad: porVencer,
          dias: DIAS_POR_VENCER,
          lista: porVencerLista,
        },
        cerradas: {
          mes: cerradasMes,
          mesPrevio: cerradasMesPrevio,
          variacionPct: variacion(cerradasMes, cerradasMesPrevio),
        },
        ventas: {
          montoMes,
          montoMesPrevio,
          operacionesMes: ventasMes._count,
          variacionPct: variacion(montoMes, montoMesPrevio),
        },
        topClientes: topClientesRaw.map((c) => ({
          clienteId: c.clienteId,
          nombre: c.clienteId ? (nombrePor.get(c.clienteId) ?? 'Cliente') : 'Mostrador',
          total: round2(Number(c._sum.total ?? 0)),
          operaciones: c._count,
        })),
        topVentas,
      },
    };
  });
}
