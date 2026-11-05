-- Sesiones (refresh tokens) e intentos de login pasan de Redis a Postgres.
-- Al desplegar esto, las sesiones abiertas en Redis dejan de valer: todos los
-- usuarios vuelven a iniciar sesión una vez. Es aceptable (refresh de 7 días).

CREATE TABLE "SesionRefresh" (
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionRefresh_pkey" PRIMARY KEY ("tokenHash")
);

CREATE TABLE "IntentoLogin" (
    "email" TEXT NOT NULL,
    "fallos" INTEGER NOT NULL,
    "ventanaHasta" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntentoLogin_pkey" PRIMARY KEY ("email")
);

CREATE INDEX "SesionRefresh_usuarioId_idx" ON "SesionRefresh"("usuarioId");
CREATE INDEX "SesionRefresh_expiraEn_idx" ON "SesionRefresh"("expiraEn");

ALTER TABLE "SesionRefresh" ADD CONSTRAINT "SesionRefresh_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
