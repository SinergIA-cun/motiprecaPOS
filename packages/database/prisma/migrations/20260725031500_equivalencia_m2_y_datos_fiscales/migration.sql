-- Equivalencia m² ↔ piezas (captura por superficie en cotizador y POS)
-- + datos fiscales del cliente para CFDI 4.0 + bandera "requiere factura".

-- CreateEnum
CREATE TYPE "UnidadCaptura" AS ENUM ('PZA', 'M2');

-- AlterTable: equivalencia del producto (dato LOCAL, Alegra no lo conoce)
ALTER TABLE "Producto" ADD COLUMN     "piezasPorM2" DECIMAL(10,4);

-- AlterTable: cómo se capturó cada partida. `cantidad` sigue siendo piezas.
ALTER TABLE "ItemCotizacion" ADD COLUMN     "unidadCaptura" "UnidadCaptura" NOT NULL DEFAULT 'PZA',
ADD COLUMN     "cantidadM2" DECIMAL(10,2),
ADD COLUMN     "mermaPct" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "ItemVenta" ADD COLUMN     "unidadCaptura" "UnidadCaptura" NOT NULL DEFAULT 'PZA',
ADD COLUMN     "cantidadM2" DECIMAL(10,2),
ADD COLUMN     "mermaPct" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable: datos fiscales del cliente (CFDI 4.0)
ALTER TABLE "Cliente" ADD COLUMN     "razonSocial" TEXT,
ADD COLUMN     "regimenFiscal" TEXT,
ADD COLUMN     "codigoPostalFiscal" TEXT,
ADD COLUMN     "usoCFDI" TEXT;

-- AlterTable: ¿el cliente pide factura?
ALTER TABLE "Cotizacion" ADD COLUMN     "requiereFactura" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Venta" ADD COLUMN     "requiereFactura" BOOLEAN NOT NULL DEFAULT false;
