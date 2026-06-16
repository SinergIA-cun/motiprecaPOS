-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('INDIVIDUAL', 'EMPRESA');

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCliente" NOT NULL DEFAULT 'INDIVIDUAL',
    "telefono" TEXT,
    "email" TEXT,
    "rfc" TEXT,
    "notas" TEXT,
    "sucursalId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "alegraId" TEXT,
    "estadoSync" "EstadoSync" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_alegraId_key" ON "Cliente"("alegraId");

-- CreateIndex
CREATE INDEX "Cliente_sucursalId_idx" ON "Cliente"("sucursalId");

-- CreateIndex
CREATE INDEX "Cliente_activo_idx" ON "Cliente"("activo");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
