import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { EMPRESA } from '../../lib/empresa';
import { formatMoney } from '../../lib/format';

// Página pública: destino del QR impreso en la cotización (plan §13).
// No requiere sesión y no muestra datos sensibles del cliente.

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type EstadoPublico = 'VIGENTE' | 'VENCIDA' | 'PAGADA' | 'CANCELADA' | 'EN_PROCESO';

interface CotizacionPublica {
  folio: string;
  estado: EstadoPublico;
  emitidaPara: string;
  total: string;
  fecha: string;
  vigenciaHasta: string;
  sucursal: string;
  telefonoSucursal: string | null;
  asesor: string;
  conceptos: { descripcion: string; cantidad: string }[];
}

const ESTADO_INFO: Record<
  EstadoPublico,
  { label: string; detalle: string; clase: string; icono: ReactNode }
> = {
  VIGENTE: {
    label: 'Documento válido',
    detalle: 'Esta cotización fue emitida por Motipreca y está vigente.',
    clase: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icono: <CheckCircle2 size={22} strokeWidth={2} />,
  },
  EN_PROCESO: {
    label: 'Documento válido',
    detalle: 'Esta cotización fue emitida por Motipreca y está en proceso de autorización.',
    clase: 'border-navy-200 bg-navy-50 text-navy-800',
    icono: <Clock size={22} strokeWidth={2} />,
  },
  PAGADA: {
    label: 'Documento válido · pagada',
    detalle: 'Esta cotización fue emitida por Motipreca y ya fue cobrada.',
    clase: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icono: <CheckCircle2 size={22} strokeWidth={2} />,
  },
  VENCIDA: {
    label: 'Documento válido · vencido',
    detalle: 'Esta cotización es auténtica, pero su vigencia terminó. Los precios pueden cambiar.',
    clase: 'border-amber-200 bg-amber-50 text-amber-800',
    icono: <Clock size={22} strokeWidth={2} />,
  },
  CANCELADA: {
    label: 'Cotización cancelada',
    detalle: 'Esta cotización fue cancelada. Contacta a tu asesor para una nueva.',
    clase: 'border-red-200 bg-red-50 text-red-700',
    icono: <XCircle size={22} strokeWidth={2} />,
  },
};

const dateFmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

export function VerificarPage() {
  const { id = '' } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['verificar', id],
    queryFn: async (): Promise<CotizacionPublica> => {
      const res = await fetch(`${BASE_URL}/public/cotizaciones/${id}`);
      if (!res.ok) throw new Error('No encontrada');
      const body = (await res.json()) as { data: CotizacionPublica };
      return body.data;
    },
    enabled: Boolean(id),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-paper px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <img src="/logo-motipreca.png" alt="Motipreca" className="mx-auto h-9 w-auto" />
          <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-400">
            Verificación de cotización
          </p>
        </div>

        {isLoading ? (
          <p className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-400">
            Verificando…
          </p>
        ) : isError || !data ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
            <XCircle size={26} strokeWidth={2} className="mx-auto text-red-600" />
            <p className="mt-3 font-display text-lg font-bold text-red-800">
              No encontramos esta cotización
            </p>
            <p className="mt-1 text-sm text-red-700">
              Verifica el código o contacta a Motipreca para confirmar el documento.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Veredicto */}
            <div
              className={`flex items-start gap-3 rounded-xl border px-5 py-4 ${ESTADO_INFO[data.estado].clase}`}
            >
              <span className="mt-0.5 shrink-0">{ESTADO_INFO[data.estado].icono}</span>
              <div>
                <p className="font-display text-base font-bold">{ESTADO_INFO[data.estado].label}</p>
                <p className="mt-0.5 text-sm">{ESTADO_INFO[data.estado].detalle}</p>
              </div>
            </div>

            {/* Datos del documento */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">
                Folio
              </p>
              <p className="font-mono text-xl font-bold text-navy-900">{data.folio}</p>

              <dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm">
                <Dato label="Emitida para" valor={data.emitidaPara} />
                <Dato label="Fecha" valor={fmtDate(data.fecha)} />
                <Dato label="Vigente hasta" valor={fmtDate(data.vigenciaHasta)} />
                <Dato label="Sucursal" valor={data.sucursal} />
                <Dato label="Asesor" valor={data.asesor} />
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                  <dt className="font-display font-bold text-navy-900">Total</dt>
                  <dd className="font-display text-lg font-bold text-navy-900">
                    {formatMoney(data.total)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Conceptos: qué y cuánto, sin precios unitarios */}
            {data.conceptos.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <p className="mb-3 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">
                  Conceptos
                </p>
                <ul className="space-y-2 text-sm">
                  {data.conceptos.map((c, i) => (
                    <li
                      key={`${c.descripcion}-${i}`}
                      className="flex justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-navy-900">{c.descripcion}</span>
                      <span className="shrink-0 font-mono text-slate-500">
                        {Number(c.cantidad)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="px-2 text-center text-xs leading-relaxed text-slate-500">
              ¿Dudas sobre este documento? Contacta a Motipreca
              {data.telefonoSucursal ? ` al ${data.telefonoSucursal}` : ''} o visita {EMPRESA.web}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-navy-900">{valor}</dd>
    </div>
  );
}
