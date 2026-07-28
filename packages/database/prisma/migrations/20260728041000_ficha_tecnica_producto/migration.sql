-- Ficha técnica del producto: datos que Alegra no guarda y Motipos sí necesita.
--
-- `familia` va aparte de `categoria` porque esa última la sobreescribe el sync
-- de Alegra en cada pasada. Todos son NULL-ables: el catálogo llega de Alegra
-- sin ellos y se completan por CSV.
ALTER TABLE "Producto" ADD COLUMN "familia" TEXT;
ALTER TABLE "Producto" ADD COLUMN "dimensionesCm" TEXT;
ALTER TABLE "Producto" ADD COLUMN "superficieM2" DECIMAL(10,4);
ALTER TABLE "Producto" ADD COLUMN "pesoKg" DECIMAL(10,3);
