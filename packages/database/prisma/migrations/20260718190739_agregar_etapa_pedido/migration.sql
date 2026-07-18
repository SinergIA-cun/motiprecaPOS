-- CreateEnum
CREATE TYPE "EtapaPedido" AS ENUM ('EN_PRODUCCION', 'LISTO_EN_ALMACEN', 'ENTREGA_PROGRAMADA', 'ENTREGADO');

-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "etapaPedido" "EtapaPedido";
