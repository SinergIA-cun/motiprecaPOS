import type { AuthUser } from '@motipreca/shared';
import { create } from 'zustand';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  setSession: (accessToken: string, user: AuthUser) => void;
  clear: () => void;
}

/**
 * El access token vive solo en memoria (no localStorage) por seguridad.
 * La sesión se restaura al recargar vía /auth/refresh (cookie httpOnly).
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'loading',
  setSession: (accessToken, user) => set({ accessToken, user, status: 'authenticated' }),
  clear: () => set({ accessToken: null, user: null, status: 'unauthenticated' }),
}));
