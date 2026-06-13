import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="text-center">
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-navy-500">Error 404</p>
        <h1 className="mt-3 font-display text-6xl font-black tracking-tight text-navy-900">
          Página no encontrada
        </h1>
        <p className="mx-auto mt-3 max-w-md text-slate-500">
          La ruta que buscas no existe o fue movida.
        </p>
        <Link
          to="/dashboard"
          className="mt-7 inline-flex h-11 items-center rounded-lg bg-navy-700 px-6 font-display text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-navy-900"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
