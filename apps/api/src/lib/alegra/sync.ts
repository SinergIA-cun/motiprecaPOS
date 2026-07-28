// Orquestación de la sincronización Alegra → Motipreca (Fase 1.5).
// Trae contactos e items, filtra clientes y hace upsert por alegraId.
import { Prisma, prisma } from '@motipreca/database';
import { fetchAllContacts, fetchAllItems } from './client.js';
import { isCliente, mapContactToCliente, mapItemToProducto } from './mapper.js';
import { evaluarRendimiento } from './rendimiento.js';

/** Equivalencia por m² que Alegra trae en la descripción y aquí no había. */
export interface EquivalenciaConflicto {
  codigo: string;
  nombre: string;
  /** Lo que dice la descripción de Alegra. */
  segunAlegra: number;
  /** Lo que ya estaba guardado en Motipos (cargado por CSV o a mano). */
  enMotipos: number;
}

export interface SyncSummary {
  clientes: { creados: number; actualizados: number; omitidos: number; total: number };
  productos: {
    creados: number;
    actualizados: number;
    total: number;
    /** Equivalencias por m² que se rellenaron leyendo la descripción de Alegra. */
    equivalenciasLlenadas: number;
    /** Traían rendimiento, pero su precio no reconcilia: no se guardó nada. */
    equivalenciasIncoherentes: number;
  };
  /** Donde Alegra y Motipos no coinciden. No se pisa nada; se avisa. */
  equivalenciasEnConflicto: EquivalenciaConflicto[];
  detalle: string[];
}

export async function syncFromAlegra(): Promise<SyncSummary> {
  // allSettled (no Promise.all): si ambos fetch fallan, Promise.all dejaría la
  // segunda promesa como unhandledRejection y Node mataría el proceso. Con
  // allSettled esperamos ambas y propagamos el error como excepción manejable.
  const [contactsResult, itemsResult] = await Promise.allSettled([
    fetchAllContacts(),
    fetchAllItems(),
  ]);
  if (contactsResult.status === 'rejected') throw contactsResult.reason;
  if (itemsResult.status === 'rejected') throw itemsResult.reason;
  const contacts = contactsResult.value;
  const items = itemsResult.value;
  const detalle: string[] = [];

  let cCreados = 0;
  let cActualizados = 0;
  let cOmitidos = 0;
  for (const contact of contacts) {
    if (!isCliente(contact)) {
      cOmitidos += 1;
      detalle.push(`· Omitido (no es cliente): ${contact.name}`);
      continue;
    }
    const data = mapContactToCliente(contact);
    const existing = await prisma.cliente.findUnique({ where: { alegraId: data.alegraId } });
    await prisma.cliente.upsert({ where: { alegraId: data.alegraId }, create: data, update: data });
    if (existing) cActualizados += 1;
    else cCreados += 1;
    detalle.push(
      `· Cliente ${existing ? 'actualizado' : 'creado'}: ${data.nombre} (${data.tipo}, RFC ${data.rfc ?? '—'})`,
    );
  }

  let pCreados = 0;
  let pActualizados = 0;
  let equivalenciasLlenadas = 0;
  let equivalenciasIncoherentes = 0;
  const equivalenciasEnConflicto: EquivalenciaConflicto[] = [];

  for (const item of items) {
    const data = mapItemToProducto(item);
    const existing = await prisma.producto.findUnique({ where: { alegraId: data.alegraId } });

    // Motipreca ya escribe "Rendimiento: N piezas/m²" en la descripción de sus
    // productos en Alegra, y el precio por m² de la misma descripción sirve para
    // comprobar que ese N es correcto. Se aprovecha para que la captura en m²
    // funcione sin cargar un CSV, y se mantenga sola cuando Alegra cambie.
    //
    // Un producto que ya se vende por m² no necesita conversión a piezas.
    const veredicto =
      data.unidad === 'M2'
        ? { estado: 'ausente' as const }
        : evaluarRendimiento(data.descripcion, data.precioBase);
    if (veredicto.estado === 'incoherente') {
      equivalenciasIncoherentes += 1;
      detalle.push(
        `· OJO ${data.codigo}: la descripción dice ${veredicto.piezasPorM2} pz/m², pero con eso el m² saldría en $${veredicto.esperado} y el catálogo dice $${veredicto.recibido}. No se guardó.`,
      );
    }
    const equivalencia =
      veredicto.estado === 'verificado' || veredicto.estado === 'sin_verificar'
        ? veredicto.piezasPorM2
        : null;

    const update: Prisma.ProductoUncheckedUpdateInput = { ...data };
    if (equivalencia !== null) {
      const previa = existing?.piezasPorM2 == null ? null : Number(existing.piezasPorM2);
      if (previa === null) {
        // Solo se rellena lo que está vacío: la ficha técnica es dato local y el
        // sync no debe pisar lo que se cargó por CSV o a mano.
        update.piezasPorM2 = equivalencia;
        if (existing) equivalenciasLlenadas += 1;
      } else if (Math.abs(previa - equivalencia) / equivalencia > 0.02) {
        // Más de 2% de diferencia no es redondeo. Se reporta y se respeta lo que
        // ya había: quien lo cargó pudo haber medido la pieza.
        equivalenciasEnConflicto.push({
          codigo: data.codigo,
          nombre: data.nombre,
          segunAlegra: equivalencia,
          enMotipos: previa,
        });
      }
    }

    await prisma.producto.upsert({
      where: { alegraId: data.alegraId },
      // Un producto nuevo nace con su equivalencia si la descripción la trae.
      create: { ...data, piezasPorM2: equivalencia },
      update,
    });
    if (existing) pActualizados += 1;
    else pCreados += 1;
    detalle.push(
      `· Producto ${existing ? 'actualizado' : 'creado'}: ${data.codigo} · ${data.nombre} · $${data.precioBase} / ${data.unidad}` +
        (update.piezasPorM2 !== undefined ? ` · equivalencia ${equivalencia} pz/m²` : ''),
    );
  }

  return {
    clientes: {
      creados: cCreados,
      actualizados: cActualizados,
      omitidos: cOmitidos,
      total: contacts.length,
    },
    productos: {
      creados: pCreados,
      actualizados: pActualizados,
      total: items.length,
      equivalenciasLlenadas,
      equivalenciasIncoherentes,
    },
    equivalenciasEnConflicto,
    detalle,
  };
}
