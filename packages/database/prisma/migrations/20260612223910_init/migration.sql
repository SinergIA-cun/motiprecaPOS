-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ASESOR', 'CAJERO', 'JEFE_DEPARTAMENTO', 'GERENTE', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "EstadoSync" AS ENUM ('PENDIENTE', 'SINCRONIZADO', 'ERROR', 'DESACTUALIZADO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('COTIZACION', 'VENTA_MOSTRADOR');

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "prefijoFolio" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "servidorLocalIp" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "alegraBodegaId" TEXT,
    "estadoSync" "EstadoSync" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" "Rol" NOT NULL,
    "iniciales" TEXT NOT NULL,
    "sucursalId" TEXT,
    "has2FA" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RangoFolio" (
    "id" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL,
    "rangoInicio" INTEGER NOT NULL,
    "rangoFin" INTEGER NOT NULL,
    "proximoFolio" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RangoFolio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sucursal_nombre_key" ON "Sucursal"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Sucursal_prefijoFolio_key" ON "Sucursal"("prefijoFolio");

-- CreateIndex
CREATE UNIQUE INDEX "Sucursal_alegraBodegaId_key" ON "Sucursal"("alegraBodegaId");

-- CreateIndex
CREATE INDEX "Sucursal_activa_idx" ON "Sucursal"("activa");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_email_idx" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_sucursalId_idx" ON "Usuario"("sucursalId");

-- CreateIndex
CREATE INDEX "RangoFolio_sucursalId_idx" ON "RangoFolio"("sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "RangoFolio_sucursalId_tipoDocumento_key" ON "RangoFolio"("sucursalId", "tipoDocumento");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RangoFolio" ADD CONSTRAINT "RangoFolio_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
