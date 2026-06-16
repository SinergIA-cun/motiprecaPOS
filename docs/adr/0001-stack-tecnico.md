# ADR 0001 — Stack técnico y desviaciones del handoff

- **Estado:** Aceptada
- **Fecha:** 2026-06-15
- **Referencia:** plan original en [../handoff/02_stack_tecnico.md](../handoff/02_stack_tecnico.md)

## Contexto

El handoff define el stack objetivo. Al implementar el scaffold y la autenticación de la
Semana 1 surgieron decisiones concretas y desviaciones puntuales. Este ADR las registra con
su justificación, para que el equipo futuro entienda el "por qué" y no las revierta sin
contexto.

## Decisión

Stack adoptado:

- **Monorepo:** Turborepo + pnpm
- **Runtime:** Node 24 LTS
- **Backend:** Fastify 5, Prisma 6, PostgreSQL 16, Redis 7
- **Frontend:** React 18, Vite 6, Tailwind v4
- **Validación compartida:** Zod en `@motipreca/shared`

### Desviaciones respecto al handoff y por qué

1. **Node 24 LTS (el handoff decía 20).** Node 20 entra en mantenimiento; 24 es el LTS
   vigente. Sin impacto en dependencias.
2. **Sin shadcn/ui — librería de componentes propia.** Se construyeron componentes propios
   (`Button`, `Input`, `Field`, `Select`, `Modal`, `Badge`) sobre Tailwind v4 (config
   CSS-first con `@theme` vía `@tailwindcss/vite`). Razón: control total del look "Swiss
   utilitario" en navy, menos dependencias y bundle más pequeño.
3. **Auth: access token JWT corto (15 min, solo en memoria) + refresh opaco en Redis
   (whitelist con rotación)**, en lugar de un refresh JWT con blacklist. Razón: revocación
   inmediata (borrar la clave en Redis), rotación en cada uso, y el access token nunca toca
   `localStorage` (se restaura al cargar vía `/auth/refresh`). La cookie del refresh es
   `httpOnly`, `SameSite=Strict`, `path=/auth` y `Secure` en producción.
4. **Throttle de login por cuenta (5 intentos / 15 min) además del rate-limit global por IP
   (100/min).** El límite por IP no protege una cuenta detrás de NAT; el throttle por cuenta
   sí. Se usa un hash dummy de argon2 para igualar tiempos y no delatar si el correo existe.
5. **argon2id vía `@node-rs/argon2` (binarios precompilados).** Evita compilación nativa y
   funciona en el contenedor Linux del VPS.
6. **Esquema `hidden` de Prisma (caja de efectivo) diferido.** Prisma rechaza declarar un
   schema sin tablas; se habilitará (`schemas = ["public", "hidden"]`) junto con su primer
   modelo (Semana 4-5). El módulo de efectivo será un **registro interno auditable y
   separado**, no un mecanismo anti-auditoría.
7. **Estrategia B (sin Alegra primero).** El modelo de datos incluye desde el día 1 campos
   nullable `alegraId`/`estadoSync` para integrar Alegra en la Fase 1.5 sin migraciones
   disruptivas.
8. **Paquetes internos compilados a `dist/`.** `@motipreca/shared` y `@motipreca/database`
   compilan a JS para que el API corra con `node dist/server.js` en producción; `turbo`
   ordena el build por dependencias.

## Consecuencias

- **Positivas:** menos dependencias de UI, sesiones revocables al instante, login más
  resistente a fuerza bruta, despliegue Docker reproducible e integración de Alegra sin
  retrabajo de esquema.
- **Costos:** mantener componentes de UI propios; el esquema `hidden` se activa más adelante
  (no es bloqueante).
- **Pendientes conocidos:**
  - 2FA TOTP para Administrador (campos `has2FA`/`totpSecret` ya en el modelo, sin cablear).
  - Refresh automático del access token al expirar (401 → `/auth/refresh` → reintento).
