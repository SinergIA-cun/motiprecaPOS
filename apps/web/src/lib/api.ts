import type {
  AuthUser,
  CreateClienteInput,
  CreateCotizacionInput,
  CreateProductoInput,
  CreateSucursalInput,
  CreateUsuarioInput,
  EstadoCotizacion,
  Rol,
  UpdateClienteInput,
  UpdateProductoInput,
  UpdateSucursalInput,
  UpdateUsuarioInput,
} from '@motipreca/shared';

export type { EstadoCotizacion } from '@motipreca/shared';
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

// ---- Sincronización Alegra (Gerente/Admin) ----

export interface AlegraSyncSummary {
  clientes: { creados: number; actualizados: number; omitidos: number; total: number };
  productos: { creados: number; actualizados: number; total: number };
  detalle: string[];
}

/** El endpoint responde 200 siempre (el proxy enmascara los 5xx): ok=true con datos, o ok=false con el error. */
export type AlegraSyncResult = { ok: true; data: AlegraSyncSummary } | { ok: false; error: string };

export const syncApi = {
  alegra: () => request<AlegraSyncResult>('/sync/alegra', { method: 'POST' }, true),
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

// ---- Cotizaciones (montos llegan como string: Decimal serializado) ----

export interface CotizacionListItem {
  id: string;
  folio: string;
  estado: EstadoCotizacion;
  total: string;
  createdAt: string;
  vigenciaHasta: string;
  cliente: { id: string; nombre: string };
  sucursal: { prefijoFolio: string };
  asesor: { nombre: string; iniciales: string };
}

export interface ItemCotizacion {
  id: string;
  productoId: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  descuentoPct: string;
  importe: string;
  orden: number;
}

export interface AprobacionDetalle {
  id: string;
  nivel: number;
  decision: 'APROBAR' | 'RECHAZAR';
  motivo: string | null;
  createdAt: string;
  aprobador: { nombre: string; iniciales: string };
}

export interface CotizacionDetail {
  id: string;
  folio: string;
  estado: EstadoCotizacion;
  subtotal: string;
  descuentoTotal: string;
  iva: string;
  total: string;
  requiereAprobacion: boolean;
  motivoAprobacion: string | null;
  vigencia: number;
  vigenciaHasta: string;
  observaciones: string | null;
  createdAt: string;
  items: ItemCotizacion[];
  cliente: {
    id: string;
    nombre: string;
    rfc: string | null;
    telefono: string | null;
    email: string | null;
  };
  sucursal: { id: string; nombre: string; prefijoFolio: string };
  asesor: { nombre: string; iniciales: string };
  aprobaciones: AprobacionDetalle[];
}

export interface CotizacionesFilter {
  estado?: EstadoCotizacion;
  clienteId?: string;
  q?: string;
}

export const cotizacionesApi = {
  list: (filter: CotizacionesFilter = {}) => {
    const qs = new URLSearchParams();
    if (filter.estado) qs.set('estado', filter.estado);
    if (filter.clienteId) qs.set('clienteId', filter.clienteId);
    if (filter.q) qs.set('q', filter.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ data: CotizacionListItem[] }>(`/cotizaciones${suffix}`, {}, true).then(
      (r) => r.data,
    );
  },
  get: (id: string) =>
    request<{ data: CotizacionDetail }>(`/cotizaciones/${id}`, {}, true).then((r) => r.data),
  create: (input: CreateCotizacionInput) =>
    request<{ data: CotizacionDetail }>(
      '/cotizaciones',
      { method: 'POST', body: JSON.stringify(input) },
      true,
    ).then((r) => r.data),
  updateEstado: (id: string, estado: EstadoCotizacion) =>
    request<{ data: CotizacionDetail }>(
      `/cotizaciones/${id}/estado`,
      { method: 'PATCH', body: JSON.stringify({ estado }) },
      true,
    ).then((r) => r.data),
  enviarAprobacion: (id: string) =>
    request<{ data: CotizacionDetail }>(
      `/cotizaciones/${id}/enviar-aprobacion`,
      { method: 'POST' },
      true,
    ).then((r) => r.data),
  aprobar: (id: string) =>
    request<{ data: CotizacionDetail }>(
      `/cotizaciones/${id}/aprobar`,
      { method: 'POST' },
      true,
    ).then((r) => r.data),
  rechazar: (id: string, motivo?: string) =>
    request<{ data: CotizacionDetail }>(
      `/cotizaciones/${id}/rechazar`,
      { method: 'POST', body: JSON.stringify({ motivo: motivo ?? '' }) },
      true,
    ).then((r) => r.data),
  reabrir: (id: string) =>
    request<{ data: CotizacionDetail }>(
      `/cotizaciones/${id}/reabrir`,
      { method: 'POST' },
      true,
    ).then((r) => r.data),
};

// ---- Configuración (Administrador) ----

export interface ReglaAprobacion {
  id: string;
  nivel: number;
  nombre: string;
  rolAprobador: Rol;
  descuentoMinimo: string | null; // Decimal serializado; null = disparador off
  montoMinimo: string | null;
  activo: boolean;
}

export const configApi = {
  getReglaAprobacion: () =>
    request<{ data: ReglaAprobacion }>('/config/aprobacion', {}, true).then((r) => r.data),
  updateReglaAprobacion: (input: { descuentoMinimo: number | null; montoMinimo: number | null }) =>
    request<{ data: ReglaAprobacion }>(
      '/config/aprobacion',
      { method: 'PUT', body: JSON.stringify(input) },
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
