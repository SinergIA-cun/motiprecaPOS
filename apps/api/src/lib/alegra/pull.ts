// Alegra → Motipreca. Trae un contacto de Alegra y lo refleja aquí.
//
// Dos reglas que gobiernan todo este archivo:
//
// 1. NUNCA confiamos en el cuerpo del webhook. Alegra no firma sus webhooks ni
//    permite headers propios, así que cualquiera que descubra la URL puede
//    inventarse un payload. Del cuerpo solo sacamos "qué id cambió"; el dato
//    real lo pedimos a la API de Alegra con nuestras credenciales.
// 2. Alegra manda en los campos que ambos guardan (nombre, RFC, email,
//    teléfono). Sucursal, línea de crédito y notas son nuestros: Alegra no los
//    conoce y jamás los tocamos.
import { EstadoSync, prisma } from '@motipreca/database';
import { alegraConfigurado, fetchContact } from './client.js';
import { isCliente, mapContactToCliente } from './mapper.js';

/** Campos que Alegra dicta. El resto del cliente es nuestro y no se toca. */
type CamposDeAlegra = ReturnType<typeof mapContactToCliente>;

/**
 * Busca el cliente local que corresponde a un contacto de Alegra.
 * Orden: alegraId (vínculo explícito) → RFC → email. Así un contacto que ya
 * existía aquí sin vincular se enlaza en vez de duplicarse.
 */
async function localizarCliente(campos: CamposDeAlegra): Promise<{ id: string } | null> {
  const porAlegraId = await prisma.cliente.findFirst({
    where: { alegraId: campos.alegraId },
    select: { id: true },
  });
  if (porAlegraId) return porAlegraId;

  if (campos.rfc) {
    const porRfc = await prisma.cliente.findFirst({
      where: { rfc: campos.rfc, alegraId: null },
      select: { id: true },
    });
    if (porRfc) return porRfc;
  }

  if (campos.email) {
    const porEmail = await prisma.cliente.findFirst({
      where: { email: campos.email, alegraId: null },
      select: { id: true },
    });
    if (porEmail) return porEmail;
  }

  return null;
}

/**
 * Trae el contacto de Alegra y lo refleja localmente (alta o actualización).
 * Nunca lanza: el webhook debe responder 2XX aunque esto falle.
 */
export async function jalarClienteDeAlegra(
  alegraId: string,
): Promise<{ ok: boolean; accion?: 'creado' | 'actualizado' | 'ignorado'; error?: string }> {
  if (!alegraConfigurado()) return { ok: false, error: 'Alegra no configurado' };

  try {
    const contacto = await fetchContact(alegraId);

    // Alegra mezcla clientes y proveedores en /contacts. Solo nos importan los
    // que son cliente; un proveedor no tiene por qué aparecer en el cotizador.
    if (!isCliente(contacto)) return { ok: true, accion: 'ignorado' };

    const campos = mapContactToCliente(contacto);
    const existente = await localizarCliente(campos);

    if (existente) {
      await prisma.cliente.update({ where: { id: existente.id }, data: campos });
      return { ok: true, accion: 'actualizado' };
    }

    await prisma.cliente.create({ data: campos });
    return { ok: true, accion: 'creado' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

/**
 * Cliente borrado en Alegra. Lo desactivamos, nunca lo borramos: puede tener
 * cotizaciones y ventas colgando, y esa historia no se tira porque contabilidad
 * haya limpiado su catálogo.
 */
export async function desactivarClienteDeAlegra(
  alegraId: string,
): Promise<{ ok: boolean; afectados: number }> {
  const res = await prisma.cliente.updateMany({
    where: { alegraId },
    data: { activo: false, estadoSync: EstadoSync.DESACTUALIZADO },
  });
  return { ok: true, afectados: res.count };
}
