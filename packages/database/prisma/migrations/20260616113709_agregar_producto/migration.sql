-- CreateEnum
CREATE TYPE "Unidad" AS ENUM ('M2', 'PZA', 'ML', 'KG', 'JGO', 'LT', 'M3', 'TON');

-- CreateEnum
CREATE TYPE "TipoProducto" AS ENUM ('BAJO_PEDIDO', 'STOCK_SIN_REPOSICION', 'STOCK_MINIMO');

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "unidad" "Unidad" NOT NULL DEFAULT 'PZA',
    "tipoProducto" "TipoProducto" NOT NULL DEFAULT 'BAJO_PEDIDO',
    "precioBase" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "alegraId" TEXT,
    "estadoSync" "EstadoSync" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_key" ON "Producto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_alegraId_key" ON "Producto"("alegraId");

-- CreateIndex
CREATE INDEX "Producto_codigo_idx" ON "Producto"("codigo");

-- CreateIndex
CREATE INDEX "Producto_activo_idx" ON "Producto"("activo");
