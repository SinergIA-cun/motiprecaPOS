import { Prisma, prisma } from '@motipreca/database';
import { createProductoSchema, importarFichaSchema, updateProductoSchema } from '@motipreca/shared';
import type { FastifyInstance } from 'fastify';
import { parseCsvConEncabezado } from '../lib/csv.js';
import { conflict, notFound, validationError } from '../lib/errors.js';
import {
  CAMPOS_FICHA,
  COLUMNA_A_CAMPO,
  ETIQUETA_CAMPO,
  leerFilaFicha,
  revisarSuperficie,
  type CampoFicha,
  type Discrepancia,
  type ErrorFicha,
} from '../lib/ficha-tecnica.js';
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
        familia: d.familia ?? null,
        dimensionesCm: d.dimensionesCm ?? null,
        superficieM2: d.superficieM2 ?? null,
        pesoKg: d.pesoKg ?? null,
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
    if (d.familia !== undefined) data.familia = d.familia;
    if (d.dimensionesCm !== undefined) data.dimensionesCm = d.dimensionesCm;
    if (d.superficieM2 !== undefined) data.superficieM2 = d.superficieM2;
    if (d.pesoKg !== undefined) data.pesoKg = d.pesoKg;

    const producto = await prisma.producto.update({ where: { id }, data });
    return { data: producto };
  });

  // ---- POST /productos/ficha ---- carga masiva de la ficha técnica (CSV).
  //
  // Los cinco datos que Alegra no guarda: equivalencia por m², familia,
  // dimensiones, superficie y peso. Solo ACTUALIZA productos existentes,
  // buscándolos por código: el catálogo es de Alegra, así que un código que no
  // existe aquí se reporta, no se inventa.
  //
  // Requiere la columna `codigo` y al menos una de datos. Los encabezados se
  // normalizan (`PESO_KG`, `peso kg` y `peso_kg` son lo mismo) y las columnas
  // que no reconoce las ignora, así que se puede pegar la plantilla completa.
  // Una celda vacía se OMITE en vez de borrar lo que ya había — así la misma
  // plantilla sirve aunque solo la mitad de las filas esté completa.
  app.post('/productos/ficha', gestor, async (request) => {
    const parsed = importarFichaSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Datos inválidos', parsed.error.flatten().fieldErrors);
    }
    const { simular } = parsed.data;
    const { columnas, filas } = parseCsvConEncabezado(parsed.data.csv);

    if (!columnas.includes('codigo')) {
      throw validationError(
        `El CSV debe tener una columna "codigo". Encontré: ${columnas.join(', ') || '(ninguna)'}`,
      );
    }
    const columnasDeDatos = CAMPOS_FICHA.filter((c) => columnas.includes(c));
    if (columnasDeDatos.length === 0) {
      throw validationError(
        `El CSV no trae ninguna columna de ficha técnica. Necesito al menos una de: ${CAMPOS_FICHA.join(', ')}.`,
      );
    }

    interface Cambio {
      columna: CampoFicha;
      etiqueta: string;
      anterior: string | number | null;
      nuevo: string | number;
    }

    const actualizados: { codigo: string; cambios: Cambio[] }[] = [];
    const sinCambio: string[] = [];
    const sinDatos: string[] = [];
    const noEncontrados: string[] = [];
    const invalidos: (ErrorFicha & { codigo: string })[] = [];
    // Productos cuya unidad de venta YA es m²: la equivalencia no les sirve
    // (su cantidad ya es superficie y su precio es por m²), así que se descarta
    // ESE dato y el resto de la ficha sí se carga.
    const yaEnM2: string[] = [];
    const discrepancias: Discrepancia[] = [];

    for (const fila of filas) {
      const leida = leerFilaFicha(fila);
      if (!leida) continue;
      const { codigo, valores, invalidos: malos } = leida;

      for (const malo of malos) invalidos.push({ codigo, ...malo });

      const producto = await prisma.producto.findUnique({
        where: { codigo },
        select: {
          id: true,
          unidad: true,
          piezasPorM2: true,
          familia: true,
          dimensionesCm: true,
          superficieM2: true,
          pesoKg: true,
        },
      });
      if (!producto) {
        noEncontrados.push(codigo);
        continue;
      }

      const equivalenciaInutil =
        producto.unidad === 'M2' && valores.some((v) => v.columna === 'piezas_por_m2');
      if (equivalenciaInutil) yaEnM2.push(codigo);
      const aplicables = equivalenciaInutil
        ? valores.filter((v) => v.columna !== 'piezas_por_m2')
        : valores;
      if (aplicables.length === 0) {
        if (malos.length === 0) sinDatos.push(codigo);
        continue;
      }

      const data: Prisma.ProductoUncheckedUpdateInput = {};
      const cambios: Cambio[] = [];
      for (const { columna, valor } of aplicables) {
        const campo = COLUMNA_A_CAMPO[columna];
        const previo = producto[campo];
        // Los Decimal de Prisma no son comparables con ===; se normalizan a
        // number, y los textos se comparan tal cual.
        const anterior =
          previo == null ? null : typeof valor === 'number' ? Number(previo) : String(previo);
        if (anterior === valor) continue;
        data[campo] = valor;
        cambios.push({ columna, etiqueta: ETIQUETA_CAMPO[columna], anterior, nuevo: valor });
      }

      // Se coteja con el valor que QUEDA tras la carga, no solo con lo que trae
      // el CSV: si la fila solo actualiza la superficie, se compara contra las
      // medidas que ya estaban guardadas.
      const dimsFinal = aplicables.find((v) => v.columna === 'dimensiones_cm')?.valor;
      const supFinal = aplicables.find((v) => v.columna === 'superficie_m2')?.valor;
      const discrepancia = revisarSuperficie(
        codigo,
        typeof dimsFinal === 'string' ? dimsFinal : (producto.dimensionesCm ?? undefined),
        typeof supFinal === 'number'
          ? supFinal
          : producto.superficieM2 == null
            ? undefined
            : Number(producto.superficieM2),
      );
      if (discrepancia) discrepancias.push(discrepancia);

      if (cambios.length === 0) {
        sinCambio.push(codigo);
        continue;
      }
      if (!simular) {
        await prisma.producto.update({ where: { id: producto.id }, data });
      }
      actualizados.push({ codigo, cambios });
    }

    const campos = actualizados.reduce((total, a) => total + a.cambios.length, 0);
    return {
      data: {
        simulacion: simular,
        leidas: filas.length,
        columnasLeidas: columnasDeDatos,
        actualizados,
        sinCambio,
        sinDatos,
        noEncontrados,
        invalidos,
        yaEnM2,
        discrepancias,
        resumen:
          `${actualizados.length} ${simular ? 'productos por actualizar' : 'productos actualizados'}` +
          ` (${campos} ${campos === 1 ? 'dato' : 'datos'})` +
          `, ${sinCambio.length} sin cambio, ${sinDatos.length} sin datos` +
          `, ${noEncontrados.length} no encontrados, ${invalidos.length} inválidos` +
          (yaEnM2.length > 0 ? `, ${yaEnM2.length} ya se venden por m²` : '') +
          (discrepancias.length > 0 ? `, ${discrepancias.length} por revisar` : ''),
      },
    };
  });
}
