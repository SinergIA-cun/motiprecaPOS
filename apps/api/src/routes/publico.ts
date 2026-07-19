import { prisma } from '@motipreca/database';
import type { FastifyInstance } from 'fastify';
import { notFound } from '../lib/errors.js';

// Verificación pública de cotizaciones (plan §13: el QR del PDF apunta aquí).
// SIN autenticación: sólo se accede con el id de la cotización, que es el que
// viaja en el QR del documento impreso. Payload deliberadamente mínimo — lo
// justo para confirmar autenticidad y vigencia. NO se exponen datos de contacto
// del cliente (RFC, email, teléfono), precios unitarios, costos ni crédito.

/** Estado que ve el cliente, derivado del estado interno + vigencia. */
function estadoPublico(estado: string, vigenciaHasta: Date): string {
  if (estado === 'COBRADA') return 'PAGADA';
  if (estado === 'RECHAZADA' || estado === 'RECHAZADA_INTERNA') return 'CANCELADA';
  if (estado === 'EXPIRADA' || vigenciaHasta < new Date()) return 'VENCIDA';
  if (estado === 'APROBADA') return 'VIGENTE';
  return 'EN_PROCESO';
}

export async function publicoRoutes(app: FastifyInstance): Promise<void> {
  // ---- GET /public/cotizaciones/:id ---- destino del QR.
  app.get('/public/cotizaciones/:id', async (request) => {
    const { id } = request.params as { id: string };
    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      select: {
        folio: true,
        estado: true,
        total: true,
        createdAt: true,
        vigenciaHasta: true,
        cliente: { select: { nombre: true } },
        sucursal: { select: { nombre: true, telefono: true } },
        asesor: { select: { nombre: true } },
        items: { select: { descripcion: true, cantidad: true }, orderBy: { orden: 'asc' } },
      },
    });
    // Cotización inexistente o eliminada: para el cliente simplemente no existe.
    if (!cot || cot.estado === 'ELIMINADA') throw notFound('Cotización no encontrada');

    return {
      data: {
        folio: cot.folio,
        estado: estadoPublico(cot.estado, cot.vigenciaHasta),
        emitidaPara: cot.cliente.nombre,
        total: cot.total,
        fecha: cot.createdAt,
        vigenciaHasta: cot.vigenciaHasta,
        sucursal: cot.sucursal.nombre,
        telefonoSucursal: cot.sucursal.telefono,
        asesor: cot.asesor.nombre,
        // Sólo qué y cuánto, sin precios: confirma que el documento coincide.
        conceptos: cot.items.map((i) => ({
          descripcion: i.descripcion,
          cantidad: i.cantidad,
        })),
      },
    };
  });
}
