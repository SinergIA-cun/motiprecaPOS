import { Prisma, prisma } from '@motipreca/database';
import {
  createProductoSchema,
  importarEquivalenciasSchema,
  updateProductoSchema,
} from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { parseCsvConEncabezado } from '../lib/csv.js';
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
        piezasPorM2: d.piezasPorM2 ?? null,
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
    if (d.piezasPorM2 !== undefined) data.piezasPorM2 = d.piezasPorM2;

    const producto = await prisma.producto.update({ where: { id }, data });
    return { data: producto };
  });

  // ---- POST /productos/equivalencias ---- carga masiva de piezas por m² (CSV).
  //
  // Solo ACTUALIZA productos existentes, buscándolos por código. No crea nada:
  // el catálogo es de Alegra y esta equivalencia es el único dato que Alegra no
  // puede guardar. Un código que no existe aquí se reporta, no se inventa.
  //
  // Columnas requeridas: `codigo` y `piezas_por_m2` (los encabezados se
  // normalizan, así que `PIEZAS_POR_M2` o `piezas por m²` también sirven).
  // Una celda de equivalencia vacía se OMITE — así la misma plantilla de precios
  // se puede subir aunque solo la mitad de las filas traiga el dato.
  app.post('/productos/equivalencias', gestor, async (request) => {
    const parsed = importarEquivalenciasSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const { columnas, filas } = parseCsvConEncabezado(parsed.data.csv);

    if (!columnas.includes('codigo') || !columnas.includes('piezas_por_m2')) {
      throw validationError(
        `El CSV debe tener las columnas "codigo" y "piezas_por_m2". Encontré: ${columnas.join(', ') || '(ninguna)'}`,
      );
    }

    const actualizados: { codigo: string; piezasPorM2: number; anterior: number | null }[] = [];
    const sinCambio: string[] = [];
    const omitidos: string[] = [];
    const noEncontrados: string[] = [];
    const invalidos: { codigo: string; valor: string; motivo: string }[] = [];
    // Productos cuya unidad de venta YA es m²: la equivalencia no les sirve de
    // nada (su cantidad ya es superficie y su precio es por m²). Se avisa en vez
    // de guardar un dato que nadie va a usar.
    const yaEnM2: string[] = [];

    for (const fila of filas) {
      const codigo = fila.codigo?.trim().toUpperCase();
      const crudo = fila.piezas_por_m2?.trim() ?? '';
      if (!codigo) continue;

      if (crudo === '') {
        omitidos.push(codigo);
        continue;
      }
      const valor = Number(crudo.replace(',', '.'));
      if (!Number.isFinite(valor) || valor <= 0 || valor > 10_000) {
        invalidos.push({ codigo, valor: crudo, motivo: 'No es un número mayor a 0' });
        continue;
      }

      const producto = await prisma.producto.findUnique({
        where: { codigo },
        select: { id: true, unidad: true, piezasPorM2: true },
      });
      if (!producto) {
        noEncontrados.push(codigo);
        continue;
      }
      if (producto.unidad === 'M2') {
        yaEnM2.push(codigo);
        continue;
      }

      const anterior = producto.piezasPorM2 == null ? null : Number(producto.piezasPorM2);
      if (anterior === valor) {
        sinCambio.push(codigo);
        continue;
      }
      if (!parsed.data.simular) {
        await prisma.producto.update({ where: { id: producto.id }, data: { piezasPorM2: valor } });
      }
      actualizados.push({ codigo, piezasPorM2: valor, anterior });
    }

    return {
      data: {
        simulacion: parsed.data.simular,
        leidas: filas.length,
        actualizados,
        sinCambio,
        omitidos,
        noEncontrados,
        invalidos,
        yaEnM2,
        resumen:
          `${actualizados.length} ${parsed.data.simular ? 'por actualizar' : 'actualizados'}` +
          `, ${sinCambio.length} sin cambio, ${omitidos.length} sin dato` +
          `, ${noEncontrados.length} no encontrados, ${invalidos.length} inválidos` +
          (yaEnM2.length > 0 ? `, ${yaEnM2.length} ya se venden por m²` : ''),
      },
    };
  });
}
