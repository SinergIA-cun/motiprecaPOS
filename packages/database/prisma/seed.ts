import { hash } from '@node-rs/argon2';
import { PrismaClient, Rol, TipoDocumento } from '@prisma/client';

const prisma = new PrismaClient();

// Datos reales de las 3 sucursales. Teléfonos pendientes de confirmar.
const SUCURSALES = [
  {
    nombre: 'Cancún',
    prefijoFolio: 'CUN',
    direccion: 'Av. López Portillo Región 100, Mza 101 Lote 1, Cancún, Q. Roo',
  },
  {
    nombre: 'Playa del Carmen',
    prefijoFolio: 'PDC',
    direccion: 'Calle 11 Sur entre Av. 80 y 85, Col. Ejidal, Playa del Carmen, Q. Roo',
  },
  {
    nombre: 'Mérida',
    prefijoFolio: 'MID',
    direccion: 'C. 32 423-por 57 y 59, El Roble Agrícola, 97255 Mérida, Yuc.',
  },
];

const RANGO_INICIO = 1;
const RANGO_FIN = 999_999;

// Usuarios de prueba. Password para todos: "test1234".
const USUARIOS = [
  {
    email: 'admin@test.com',
    nombre: 'Admin Sistema',
    rol: Rol.ADMINISTRADOR,
    iniciales: 'AD',
    sucursal: null,
  },
  {
    email: 'gerente@test.com',
    nombre: 'Gerente Ventas',
    rol: Rol.GERENTE,
    iniciales: 'GE',
    sucursal: null,
  },
  {
    email: 'jefe-cun@test.com',
    nombre: 'Jefe Cancún',
    rol: Rol.JEFE_DEPARTAMENTO,
    iniciales: 'JC',
    sucursal: 'Cancún',
  },
  {
    email: 'asesor-cun@test.com',
    nombre: 'Asesor Cancún',
    rol: Rol.ASESOR,
    iniciales: 'AC',
    sucursal: 'Cancún',
  },
  {
    email: 'cajero-cun@test.com',
    nombre: 'Cajero Cancún',
    rol: Rol.CAJERO,
    iniciales: 'CC',
    sucursal: 'Cancún',
  },
  {
    email: 'asesor-pdc@test.com',
    nombre: 'Asesor Playa',
    rol: Rol.ASESOR,
    iniciales: 'AP',
    sucursal: 'Playa del Carmen',
  },
  {
    email: 'cajero-mid@test.com',
    nombre: 'Cajero Mérida',
    rol: Rol.CAJERO,
    iniciales: 'CM',
    sucursal: 'Mérida',
  },
];

async function main(): Promise<void> {
  const sucursalIdPorNombre = new Map<string, string>();

  for (const s of SUCURSALES) {
    const sucursal = await prisma.sucursal.upsert({
      where: { nombre: s.nombre },
      update: { prefijoFolio: s.prefijoFolio, direccion: s.direccion },
      create: { nombre: s.nombre, prefijoFolio: s.prefijoFolio, direccion: s.direccion },
    });
    sucursalIdPorNombre.set(s.nombre, sucursal.id);

    for (const tipo of [TipoDocumento.COTIZACION, TipoDocumento.VENTA_MOSTRADOR]) {
      await prisma.rangoFolio.upsert({
        where: { sucursalId_tipoDocumento: { sucursalId: sucursal.id, tipoDocumento: tipo } },
        update: {},
        create: {
          sucursalId: sucursal.id,
          tipoDocumento: tipo,
          rangoInicio: RANGO_INICIO,
          rangoFin: RANGO_FIN,
          proximoFolio: RANGO_INICIO,
        },
      });
    }
  }

  const passwordHash = await hash('test1234');

  for (const u of USUARIOS) {
    const sucursalId = u.sucursal ? (sucursalIdPorNombre.get(u.sucursal) ?? null) : null;
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: { nombre: u.nombre, rol: u.rol, iniciales: u.iniciales, sucursalId },
      create: {
        email: u.email,
        passwordHash,
        nombre: u.nombre,
        rol: u.rol,
        iniciales: u.iniciales,
        sucursalId,
      },
    });
  }

  // Regla de aprobación Fase 1 (nivel 1 = Administrador). Umbrales OR editables
  // desde Admin → Reglas de aprobación. `update: {}` para no pisar lo configurado.
  await prisma.nivelAprobacion.upsert({
    where: { nivel: 1 },
    update: {},
    create: {
      nivel: 1,
      nombre: 'Administrador',
      rolAprobador: Rol.ADMINISTRADOR,
      descuentoMinimo: 15,
      montoMinimo: 50_000,
    },
  });

  console.log(
    `✅ Seed completo: ${SUCURSALES.length} sucursales, ${USUARIOS.length} usuarios (password: test1234), regla de aprobación nivel 1.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err: unknown) => {
    console.error('❌ Error en el seed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
