-- CreateTable
CREATE TABLE "AccesoCaja" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ip" TEXT,
    "ruta" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccesoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccesoCaja_usuarioId_idx" ON "AccesoCaja"("usuarioId");

-- CreateIndex
CREATE INDEX "AccesoCaja_createdAt_idx" ON "AccesoCaja"("createdAt");

-- AddForeignKey
ALTER TABLE "AccesoCaja" ADD CONSTRAINT "AccesoCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
