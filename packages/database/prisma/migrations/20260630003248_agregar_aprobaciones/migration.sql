-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('APROBAR', 'RECHAZAR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoCotizacion" ADD VALUE 'PENDIENTE_APROBACION_INTERNA';
ALTER TYPE "EstadoCotizacion" ADD VALUE 'RECHAZADA_INTERNA';

-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "motivoAprobacion" TEXT,
ADD COLUMN     "requiereAprobacion" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NivelAprobacion" (
    "id" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "rolAprobador" "Rol" NOT NULL,
    "descuentoMinimo" DECIMAL(5,2),
    "montoMinimo" DECIMAL(12,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NivelAprobacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aprobacion" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "aprobadorId" TEXT NOT NULL,
    "decision" "Decision" NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aprobacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialCotizacion" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "estadoAnterior" "EstadoCotizacion",
    "estadoNuevo" "EstadoCotizacion" NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NivelAprobacion_nivel_key" ON "NivelAprobacion"("nivel");

-- CreateIndex
CREATE INDEX "Aprobacion_cotizacionId_idx" ON "Aprobacion"("cotizacionId");

-- CreateIndex
CREATE INDEX "HistorialCotizacion_cotizacionId_idx" ON "HistorialCotizacion"("cotizacionId");

-- CreateIndex
CREATE INDEX "HistorialCotizacion_createdAt_idx" ON "HistorialCotizacion"("createdAt");

-- AddForeignKey
ALTER TABLE "Aprobacion" ADD CONSTRAINT "Aprobacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aprobacion" ADD CONSTRAINT "Aprobacion_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialCotizacion" ADD CONSTRAINT "HistorialCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
