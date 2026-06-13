import { authApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';

/** Acceso a la sesión + acciones de login/logout. */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);

  async function login(email: string, password: string): Promise<void> {
    const { accessToken, user } = await authApi.login(email, password);
    setSession(accessToken, user);
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } finally {
      clear();
    }
  }

  return {
    user,
    status,
    isAuthenticated: status === 'authenticated',
    login,
    logout,
  };
}
