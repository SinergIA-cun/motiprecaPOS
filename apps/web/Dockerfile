# syntax=docker/dockerfile:1
# Motipreca — Web (React/Vite). El contexto de build es la RAÍZ del monorepo.
# Etapa 1: build del bundle estático. Etapa 2: nginx que lo sirve.
FROM node:24-bookworm-slim AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# Vite hornea las variables VITE_* en build time. EasyPanel las pasa como
# "Build arguments" (NO como variables de runtime: el bundle ya quedó fijo).
ARG VITE_API_URL
ARG VITE_APP_NAME=Motipreca
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
RUN pnpm exec turbo run build --filter=@motipreca/web

# --- runtime: nginx estático ---
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
