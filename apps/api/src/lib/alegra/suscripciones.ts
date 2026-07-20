// Alta y mantenimiento de las suscripciones de webhook en Alegra.
//
// Alegra borra una suscripción tras 10 fallos consecutivos de entrega. Un
// despliegue con la API caída el tiempo suficiente nos deja sin webhooks y sin
// aviso. Por eso re-aseguramos las suscripciones en cada arranque y además
// corre un barrido periódico que reconcilia por si se perdió algún evento.
import type { FastifyBaseLogger } from 'fastify';
import { alegraConfigurado, createSubscription, listSubscriptions } from './client.js';
import { reintentarClientesPendientes } from './push.js';
import { syncFromAlegra } from './sync.js';

/** Eventos de cliente que escuchamos. El evento va en la URL, no en el cuerpo. */
const EVENTOS = ['new-client', 'edit-client', 'delete-client'] as const;

function urlDeEvento(base: string, secreto: string, evento: string): string {
  return `${base.replace(/\/+$/, '')}/webhooks/alegra/${secreto}/${evento}`;
}

/**
 * Asegura que existan las suscripciones. Idempotente: consulta las actuales y
 * solo crea las que faltan. Nunca lanza — si Alegra no responde, la app arranca
 * igual y el barrido sigue cubriendo la sincronización.
 */
export async function asegurarSuscripciones(
  log: FastifyBaseLogger,
  opciones: { apiPublicUrl?: string; secreto?: string },
): Promise<void> {
  const { apiPublicUrl, secreto } = opciones;

  if (!alegraConfigurado()) return;
  if (!apiPublicUrl || !secreto) {
    log.info(
      'Webhooks de Alegra desactivados: falta API_PUBLIC_URL o ALEGRA_WEBHOOK_SECRET. La sincronización queda a cargo del barrido.',
    );
    return;
  }

  try {
    const actuales = await listSubscriptions();
    const urlsRegistradas = new Set(actuales.map((s) => `${s.event}|${s.url}`));

    for (const evento of EVENTOS) {
      const url = urlDeEvento(apiPublicUrl, secreto, evento);
      if (urlsRegistradas.has(`${evento}|${url}`)) continue;
      await createSubscription(evento, url);
      log.info({ evento }, 'Suscripción de webhook creada en Alegra');
    }
  } catch (err) {
    log.warn({ err }, 'No se pudieron asegurar las suscripciones de Alegra');
  }
}

/**
 * Barrido de reconciliación. Es la red de seguridad de todo el esquema:
 * cubre webhooks perdidos, suscripciones dadas de baja por Alegra y empujes
 * nuestros que fallaron. Nunca lanza.
 */
export async function barridoReconciliacion(log: FastifyBaseLogger): Promise<void> {
  if (!alegraConfigurado()) return;

  try {
    const reintentos = await reintentarClientesPendientes();
    const resumen = await syncFromAlegra();
    log.info(
      {
        empujados: reintentos.ok,
        fallidos: reintentos.fallidos,
        clientes: resumen.clientes,
        productos: resumen.productos,
      },
      'Barrido de reconciliación con Alegra',
    );
  } catch (err) {
    log.warn({ err }, 'Barrido de reconciliación con Alegra falló');
  }
}
