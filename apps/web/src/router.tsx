import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminRoute } from './components/AdminRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ClientesPage } from './features/clientes/ClientesPage';
import { CotizacionBuilderPage } from './features/cotizaciones/CotizacionBuilderPage';
import { CotizacionDetailPage } from './features/cotizaciones/CotizacionDetailPage';
import { CotizacionPrintPage } from './features/cotizaciones/CotizacionPrintPage';
import { CotizacionesPage } from './features/cotizaciones/CotizacionesPage';
import { POSPage } from './features/pos/POSPage';
import { TicketPage } from './features/pos/TicketPage';
import { ProductosPage } from './features/productos/ProductosPage';
import { ReglasAprobacionPage } from './features/admin/reglas/ReglasAprobacionPage';
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
          { path: '/pos', element: <POSPage /> },
          { path: '/clientes', element: <ClientesPage /> },
          { path: '/productos', element: <ProductosPage /> },
          { path: '/cotizaciones', element: <CotizacionesPage /> },
          { path: '/cotizaciones/nueva', element: <CotizacionBuilderPage /> },
          { path: '/cotizaciones/:id', element: <CotizacionDetailPage /> },
          {
            element: <AdminRoute />,
            children: [
              { path: '/admin/sucursales', element: <SucursalesPage /> },
              { path: '/admin/usuarios', element: <UsuariosPage /> },
              { path: '/admin/reglas-aprobacion', element: <ReglasAprobacionPage /> },
            ],
          },
        ],
      },
      { path: '/cotizaciones/:id/imprimir', element: <CotizacionPrintPage /> },
      { path: '/ventas/:id/ticket', element: <TicketPage /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
