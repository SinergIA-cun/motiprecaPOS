# 06 — Plan de Semana 1

> Esta es la primera semana de desarrollo. Al final, Fer debe poder correr el proyecto localmente y ver que funciona.

## Objetivo de la Semana 1

Tener un esqueleto funcional con:
- Monorepo configurado
- Backend que arranca
- Frontend que arranca y conecta al backend
- BD con migraciones iniciales
- Autenticación funcional (login con JWT)
- Sucursales y usuarios sembrados
- Deploy inicial a EasyPanel funcionando

**No vamos a tener cotizaciones todavía**. Solo la base sólida.

## Día 1 — Setup del monorepo

### Tareas

1. Crear repositorio privado `motipreca` en la org SinergIA de GitHub
2. Inicializar Turborepo con pnpm
3. Crear estructura de carpetas según `02_stack_tecnico.md`
4. Configurar `tsconfig.json` base, ESLint, Prettier
5. Configurar Husky + lint-staged para validación pre-commit
6. Crear `.env.example` con todas las variables documentadas
7. Crear `.gitignore` completo
8. Primer commit y push a `main`

### Entregable

```bash
git clone [repo]
cd motipreca
pnpm install
pnpm dev  # debe arrancar (aunque sea con apps vacías)
```

### Cómo probar

- `pnpm install` no falla
- `pnpm typecheck` no falla
- `pnpm lint` no falla
- El repo está en GitHub con `main` protegida (require PR)

## Día 2 — Backend base + BD

### Tareas

1. Configurar Fastify en `apps/api` con TypeScript
2. Configurar Pino para logs estructurados con redacción de secrets
3. Configurar Prisma en `packages/database` con multi-schema (`public` + `hidden`)
4. Definir schema inicial con: Usuario, Sucursal, RangoFolio
5. Crear migración inicial
6. Configurar `docker-compose.yml` para desarrollo local (PostgreSQL + Redis)
7. Endpoint `/health` que valida conexión a BD y Redis
8. Configurar Zod en `packages/shared` con primeros schemas (login)

### Entregable

```bash
# Arrancar BD + Redis
docker compose up -d

# Correr migraciones
pnpm db:migrate

# Arrancar API
pnpm dev:api

# En otra terminal
curl http://localhost:3000/health
# {"status":"ok","db":"ok","redis":"ok"}
```

### Cómo probar

- BD arranca con `docker compose up`
- Migraciones se aplican sin error
- API responde en `/health` con `ok`
- Conexión a BD y Redis confirmada

## Día 3 — Autenticación

### Tareas

1. Endpoint `POST /auth/login` con email + password
2. Hash de password con argon2id en seeds
3. Generación de access token (15 min) + refresh token (7 días)
4. Refresh token en httpOnly cookie
5. Endpoint `POST /auth/refresh` para renovar access token
6. Endpoint `POST /auth/logout` que invalida refresh token
7. Middleware de autenticación que valida JWT en endpoints protegidos
8. Middleware de roles que valida permisos
9. Rate limiting en endpoints de auth
10. Seed de usuarios de prueba (uno por rol)

### Entregable

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"test1234"}'

# Devuelve:
# {
#   "accessToken": "...",
#   "user": {...}
# }

# Endpoint protegido
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer [accessToken]"
```

### Cómo probar

- Login con credenciales válidas → 200 + token
- Login con credenciales inválidas → 401
- Endpoint protegido sin token → 401
- Endpoint protegido con token válido → 200
- Refresh token funciona
- Logout invalida el refresh token
- Después de 6 intentos fallidos en 15 min → bloqueo temporal

### Seed de usuarios

```ts
// Usuarios de prueba (password: "test1234" para todos)
[
  { email: 'admin@test.com', rol: 'ADMINISTRADOR', sucursal: null },
  { email: 'gerente@test.com', rol: 'GERENTE', sucursal: null },
  { email: 'jefe-cun@test.com', rol: 'JEFE_DEPARTAMENTO', sucursal: 'Cancún' },
  { email: 'asesor-cun@test.com', rol: 'ASESOR', sucursal: 'Cancún' },
  { email: 'cajero-cun@test.com', rol: 'CAJERO', sucursal: 'Cancún' },
  { email: 'asesor-pdc@test.com', rol: 'ASESOR', sucursal: 'Playa del Carmen' },
  { email: 'cajero-mid@test.com', rol: 'CAJERO', sucursal: 'Mérida' },
]
```

## Día 4 — Frontend base

### Tareas

1. Configurar Vite + React + TypeScript en `apps/web`
2. Configurar TailwindCSS con paleta Motipreca:
   - Primario: `#1A3A8C`
   - Secundario: `#2C5AA0`
   - Fondo gris: `#F5F6F8`
3. Instalar shadcn/ui base
4. Configurar React Router con rutas: `/login`, `/dashboard`, `/404`
5. Configurar TanStack Query
6. Configurar Zustand para state de autenticación
7. Crear `useAuth` hook
8. Pantalla de login funcional conectada al backend
9. Dashboard placeholder protegido (redirige a login si no hay sesión)
10. Setup de Inter (UI) y Roboto Mono (números) como fuentes

### Entregable

```bash
pnpm dev:web
# Abre http://localhost:5173
# Te muestra pantalla de login
# Login con admin@test.com / test1234 → te lleva al dashboard
# Refrescar el browser → mantiene sesión
# Logout → vuelve al login
```

### Cómo probar

- Login visualmente correcto con identidad Motipreca
- Login exitoso lleva al dashboard
- Sesión persiste al refrescar (vía refresh token)
- Logout limpia sesión
- Acceder a `/dashboard` sin sesión → redirige a login
- Layout responsivo (mobile + desktop)

## Día 5 — Sucursales y usuarios CRUD

### Tareas

1. CRUD de sucursales (solo Administrador):
   - `GET /sucursales`
   - `POST /sucursales`
   - `PUT /sucursales/:id`
2. CRUD de usuarios (solo Administrador):
   - `GET /usuarios`
   - `POST /usuarios`
   - `PUT /usuarios/:id`
   - `DELETE /usuarios/:id` (soft delete)
3. Validación con Zod en todos los endpoints
4. Filtros por sucursal y rol
5. UI básica para administrar sucursales y usuarios

### Entregable

Pantallas funcionales:
- `/admin/sucursales` (lista, crear, editar)
- `/admin/usuarios` (lista, crear, editar, desactivar)

### Cómo probar

- Crear sucursal nueva desde UI
- Crear usuario y asignarle sucursal
- Login con el usuario nuevo
- Asesor NO puede ver `/admin/usuarios` (403)
- Gerente NO puede crear usuarios (solo ver)
- Administrador puede todo

## Día 6 — Setup de EasyPanel + primer deploy

### Tareas

1. Crear cuenta admin en EasyPanel del VPS
2. Configurar dominio (que Fer haya elegido) apuntando al VPS
3. Configurar Let's Encrypt para SSL
4. Crear servicios en EasyPanel:
   - PostgreSQL 16
   - Redis 7
   - App: `motipreca-api`
   - App: `motipreca-web`
5. Configurar variables de entorno en EasyPanel (secrets)
6. Conectar EasyPanel con GitHub
7. Configurar deploy automático en push a `main`
8. Primer deploy
9. Validar que todo funcione en producción

### Entregable

```
https://[dominio].com           → Frontend en producción
https://api.[dominio].com       → API en producción
```

Con login funcionando contra la BD de producción.

### Cómo probar

- Visitar el dominio público
- Login con seed user
- Crear una sucursal de prueba
- Cerrar sesión
- Verificar que el SSL funciona (candado verde)

## Día 7 — Polishing y documentación

### Tareas

1. Documentar setup local en `README.md` del repo
2. Crear primer ADR: `docs/decisions/0001-stack-tecnico.md`
3. Configurar GitHub Actions para CI (tests + lint en cada PR)
4. Limpiar TODOs pendientes de la semana
5. Revisión completa con Fer:
   - Walkthrough del código generado
   - Walkthrough de la UI
   - Validación de que todo funciona
6. Planeación de Semana 2 (cotizaciones)

### Entregable

- README claro con instrucciones de setup
- CI verde
- Sistema deployado y operativo
- Plan de Semana 2 acordado con Fer

## Resumen visual de la Semana 1

```
Día 1: Monorepo + GitHub
Día 2: Backend + BD + Health
Día 3: Autenticación + Seeds
Día 4: Frontend + Login
Día 5: Sucursales + Usuarios CRUD
Día 6: Deploy a EasyPanel
Día 7: Polishing + Plan Semana 2
```

## Cosas que NO hacer en Semana 1

- ❌ NO empezar con cotizaciones (es Semana 2-3)
- ❌ NO tocar Alegra (es Semana 7-8)
- ❌ NO construir POS Electron (es Semana 4)
- ❌ NO implementar módulo oculto (es Semana 5)
- ❌ NO sobre-diseñar (mantener simple)

## Preguntas que Claude Code debe hacer a Fer ANTES de empezar Semana 1

Si tienes alguna ambigüedad sobre cualquier punto, pregunta. Algunas que probablemente necesites:

1. **Dominio**: ¿qué dominio/subdominio se va a usar? (debe estar listo antes del Día 6)
2. **Logo**: ¿está disponible en alta resolución? (Día 4 lo necesitas)
3. **Mérida**: ¿dirección y teléfono confirmados?
4. **Email para usuarios de prueba**: ¿usamos los placeholder `@test.com` o tienes preferencia?
5. **Diseño visual**: ¿hacemos mockups antes de Día 4, o vamos directo con shadcn/ui + paleta Motipreca?
