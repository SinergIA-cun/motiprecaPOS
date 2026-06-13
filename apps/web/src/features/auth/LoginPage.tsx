import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@motipreca/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/api';

const GRID_BG = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '46px 46px',
} as const;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      await login(data.email, data.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.');
    }
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      {/* Panel de marca — Editorial Industrial */}
      <section
        className="relative hidden flex-col justify-between gap-8 overflow-hidden bg-navy-900 px-15 py-13 text-white lg:flex"
        style={GRID_BG}
      >
        <span
          className="pointer-events-none absolute right-14 top-14 h-6 w-6 opacity-35"
          aria-hidden="true"
        >
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-navy-300" />
          <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-navy-300" />
        </span>

        <img
          src="/logo-motipreca.png"
          alt="Motipreca"
          className="relative h-9 w-auto self-start brightness-0 invert"
        />

        <div className="relative">
          <h1 className="font-display text-6xl font-black uppercase leading-[0.95] tracking-tight">
            Construido
            <br />
            sobre <span className="text-navy-300">concreto.</span>
          </h1>
          <p className="mt-6 max-w-[32ch] text-[1.02rem] leading-relaxed text-navy-200">
            Sistema de cotizaciones y punto de venta. Tres sucursales, una sola operación.
          </p>
          <div className="mt-7 flex items-center gap-3 font-display text-xs uppercase tracking-[0.18em] text-navy-400">
            <span className="h-px w-16 bg-navy-600" /> Sinergia × Motipreca
          </div>
        </div>

        <div className="relative border-t border-white/12 pt-6">
          <div className="flex gap-11 font-display text-[0.68rem] font-semibold uppercase tracking-widest text-navy-300">
            <div>
              <b className="mb-1 block font-display text-2xl font-extrabold tracking-tight text-white">
                3
              </b>
              Sucursales
            </div>
            <div>
              <b className="mb-1 block font-display text-2xl font-extrabold tracking-tight text-white">
                POS
              </b>
              + Cotizador
            </div>
            <div>
              <b className="mb-1 block font-display text-2xl font-extrabold tracking-tight text-white">
                CRM
              </b>
              Integrado
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-sm text-navy-200">
            <span className="h-1.5 w-1.5 rounded-full bg-navy-300" />
            Cancún · Playa del Carmen · Mérida
          </div>
        </div>
      </section>

      {/* Panel de formulario */}
      <section className="flex items-center justify-center px-6 py-12">
        <form onSubmit={onSubmit} noValidate className="w-full max-w-sm">
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-navy-500">
            Acceso al sistema
          </p>
          <h2 className="mb-1 mt-2 font-display text-3xl font-extrabold tracking-tight text-navy-900">
            Inicia sesión
          </h2>
          <p className="mb-9 text-[0.94rem] text-slate-500">
            Ingresa tus credenciales para continuar.
          </p>

          {formError ? (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {formError}
            </div>
          ) : null}

          <Field label="Correo electrónico" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@motipreca.com"
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Field label="Contraseña" htmlFor="password" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>

          <div className="-mt-1 mb-6 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-500">
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-navy-700" />
              Recordarme
            </label>
            <a href="#" className="text-sm font-medium text-navy-500 hover:text-navy-700">
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </Button>

          {import.meta.env.DEV ? (
            <p className="mt-6 rounded-md bg-slate-100 px-3 py-2 text-center font-mono text-xs text-slate-500">
              Prueba: admin@test.com · test1234
            </p>
          ) : (
            <p className="mt-6 text-xs text-slate-400">
              Acceso restringido al personal autorizado de Motipreca.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
