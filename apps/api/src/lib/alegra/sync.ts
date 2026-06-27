// Orquestación de la sincronización Alegra → Motipreca (Fase 1.5).
// Trae contactos e items, filtra clientes y hace upsert por alegraId.
import { prisma } from '@motipreca/database';
import { fetchContacts, fetchItems } from './client.js';
import { isCliente, mapContactToCliente, mapItemToProducto } from './mapper.js';

export interface SyncSummary {
  clientes: { creados: number; actualizados: number; omitidos: number; total: number };
  productos: { creados: number; actualizados: number; total: number };
  detalle: string[];
}

export async function syncFromAlegra(): Promise<SyncSummary> {
  // allSettled (no Promise.all): si ambos fetch fallan, Promise.all dejaría la
  // segunda promesa como unhandledRejection y Node mataría el proceso. Con
  // allSettled esperamos ambas y propagamos el error como excepción manejable.
  const [contactsResult, itemsResult] = await Promise.allSettled([fetchContacts(), fetchItems()]);
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
  for (const item of items) {
    const data = mapItemToProducto(item);
    const existing = await prisma.producto.findUnique({ where: { alegraId: data.alegraId } });
    await prisma.producto.upsert({
      where: { alegraId: data.alegraId },
      create: data,
      update: data,
    });
    if (existing) pActualizados += 1;
    else pCreados += 1;
    detalle.push(
      `· Producto ${existing ? 'actualizado' : 'creado'}: ${data.codigo} · ${data.nombre} · $${data.precioBase} / ${data.unidad}`,
    );
  }

  return {
    clientes: {
      creados: cCreados,
      actualizados: cActualizados,
      omitidos: cOmitidos,
      total: contacts.length,
    },
    productos: { creados: pCreados, actualizados: pActualizados, total: items.length },
    detalle,
  };
}
