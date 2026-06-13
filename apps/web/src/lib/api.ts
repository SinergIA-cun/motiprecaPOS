import type { AuthUser } from '@motipreca/shared';
import { useAuthStore } from '../stores/auth';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/** Error de la API con código y mensaje legibles para el usuario. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit, withAuth: boolean): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include', // envía/recibe la cookie de refresh
    headers: {
      'Content-Type': 'application/json',
      ...(withAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let code = 'ERROR';
    let message = 'Ocurrió un error. Intenta de nuevo.';
    try {
      const body = (await res.json()) as ApiErrorBody;
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new ApiError(res.status, code, message);
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
