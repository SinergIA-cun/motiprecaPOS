// @motipreca/database — PrismaClient compartido + re-export de tipos/enums generados.

import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

/** Instancia única de PrismaClient para toda la app. */
export const prisma = new PrismaClient();
