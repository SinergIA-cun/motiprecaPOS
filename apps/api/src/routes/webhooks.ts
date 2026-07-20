// Receptor de webhooks de Alegra.
//
// Alegra NO firma sus webhooks ni permite headers propios, así que la
// autenticación posible es un segmento secreto en la URL (viaja sobre HTTPS) y,
// sobre todo, no confiar en el cuerpo: del payload solo tomamos el id y el dato
// real lo re-consultamos a la API de Alegra con nuestras credenciales.
//
// El evento viene en la RUTA, no en el cuerpo: registramos una URL distinta por
// evento. Así no dependemos de un formato de payload que Alegra no documenta.
//
// Alegra exige 2XX en menos de 5 s y borra la suscripción tras 10 fallos
// seguidos de entrega. Por eso contestamos de inmediato y procesamos después.
import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { desactivarClienteDeAlegra, jalarClienteDeAlegra } from '../lib/alegra/pull.js';
import { env } from '../lib/env.js';

/** Eventos de contacto que atendemos. Uno por ruta registrada en Alegra. */
const EVENTOS_CLIENTE = ['new-client', 'edit-client', 'delete-client'] as const;
type EventoCliente = (typeof EVENTOS_CLIENTE)[number];

function esEventoCliente(v: string): v is EventoCliente {
  return (EVENTOS_CLIENTE as readonly string[]).includes(v);
}

/** Comparación en tiempo constante: evita adivinar el secreto midiendo latencia. */
function secretoValido(recibido: string): boolean {
  const esperado = env.ALEGRA_WEBHOOK_SECRET;
  if (!esperado) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Saca el id del contacto del cuerpo del webhook.
 *
 * Alegra documenta los eventos pero no el formato del cuerpo que entrega, así
 * que buscamos en las ubicaciones plausibles en vez de asumir una. Si no
 * aparece, el llamador lo registra y el barrido de reconciliación lo corrige:
 * el webhook es el camino rápido, no el único.
 */
export function extraerIdContacto(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;

  const candidatos: unknown[] = [
    b.id,
    (b.data as Record<string, unknown> | undefined)?.id,
    (b.message as Record<string, unknown> | undefined)?.id,
    (b.subject as Record<string, unknown> | undefined)?.id,
  ];

  for (const c of candidatos) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
  }

  // Alegra manda subject/message como texto en algunos eventos; si ahí viene un
  // id numérico suelto, lo tomamos.
  for (const campo of [b.message, b.subject]) {
    if (typeof campo === 'string') {
      const m = campo.match(/\b(\d{3,})\b/);
      if (m?.[1]) return m[1];
    }
  }

  return null;
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/webhooks/alegra/:secreto/:evento', async (request, reply) => {
    const { secreto, evento } = request.params as { secreto: string; evento: string };

    // 404 y no 401: si el secreto no cuadra, el endpoint no existe para quien
    // pregunta. No confirmamos que haya algo aquí.
    if (!secretoValido(secreto) || !esEventoCliente(evento)) {
      reply.code(404);
      return { error: 'No encontrado' };
    }

    const idContacto = extraerIdContacto(request.body);

    // Respondemos ya. El trabajo real va después para no acercarnos al límite
    // de 5 s ni arriesgar que Alegra dé de baja la suscripción.
    reply.code(200).send({ recibido: true });

    if (!idContacto) {
      // Registramos el cuerpo para aprender el formato real la primera vez que
      // llegue uno de producción; el barrido cubre este caso mientras tanto.
      request.log.warn(
        { evento, body: request.body },
        'Webhook de Alegra sin id de contacto identificable',
      );
      return;
    }

    try {
      if (evento === 'delete-client') {
        const res = await desactivarClienteDeAlegra(idContacto);
        request.log.info({ evento, idContacto, afectados: res.afectados }, 'Webhook Alegra');
        return;
      }

      const res = await jalarClienteDeAlegra(idContacto);
      if (res.ok) {
        request.log.info({ evento, idContacto, accion: res.accion }, 'Webhook Alegra');
      } else {
        request.log.warn({ evento, idContacto, err: res.error }, 'Webhook Alegra falló');
      }
    } catch (err) {
      request.log.error({ evento, idContacto, err }, 'Webhook Alegra explotó');
    }
  });
}
