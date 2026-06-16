import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminRoute } from './components/AdminRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ClientesPage } from './features/clientes/ClientesPage';
import { SucursalesPage } from './features/admin/sucursales/SucursalesPage';
import { UsuariosPage } from './features/admin/usuarios/UsuariosPage';
import { AppLayout } from './layouts/AppLayout';
import { NotFound } from './pages/NotFound';

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/clientes', element: <ClientesPage /> },
          {
            element: <AdminRoute />,
            children: [
              { path: '/admin/sucursales', element: <SucursalesPage /> },
              { path: '/admin/usuarios', element: <UsuariosPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
