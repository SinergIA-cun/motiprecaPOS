# Motipreca POS

Sistema integrado de **POS, Cotizaciones, CRM y Producción** para Motipreca SA de CV
(3 sucursales: Cancún, Playa del Carmen, Mérida).

**Desarrollado por SinergIA.** Es la primera pieza de un ecosistema mayor (administración,
BI, producción) hospedado en un VPS de Hostinger con EasyPanel.

## Estado

🚧 Fase 1 (MVP) en desarrollo. Base lista: autenticación y administración de sucursales y
usuarios. En vivo en `https://motipos.somossinergia.com`.

## Stack

| Capa               | Tecnología                                                                             |
| ------------------ | -------------------------------------------------------------------------------------- |
| Monorepo           | Turborepo + pnpm (workspaces)                                                          |
| Runtime            | Node.js 24 LTS                                                                         |
| Backend            | Fastify 5 · Prisma 6 · PostgreSQL 16 · Redis 7 · Zod · JWT (jose) · argon2id           |
| Frontend           | React 18 · Vite 6 · Tailwind CSS v4 · TanStack Query · Zustand · React Hook Form + Zod |
| UI                 | Librería de componentes propia (sin shadcn) — estilo "Swiss utilitario" en navy        |
| Deploy             | Docker en EasyPanel (VPS Hostinger), build desde GitHub                                |
| Integración fiscal | Alegra (Fase 1.5 — Estrategia B)                                                       |

> Las desviaciones respecto al plan de handoff y su justificación están en
> [docs/adr/0001-stack-tecnico.md](docs/adr/0001-stack-tecnico.md).

## Estructura

```
apps/
  api/        # Fastify (API REST)
  web/        # React + Vite (SPA)
packages/
  database/   # Prisma: client, schema y seed
  shared/     # Tipos y validaciones Zod compartidos (front + back)
  ui/         # (reservado)
docs/
  handoff/    # Material de la fase de planeación
  adr/        # Architecture Decision Records
```

## Setup local

Requisitos: Node 24, pnpm 11 (vía `corepack`), Docker.

```bash
corepack enable
pnpm install

# Postgres (host :5433) + Redis (:6379) en Docker
docker compose up -d

# Variables de entorno (rellena los JWT_* con: openssl rand -base64 64)
cp .env.example .env

# Base de datos
pnpm db:migrate        # aplica migraciones
pnpm db:seed           # 3 sucursales + usuarios de prueba

# Desarrollo: API en :3000, Web en :5173
pnpm dev
```

Usuario de prueba: `admin@test.com` / `test1234`.

## Scripts

| Script                                      | Acción                             |
| ------------------------------------------- | ---------------------------------- |
| `pnpm dev`                                  | API + Web en desarrollo            |
| `pnpm build`                                | Compila todos los paquetes         |
| `pnpm typecheck`                            | `tsc --noEmit` en todo el monorepo |
| `pnpm lint` / `pnpm format`                 | ESLint / Prettier                  |
| `pnpm db:migrate` / `db:seed` / `db:studio` | Prisma                             |

## Despliegue

EasyPanel construye las imágenes desde GitHub (`main`) directamente en el VPS. Hay dos
servicios de aplicación (`motipreca_api`, `motipreca_web`) más Postgres y Redis
administrados. Variables de producción: ver [.env.production.example](.env.production.example).
Guía y notas de configuración: [docs/handoff/07_setup_easypanel.md](docs/handoff/07_setup_easypanel.md).

## Licencia

Propiedad de SinergIA. Todos los derechos reservados.
