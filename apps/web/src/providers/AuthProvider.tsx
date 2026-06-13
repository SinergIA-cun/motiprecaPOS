import { type ReactNode, useEffect } from 'react';
import { authApi } from '../lib/api';
import { SplashScreen } from '../components/SplashScreen';
import { useAuthStore } from '../stores/auth';

// Guard a nivel módulo: evita doble hidratación con React StrictMode (dev),
// que dispararía dos /auth/refresh y la rotación invalidaría el segundo.
let hydrationStarted = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    if (hydrationStarted) return;
    hydrationStarted = true;

    authApi
      .refresh()
      .then(({ accessToken, user }) => setSession(accessToken, user))
      .catch(() => clear());
  }, [setSession, clear]);

  if (status === 'loading') return <SplashScreen />;
  return <>{children}</>;
}
