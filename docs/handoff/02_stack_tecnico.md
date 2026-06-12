# 02 — Stack Técnico

## Decisiones finales

| Capa | Tecnología | Versión |
|---|---|---|
| **Monorepo** | Turborepo + pnpm | última estable |
| **Backend** | Node.js + TypeScript | Node 20 LTS |
| **Backend framework** | Fastify | v4+ |
| **ORM** | Prisma | última estable |
| **BD principal** | PostgreSQL | 16 |
| **Cache + Colas** | Redis | 7 |
| **Colas (lib)** | BullMQ | última |
| **Logs** | Pino | última |
| **Frontend Web** | React + TypeScript | React 18, TS 5 |
| **Build tool** | Vite | última |
| **Estilos** | TailwindCSS | v3 |
| **Componentes UI** | shadcn/ui | última |
| **State servidor** | TanStack Query (React Query) | v5 |
| **State cliente** | Zustand | última |
| **Formularios** | React Hook Form + Zod | últimas |
| **Router** | React Router | v6 |
| **POS Desktop** | Electron + React | última |
| **Validación** | Zod (compartida front+back) | última |
| **Auth** | JWT (access) + Refresh tokens (httpOnly) + 2FA TOTP | - |
| **Tests unit** | Vitest | última |
| **Tests e2e** | Playwright | última |
| **Lint/Format** | ESLint + Prettier | últimas |
| **Pre-commit** | Husky + lint-staged | últimas |
| **Hosting** | Hostinger VPS KVM 2 | Ubuntu 24.04 LTS |
| **Plataforma deploy** | EasyPanel | preinstalado |
| **Proxy + SSL** | Traefik (incluido en EasyPanel) | - |
| **Repositorio** | GitHub privado, org SinergIA | - |
| **CI/CD** | EasyPanel + GitHub (auto-deploy) | - |
| **Emails** | Resend | última API |
| **Storage PDFs** | Cloudflare R2 (S3-compatible) | - |
| **Integración fiscal** | Alegra API REST | v1 |

## Estructura del repositorio

```
motipreca/
├── apps/
│   ├── web/                       # App React (asesores, gerentes, admin)
│   │   ├── src/
│   │   ├── public/
│   │   │   ├── logo.png          # Fer lo subirá aquí
│   │   │   ├── logo-blanco.png
│   │   │   └── favicon.ico
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── pos/                       # App Electron (cajeros)
│   │   ├── src/
│   │   ├── electron.config.ts
│   │   └── package.json
│   └── api/                       # Backend Fastify
│       ├── src/
│       │   ├── modules/          # Por dominio (cotizaciones, clientes, etc.)
│       │   ├── lib/              # Utilidades
│       │   ├── middlewares/
│       │   ├── workers/          # BullMQ workers
│       │   └── server.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── database/                  # Prisma schema + migraciones + seeds
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── package.json
│   ├── shared/                    # Tipos y validaciones Zod compartidas
│   │   ├── src/
│   │   │   ├── schemas/          # Zod schemas (cotizacion, cliente, etc.)
│   │   │   ├── types/            # Tipos derivados
│   │   │   └── enums/            # Enums compartidos (roles, estados)
│   │   └── package.json
│   └── ui/                        # Componentes React compartidos
│       ├── src/
│       │   ├── components/       # shadcn/ui components
│       │   └── theme/            # Tokens de diseño Motipreca
│       └── package.json
├── docs/
│   ├── decisions/                 # ADRs
│   │   └── 0001-stack-tecnico.md
│   ├── handoff/                   # Estos documentos
│   ├── deployment/                # Guías de despliegue
│   └── user-manuals/              # Manuales por rol (entregables)
├── scripts/                       # Scripts útiles
│   └── import-products-excel.ts   # Importador del catálogo
├── .env.example
├── .gitignore
├── docker-compose.yml             # Desarrollo local
├── docker-compose.prod.yml        # Producción en EasyPanel
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

## Justificación de decisiones clave

### ¿Por qué Fastify y no Express?

- Más rápido (importante a futuro)
- Validación con Zod nativa (alinea con el resto del stack)
- Mejor soporte TypeScript
- Plugin system maduro

### ¿Por qué Prisma?

- Tipos TypeScript autogenerados desde el schema
- Migraciones declarativas
- Menos errores que SQL crudo
- Soporte excelente para PostgreSQL

### ¿Por qué Zod compartido entre front y back?

- Un solo lugar para definir validaciones
- Tipos derivados (`z.infer<typeof schema>`)
- Mismas reglas en cliente (UX) y servidor (seguridad)

### ¿Por qué Electron para POS?

- Reutiliza 95% del código de la web app
- App de escritorio nativa para Windows
- Acceso a sistema de archivos para impresión de tickets
- Permite el modo offline conectando a servidor local

### ¿Por qué Turborepo + pnpm?

- Builds incrementales
- Cache compartido entre packages
- pnpm es más rápido y eficiente en espacio que npm/yarn
- Stack moderno bien soportado

## Variables de entorno

Crear `.env.example` con TODAS las variables necesarias documentadas:

```bash
# === BACKEND ===

# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/motipreca

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=                 # Generar con: openssl rand -base64 64
JWT_REFRESH_SECRET=         # Generar con: openssl rand -base64 64
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Servidor
PORT=3000
NODE_ENV=development        # development | production
LOG_LEVEL=info              # debug | info | warn | error

# CORS
CORS_ORIGIN=http://localhost:5173

# === INTEGRACIONES (Semana 5+) ===

# Alegra
ALEGRA_API_URL=https://api.alegra.com/api/v1
ALEGRA_API_TOKEN=           # NUNCA commitear

# Resend
RESEND_API_KEY=             # NUNCA commitear

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=motipreca-pdfs

# === MÓDULO OCULTO ===

# Hash de URL secreta (generar una vez al deploy)
HIDDEN_MODULE_HASH=         # 32 chars aleatorios

# === FRONTEND ===

VITE_API_URL=http://localhost:3000
VITE_APP_NAME=Motipreca
```

## Reglas de commits

Usar **Conventional Commits**:

```
feat: nueva funcionalidad
fix: corrección de bug
docs: cambios en documentación
refactor: refactor sin cambio funcional
test: agregar o cambiar tests
chore: tareas de mantenimiento
perf: mejora de performance
style: formato, sin cambio de código
```

Ejemplos:
- `feat(cotizaciones): agregar estado pendiente aprobación cliente`
- `fix(auth): corregir refresh token expiration`
- `docs(adr): documentar decisión de Fastify vs Express`

## Branches

- `main` → producción (deploy automático a EasyPanel)
- `develop` → desarrollo (rama de integración)
- `feature/[nombre]` → features individuales
- `fix/[nombre]` → bugfixes
- `hotfix/[nombre]` → fixes urgentes a producción

**Pull Requests obligatorios** antes de merge a `main`.
