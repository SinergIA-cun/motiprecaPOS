// Push Motipreca → Alegra (Fase 1.5). Crea o actualiza el contacto en Alegra
// cuando el cliente nace o cambia aquí.
//
// Regla de oro: si Alegra falla, el cliente NO se pierde ni se bloquea el alta
// local. Se marca estadoSync=ERROR y el barrido de reconciliación reintenta.
import { EstadoSync, prisma } from '@motipreca/database';
import { alegraConfigurado, createContact, updateContact } from './client.js';
import { mapClienteToContact } from './mapper.js';

interface ClientePush {
  id: string;
  nombre: string;
  rfc: string | null;
  email: string | null;
  telefono: string | null;
  alegraId: string | null;
}

/**
 * Empuja el cliente a Alegra y guarda el alegraId. Nunca lanza: devuelve el
 * resultado para que el llamador decida si lo reporta.
 */
export async function pushClienteAAlegra(
  cliente: ClientePush,
): Promise<{ ok: boolean; alegraId?: string; error?: string; omitido?: boolean }> {
  // Sin credenciales no hay nada que hacer: dejamos el cliente en PENDIENTE
  // (no en ERROR) para no ensuciar el tablero de sincronización.
  if (!alegraConfigurado()) return { ok: false, omitido: true, error: 'Alegra no configurado' };

  const payload = mapClienteToContact(cliente);
  try {
    if (cliente.alegraId) {
      await updateContact(cliente.alegraId, payload);
      await prisma.cliente.update({
        where: { id: cliente.id },
        data: { estadoSync: EstadoSync.SINCRONIZADO },
      });
      return { ok: true, alegraId: cliente.alegraId };
    }

    const creado = await createContact(payload);
    const alegraId = String(creado.id);
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { alegraId, estadoSync: EstadoSync.SINCRONIZADO },
    });
    return { ok: true, alegraId };
  } catch (err) {
    // Marcamos para reintento; el alta local ya ocurrió y se respeta.
    await prisma.cliente
      .update({ where: { id: cliente.id }, data: { estadoSync: EstadoSync.ERROR } })
      .catch(() => undefined);
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

/** Reintenta los clientes que quedaron en ERROR o PENDIENTE de empuje. */
export async function reintentarClientesPendientes(): Promise<{ ok: number; fallidos: number }> {
  if (!alegraConfigurado()) return { ok: 0, fallidos: 0 };

  const pendientes = await prisma.cliente.findMany({
    where: { estadoSync: { in: [EstadoSync.ERROR, EstadoSync.PENDIENTE] }, activo: true },
    select: { id: true, nombre: true, rfc: true, email: true, telefono: true, alegraId: true },
    take: 50,
  });
  let ok = 0;
  let fallidos = 0;
  for (const c of pendientes) {
    const res = await pushClienteAAlegra(c);
    if (res.ok) ok += 1;
    else fallidos += 1;
  }
  return { ok, fallidos };
}
