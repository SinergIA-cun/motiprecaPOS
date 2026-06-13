import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

/** Bloquea rutas internas: si no hay sesión, redirige a /login. */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
