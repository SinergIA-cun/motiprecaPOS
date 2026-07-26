import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Restringe rutas a Gerente y Administrador. Se monta dentro de ProtectedRoute.
 *
 * Existe aparte de `AdminRoute` porque hay secciones de administración que la
 * API abre a gerencia (sincronizar catálogo, cargar equivalencias): gatearlas
 * solo a Administrador dejaría fuera a quien puede ejecutarlas.
 */
export function GerenciaRoute() {
  const { user } = useAuth();
  if (user?.rol !== 'GERENTE' && user?.rol !== 'ADMINISTRADOR') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
