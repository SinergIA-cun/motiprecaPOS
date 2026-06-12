# Motipreca POS

Sistema integrado de POS, Cotizaciones, CRM y Producción para Motipreca.

**Desarrollado por SinergIA** para Motipreca SA de CV.

## Estado del proyecto

🚧 En desarrollo activo — Fase 1 (MVP)

## Documentación

Toda la planeación, arquitectura y decisiones técnicas están en `/docs/handoff/`.

Empieza por:

- [`docs/handoff/00_README.md`](docs/handoff/00_README.md) — instrucciones generales
- [`docs/handoff/01_plan_formal_motipreca.md`](docs/handoff/01_plan_formal_motipreca.md) — plan completo del proyecto
- [`docs/handoff/06_plan_semana_1.md`](docs/handoff/06_plan_semana_1.md) — plan de la primera semana

## Stack

- Monorepo: Turborepo + pnpm
- Backend: Node.js 20 + TypeScript + Fastify + Prisma + PostgreSQL 16 + Redis
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- POS: Electron + React
- Deploy: Hostinger VPS + EasyPanel
- Integración fiscal: Alegra (Fase 1.5)

## Setup local

_Por documentar cuando el setup esté listo (Semana 1)._

## Licencia

Propiedad de SinergIA. Todos los derechos reservados.
