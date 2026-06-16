-- CreateEnum
CREATE TYPE "EstadoCotizacion" AS ENUM ('ABIERTA', 'APROBADA', 'RECHAZADA', 'COBRADA', 'EXPIRADA', 'ELIMINADA');

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "estado" "EstadoCotizacion" NOT NULL DEFAULT 'ABIERTA',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuentoTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vigencia" INTEGER NOT NULL DEFAULT 15,
    "vigenciaHasta" TIMESTAMP(3) NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCotizacion" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "descuentoPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "importe" DECIMAL(12,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ItemCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_folio_key" ON "Cotizacion"("folio");

-- CreateIndex
CREATE INDEX "Cotizacion_sucursalId_idx" ON "Cotizacion"("sucursalId");

-- CreateIndex
CREATE INDEX "Cotizacion_asesorId_idx" ON "Cotizacion"("asesorId");

-- CreateIndex
CREATE INDEX "Cotizacion_clienteId_idx" ON "Cotizacion"("clienteId");

-- CreateIndex
CREATE INDEX "Cotizacion_estado_idx" ON "Cotizacion"("estado");

-- CreateIndex
CREATE INDEX "Cotizacion_folio_idx" ON "Cotizacion"("folio");

-- CreateIndex
CREATE INDEX "ItemCotizacion_cotizacionId_idx" ON "ItemCotizacion"("cotizacionId");

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCotizacion" ADD CONSTRAINT "ItemCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCotizacion" ADD CONSTRAINT "ItemCotizacion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
