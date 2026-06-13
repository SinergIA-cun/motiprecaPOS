import { useAuth } from '../../hooks/useAuth';

const STATS = [
  { label: 'Sucursales', value: '03', meta: 'Cancún · Playa · Mérida' },
  { label: 'Cotizaciones', value: '—', meta: 'Disponible en Semana 2' },
  { label: 'Clientes', value: '—', meta: 'Disponible en Semana 2' },
  { label: 'Ventas del día', value: '—', meta: 'Disponible con el POS' },
];

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      {/* Barra superior con hairline (Swiss) */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-lg font-bold tracking-tight text-navy-900">Dashboard</h1>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-400">
            / Resumen
          </span>
        </div>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-400">
          {user?.sucursalId ? 'Sucursal asignada' : 'Acceso global'}
        </span>
      </header>

      <main className="flex-1 px-8 py-8">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-navy-500">
          Bienvenido
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-navy-900">
          {user?.nombre}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Sesión iniciada como{' '}
          <span className="font-medium text-slate-700">{user?.rol.replace(/_/g, ' ')}</span>.
        </p>

        {/* Métricas — tarjetas con hairline + números en mono */}
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white p-5">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-400">
                {s.label}
              </p>
              <p className="mt-2 font-mono text-3xl font-medium tracking-tight text-navy-800">
                {s.value}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">{s.meta}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-500">
            El módulo de cotizaciones llega en la{' '}
            <span className="font-medium text-navy-700">Semana 2</span>. Esta es la base del
            sistema: autenticación, sucursales y usuarios.
          </p>
        </div>
      </main>
    </>
  );
}
