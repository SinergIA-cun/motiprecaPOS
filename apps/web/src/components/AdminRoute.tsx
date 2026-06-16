import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/** Restringe rutas a Administrador. Se monta dentro de ProtectedRoute. */
export function AdminRoute() {
  const { user } = useAuth();
  if (user?.rol !== 'ADMINISTRADOR') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
