# syntax=docker/dockerfile:1
# Motipreca — API (Fastify). El contexto de build es la RAÍZ del monorepo.
FROM node:24-bookworm-slim

# Prisma necesita openssl; ca-certificates para HTTPS saliente (Alegra, Resend...).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

# 1) Solo los manifests primero: capa de dependencias cacheable entre deploys.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

# 2) Código fuente + build. turbo compila shared -> database (incluye `prisma
#    generate` para ESTA imagen Linux) -> api, en orden de dependencias.
COPY . .
RUN pnpm exec turbo run build --filter=@motipreca/api

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Sano solo si Postgres y Redis responden (la ruta /health devuelve 503 si no).
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Aplica migraciones (idempotente) y arranca. prisma CLI está disponible porque
# la imagen conserva las devDependencies del workspace.
CMD ["sh", "-c", "pnpm --filter @motipreca/database run migrate:deploy && node apps/api/dist/server.js"]
