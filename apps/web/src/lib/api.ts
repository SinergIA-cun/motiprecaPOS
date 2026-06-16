import type {
  AuthUser,
  CreateClienteInput,
  CreateProductoInput,
  CreateSucursalInput,
  CreateUsuarioInput,
  Rol,
  UpdateClienteInput,
  UpdateProductoInput,
  UpdateSucursalInput,
  UpdateUsuarioInput,
} from '@motipreca/shared';
import { useAuthStore } from '../stores/auth';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/** Error de la API con código y mensaje legibles para el usuario. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit, withAuth: boolean): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include', // envía/recibe la cookie de refresh
    headers: {
      // Solo declarar JSON cuando hay body; si no, Fastify intenta parsear
      // un body vacío y responde 400 (rompía /auth/refresh y /auth/logout).
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(withAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let code = 'ERROR';
    let message = 'Ocurrió un error. Intenta de nuevo.';
    let details: unknown;
    try {
      const body = (await res.json()) as ApiErrorBody;
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      details = body.error?.details;
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new ApiError(res.status, code, message, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    ),
  refresh: () => request<AuthResponse>('/auth/refresh', { method: 'POST' }, false),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }, false),
};

// ---- Administración (solo Admin) ----

export interface Sucursal {
  id: string;
  nombre: string;
  prefijoFolio: string;
  direccion: string;
  telefono: string | null;
  email: string | null;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsuarioAdmin {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  iniciales: string;
  sucursalId: string | null;
  activo: boolean;
  has2FA: boolean;
  ultimoLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  sucursal?: { id: string; nombre: string; prefijoFolio: string } | null;
}

export interface UsuariosFilter {
  sucursalId?: string;
  rol?: Rol;
  activo?: boolean;
}

export interface Cliente {
  id: string;
  nombre: string;
  tipo: 'INDIVIDUAL' | 'EMPRESA';
  telefono: string | null;
  email: string | null;
  rfc: string | null;
  notas: string | null;
  sucursalId: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientesFilter {
  q?: string;
  activo?: boolean;
  sucursalId?: string;
}

export const clientesApi = {
  list: (filter: ClientesFilter = {}) => {
    const qs = new URLSearchParams();
    if (filter.q) qs.set('q', filter.q);
    if (filter.activo !== undefined) qs.set('activo', String(filter.activo));
    if (filter.sucursalId) qs.set('sucursalId', filter.sucursalId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ data: Cliente[] }>(`/clientes${suffix}`, {}, true).then((r) => r.data);
  },
  create: (input: CreateClienteInput) =>
    request<{ data: Cliente }>(
      '/clientes',
      { method: 'POST', body: JSON.stringify(input) },
      true,
    ).then((r) => r.data),
  update: (id: string, input: UpdateClienteInput) =>
    request<{ data: Cliente }>(
      `/clientes/${id}`,
      { method: 'PATCH', body: JSON.stringify(input) },
      true,
    ).then((r) => r.data),
};

export type Unidad = 'M2' | 'PZA' | 'ML' | 'KG' | 'JGO' | 'LT' | 'M3' | 'TON';
export type TipoProducto = 'BAJO_PEDIDO' | 'STOCK_SIN_REPOSICION' | 'STOCK_MINIMO';

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  unidad: Unidad;
  tipoProducto: TipoProducto;
  precioBase: string; // Decimal serializado como string
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductosFilter {
  q?: string;
  activo?: boolean;
  categoria?: string;
}

export const productosApi = {
  list: (filter: ProductosFilter = {}) => {
    const qs = new URLSearchParams();
    if (filter.q) qs.set('q', filter.q);
    if (filter.activo !== undefined) qs.set('activo', String(filter.activo));
    if (filter.categoria) qs.set('categoria', filter.categoria);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ data: Producto[] }>(`/productos${suffix}`, {}, true).then((r) => r.data);
  },
  create: (input: CreateProductoInput) =>
    request<{ data: Producto }>(
      '/productos',
      { method: 'POST', body: JSON.stringify(input) },
      true,
    ).then((r) => r.data),
  update: (id: string, input: UpdateProductoInput) =>
    request<{ data: Producto }>(
      `/productos/${id}`,
      { method: 'PATCH', body: JSON.stringify(input) },
      true,
    ).then((r) => r.data),
};

export const sucursalesApi = {
  list: () => request<{ data: Sucursal[] }>('/sucursales', {}, true).then((r) => r.data),
  create: (input: CreateSucursalInput) =>
    request<{ data: Sucursal }>(
      '/sucursales',
      { method: 'POST', body: JSON.stringify(input) },
      true,
    ).then((r) => r.data),
  update: (id: string, input: UpdateSucursalInput) =>
    request<{ data: Sucursal }>(
      `/sucursales/${id}`,
      { method: 'PATCH', body: JSON.stringify(input) },
      true,
    ).then((r) => r.data),
};

export const usuariosApi = {
  list: (filter: UsuariosFilter = {}) => {
    const qs = new URLSearchParams();
    if (filter.sucursalId) qs.set('sucursalId', filter.sucursalId);
    if (filter.rol) qs.set('rol', filter.rol);
    if (filter.activo !== undefined) qs.set('activo', String(filter.activo));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ data: UsuarioAdmin[] }>(`/usuarios${suffix}`, {}, true).then((r) => r.data);
  },
  create: (input: CreateUsuarioInput) =>
    request<{ data: UsuarioAdmin }>(
      '/usuarios',
      { method: 'POST', body: JSON.stringify(input) },
      true,
    ).then((r) => r.data),
  update: (id: string, input: UpdateUsuarioInput) =>
    request<{ data: UsuarioAdmin }>(
      `/usuarios/${id}`,
      { method: 'PATCH', body: JSON.stringify(input) },
      true,
    ).then((r) => r.data),
};
