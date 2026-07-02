import {
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  ShieldCheck,
  Store,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/cn';

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
  roles?: string[];
}

const NAV_OPERACION: NavEntry[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, ready: true },
  {
    to: '/pos',
    label: 'Punto de venta',
    icon: Store,
    ready: true,
    roles: ['CAJERO', 'GERENTE', 'ADMINISTRADOR'],
  },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: FileText, ready: true },
  { to: '/clientes', label: 'Clientes', icon: Users, ready: true },
  { to: '/productos', label: 'Productos', icon: Package, ready: true },
];

const NAV_ADMIN: NavEntry[] = [
  { to: '/admin/sucursales', label: 'Sucursales', icon: Building2, ready: true },
  { to: '/admin/usuarios', label: 'Usuarios', icon: UserCog, ready: true },
  { to: '/admin/reglas-aprobacion', label: 'Reglas de aprobación', icon: ShieldCheck, ready: true },
  { to: '/admin/caja', label: 'Caja en efectivo', icon: Wallet, ready: true },
];

function NavItem({ item }: { item: NavEntry }) {
  if (!item.ready) {
    return (
      <span className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-navy-400/70">
        <item.icon size={18} strokeWidth={1.75} />
        {item.label}
        <span className="ml-auto font-mono text-[0.58rem] uppercase tracking-wide text-navy-400">
          pronto
        </span>
      </span>
    );
  }
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
          isActive
            ? 'bg-navy-700 font-medium text-white'
            : 'text-navy-200 hover:bg-white/5 hover:text-white',
        )
      }
    >
      <item.icon size={18} strokeWidth={1.75} />
      {item.label}
    </NavLink>
  );
}

function NavGroup({ title, items }: { title: string; items: NavEntry[] }) {
  return (
    <div className="mb-2">
      <p className="px-3 pb-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-navy-400">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavItem item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.rol === 'ADMINISTRADOR';
  const operacion = NAV_OPERACION.filter(
    (e) => !e.roles || (user ? e.roles.includes(user.rol) : false),
  );

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="grid min-h-screen grid-cols-[248px_1fr]">
      {/* Sidebar — navy, disciplina Swiss */}
      <aside className="flex flex-col bg-navy-900 text-white">
        <div className="border-b border-white/10 px-6 py-5">
          <img
            src="/logo-motipreca.png"
            alt="Motipreca"
            className="h-7 w-auto brightness-0 invert"
          />
        </div>

        <nav className="flex-1 px-3 py-5">
          <NavGroup title="Operación" items={operacion} />
          {isAdmin ? <NavGroup title="Administración" items={NAV_ADMIN} /> : null}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid h-9 w-9 flex-none place-items-center rounded-md bg-navy-700 font-display text-sm font-bold text-white">
              {user?.iniciales ?? '··'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user?.nombre}</p>
              <p className="truncate font-mono text-[0.6rem] uppercase tracking-wide text-navy-400">
                {user?.rol.replace(/_/g, ' ')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="ml-auto grid h-8 w-8 place-items-center rounded-md text-navy-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut size={17} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
