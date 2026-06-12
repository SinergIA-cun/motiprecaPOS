# 05 — Modelo de Datos

> Esta es la guía conceptual. El `schema.prisma` real lo construyes en Semana 1.
> **No copies este código tal cual** — úsalo como referencia y mejóralo donde tenga sentido.

## Schemas de PostgreSQL

El sistema usa **dos schemas en PostgreSQL** para aislar el módulo oculto:

- `public` — todo el sistema normal
- `hidden` — módulo oculto STANDBY (acceso restringido)

## Entidades del schema `public`

### Usuarios y autenticación

```prisma
model Usuario {
  id              String   @id @default(cuid())
  email           String   @unique
  passwordHash    String
  nombre          String
  telefono        String?
  rol             Rol
  iniciales       String   // para folios (ej. "RJ" para Rosaura Jiménez)
  sucursalId      String?
  sucursal        Sucursal? @relation(fields: [sucursalId], references: [id])
  
  // 2FA
  has2FA          Boolean  @default(false)
  totpSecret      String?
  
  activo          Boolean  @default(true)
  ultimoLoginAt   DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relaciones
  cotizacionesCreadas   Cotizacion[] @relation("asesor")
  aprobacionesRealizadas Aprobacion[]
  clientesAsignados     Cliente[]   @relation("asesorDueño")
  refreshTokens         RefreshToken[]
  
  @@index([email])
  @@index([sucursalId])
}

enum Rol {
  ASESOR
  CAJERO
  JEFE_DEPARTAMENTO
  GERENTE
  ADMINISTRADOR
}

model RefreshToken {
  id              String   @id @default(cuid())
  token           String   @unique
  usuarioId       String
  usuario         Usuario  @relation(fields: [usuarioId], references: [id])
  expiraEn        DateTime
  revocado        Boolean  @default(false)
  createdAt       DateTime @default(now())
  
  @@index([token])
  @@index([usuarioId])
}
```

### Sucursales

```prisma
model Sucursal {
  id              String   @id @default(cuid())
  nombre          String   @unique          // "Cancún", "Playa del Carmen", "Mérida"
  prefijoFolio    String   @unique          // "CUN", "PDC", "MID"
  direccion       String
  telefono        String
  email           String?
  
  // POS local (offline)
  servidorLocalIp String?
  
  // Listas de precios default
  listaMenudeoId  String?  // para venta mostrador
  listaMayoreoId  String?  // para asesores
  
  activa          Boolean  @default(true)
  
  // Integración Alegra (Fase 1.5)
  alegraBodegaId  String?  @unique
  estadoSync      EstadoSync @default(PENDIENTE)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relaciones
  usuarios        Usuario[]
  cotizaciones    Cotizacion[]
  ventas          Venta[]
  rangosFolios    RangoFolio[]
}

enum EstadoSync {
  PENDIENTE
  SINCRONIZADO
  ERROR
  DESACTUALIZADO
}
```

### Folios pre-asignados

```prisma
model RangoFolio {
  id              String   @id @default(cuid())
  sucursalId      String
  sucursal        Sucursal @relation(fields: [sucursalId], references: [id])
  tipoDocumento   TipoDocumento
  rangoInicio     Int
  rangoFin        Int
  proximoFolio    Int      // siguiente número disponible
  activo          Boolean  @default(true)
  
  @@unique([sucursalId, tipoDocumento])
  @@index([sucursalId])
}

enum TipoDocumento {
  COTIZACION
  VENTA_MOSTRADOR
}
```

### Productos

```prisma
model Familia {
  id              String   @id @default(cuid())
  nombre          String   @unique
  descripcion     String?
  activa          Boolean  @default(true)
  
  productos       Producto[]
}

model Producto {
  id              String   @id @default(cuid())
  codigo          String   @unique
  nombre          String
  descripcion     String?
  familiaId       String
  familia         Familia  @relation(fields: [familiaId], references: [id])
  
  unidad          Unidad
  piezasPorUnidad Int?     // para conversiones (ej. 25 piezas por M2)
  
  tipoProducto    TipoProducto
  stockMinimo     Int?     // solo si tipo = STOCK_MINIMO
  
  // Stock actual (espejo, se sincroniza con Alegra después)
  stockCancun     Int      @default(0)
  stockPlaya      Int      @default(0)
  stockMerida     Int      @default(0)
  
  activo          Boolean  @default(true)
  
  // Integración Alegra (Fase 1.5)
  alegraId        String?  @unique
  estadoSync      EstadoSync @default(PENDIENTE)
  ultimaSyncAt    DateTime?
  errorSync       String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relaciones
  precios         Precio[]
  itemsCotizacion ItemCotizacion[]
  
  @@index([familiaId])
  @@index([codigo])
}

enum Unidad {
  M2
  PZA
  ML
  KG
  JGO
  LT
  M3
  TON
}

enum TipoProducto {
  BAJO_PEDIDO          // tipo 1
  STOCK_SIN_REPOSICION // tipo 2
  STOCK_MINIMO         // tipo 3
}
```

### Listas de precios

```prisma
model ListaPrecio {
  id              String   @id @default(cuid())
  nombre          String   @unique           // "Mayoreo Cancún", "Menudeo Cancún", etc.
  sucursalId      String
  sucursal        Sucursal @relation(fields: [sucursalId], references: [id])
  tipo            TipoLista
  esDefault       Boolean  @default(false)
  activa          Boolean  @default(true)
  
  // Integración Alegra
  alegraId        String?  @unique
  estadoSync      EstadoSync @default(PENDIENTE)
  
  precios         Precio[]
}

enum TipoLista {
  MAYOREO
  MENUDEO
  ESPECIAL
}

model Precio {
  id              String   @id @default(cuid())
  productoId      String
  producto        Producto @relation(fields: [productoId], references: [id])
  listaId         String
  lista           ListaPrecio @relation(fields: [listaId], references: [id])
  precio          Decimal  @db.Decimal(12, 2)
  vigenciaDesde   DateTime?
  vigenciaHasta   DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([productoId, listaId])
}
```

### Descuentos

```prisma
model Descuento {
  id              String   @id @default(cuid())
  nombre          String
  tipo            TipoDescuento
  porcentaje      Decimal  @db.Decimal(5, 2)  // 0.00 a 100.00
  
  // Aplicabilidad
  familiaId       String?  // si es por familia
  productoId      String?  // si es por producto
  cantidadMinima  Int?     // si es por volumen
  
  // Vigencia
  vigenciaDesde   DateTime?
  vigenciaHasta   DateTime?
  
  activo          Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum TipoDescuento {
  GENERAL
  POR_FAMILIA
  POR_PRODUCTO
  POR_VOLUMEN
  PROMOCION
}
```

### Clientes

```prisma
model Cliente {
  id              String   @id @default(cuid())
  nombre          String
  tipo            TipoCliente
  telefono        String?
  email           String?
  
  // Visibilidad (CRM)
  asesorDueñoId   String?
  asesorDueño     Usuario? @relation("asesorDueño", fields: [asesorDueñoId], references: [id])
  sucursalId      String?  // sucursal donde se creó
  
  // Crédito
  lineaCreditoMax Decimal? @db.Decimal(12, 2)
  creditoUsado    Decimal  @default(0) @db.Decimal(12, 2)
  
  notas           String?
  activo          Boolean  @default(true)
  
  // Integración Alegra (Fase 1.5)
  alegraId        String?  @unique
  estadoSync      EstadoSync @default(PENDIENTE)
  ultimaSyncAt    DateTime?
  errorSync       String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relaciones
  datosFiscales   DatoFiscal[]
  direcciones     DireccionEntrega[]
  cotizaciones    Cotizacion[]
  
  @@index([asesorDueñoId])
}

enum TipoCliente {
  INDIVIDUAL
  EMPRESA
}

model DatoFiscal {
  id              String   @id @default(cuid())
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  
  rfc             String
  razonSocial     String
  regimenFiscal   String
  usoCfdi         String
  domicilioFiscal String
  
  esDefault       Boolean  @default(false)
  
  createdAt       DateTime @default(now())
  
  @@index([clienteId])
  @@index([rfc])
}

model DireccionEntrega {
  id              String   @id @default(cuid())
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  
  alias           String   // "Casa", "Obra Cancún", etc.
  direccionCompleta String
  ciudad          String
  estado          String
  cp              String?
  referencias     String?
  
  esDefault       Boolean  @default(false)
  
  createdAt       DateTime @default(now())
  
  @@index([clienteId])
}
```

### Cotizaciones

```prisma
model Cotizacion {
  id              String   @id @default(cuid())
  folio           String   @unique          // "CUN-COT-000432"
  
  sucursalId      String
  sucursal        Sucursal @relation(fields: [sucursalId], references: [id])
  asesorId        String
  asesor          Usuario  @relation("asesor", fields: [asesorId], references: [id])
  
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  datoFiscalId    String?
  direccionEntregaId String?
  
  listaPrecioId   String?  // qué lista se usó
  
  estado          EstadoCotizacion @default(ABIERTA)
  
  // Montos
  subtotal        Decimal  @db.Decimal(12, 2)
  descuentoTotal  Decimal  @db.Decimal(12, 2) @default(0)
  iva             Decimal  @db.Decimal(12, 2)
  total           Decimal  @db.Decimal(12, 2)
  
  // Cobro
  porcentajeAnticipo Decimal? @db.Decimal(5, 2) // % a cobrar como anticipo
  
  // Condiciones
  vigencia        Int      // días
  vigenciaHasta   DateTime
  condiciones     String?
  observaciones   String?
  
  // Aprobación
  requiereAprobacion Boolean @default(false)
  motivoAprobacion   String? // "descuento", "monto", "credito"
  
  // STANDBY
  esStandby       Boolean  @default(false)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relaciones
  items           ItemCotizacion[]
  historial       HistorialCotizacion[]
  aprobaciones    Aprobacion[]
  venta           Venta?
  
  @@index([sucursalId])
  @@index([asesorId])
  @@index([clienteId])
  @@index([estado])
  @@index([folio])
}

enum EstadoCotizacion {
  ABIERTA
  PENDIENTE_APROBACION_INTERNA
  APROBADA
  RECHAZADA_INTERNA
  PENDIENTE_APROBACION_CLIENTE
  COBRADA
  RECHAZADA_FINAL
  ELIMINADA
  EXPIRADA
}

model ItemCotizacion {
  id              String   @id @default(cuid())
  cotizacionId    String
  cotizacion      Cotizacion @relation(fields: [cotizacionId], references: [id])
  productoId      String
  producto        Producto @relation(fields: [productoId], references: [id])
  
  cantidad        Decimal  @db.Decimal(10, 2)
  precioUnitario  Decimal  @db.Decimal(12, 2)
  descuentoPct    Decimal  @db.Decimal(5, 2) @default(0)
  importe         Decimal  @db.Decimal(12, 2)
  
  orden           Int      // para ordenar items
  
  @@index([cotizacionId])
}
```

### Historial y aprobaciones

```prisma
model HistorialCotizacion {
  id              String   @id @default(cuid())
  cotizacionId    String
  cotizacion      Cotizacion @relation(fields: [cotizacionId], references: [id])
  usuarioId       String
  
  estadoAnterior  EstadoCotizacion?
  estadoNuevo     EstadoCotizacion
  
  camposModificados Json?  // qué cambió específicamente
  comentario      String?
  
  createdAt       DateTime @default(now())
  
  @@index([cotizacionId])
  @@index([createdAt])
}

model Aprobacion {
  id              String   @id @default(cuid())
  cotizacionId    String
  cotizacion      Cotizacion @relation(fields: [cotizacionId], references: [id])
  nivel           Int      // 1, 2, 3
  aprobadorId     String
  aprobador       Usuario  @relation(fields: [aprobadorId], references: [id])
  decision        Decision
  motivo          String?
  
  createdAt       DateTime @default(now())
  
  @@index([cotizacionId])
}

enum Decision {
  APROBAR
  RECHAZAR
}
```

### Ventas y pagos

```prisma
model Venta {
  id              String   @id @default(cuid())
  folio           String   @unique          // "CUN-VTA-000891"
  
  cotizacionId    String?  @unique
  cotizacion      Cotizacion? @relation(fields: [cotizacionId], references: [id])
  
  sucursalId      String
  sucursal        Sucursal @relation(fields: [sucursalId], references: [id])
  
  total           Decimal  @db.Decimal(12, 2)
  montoAnticipo   Decimal  @db.Decimal(12, 2)
  montoPagado     Decimal  @db.Decimal(12, 2) @default(0)
  
  esFacturada     Boolean  @default(false)
  esStandby       Boolean  @default(false)
  
  // Integración Alegra (Fase 1.5)
  alegraFacturaId String?  @unique
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  pagos           Pago[]
  
  @@index([sucursalId])
  @@index([cotizacionId])
}

model Pago {
  id              String   @id @default(cuid())
  ventaId         String
  venta           Venta    @relation(fields: [ventaId], references: [id])
  
  monto           Decimal  @db.Decimal(12, 2)
  metodoPago      MetodoPago
  comprobante     String?
  
  createdAt       DateTime @default(now())
  
  @@index([ventaId])
}

enum MetodoPago {
  EFECTIVO
  TRANSFERENCIA
  TARJETA_DEBITO
  TARJETA_CREDITO
  MIXTO
}
```

### Configuración del sistema

```prisma
model ConfigSistema {
  id              String   @id @default(cuid())
  clave           String   @unique
  valor           String   // JSON o string simple
  descripcion     String?
  
  updatedAt       DateTime @updatedAt
  updatedBy       String?  // userId
}

// Ejemplos de claves:
// - "aprobacion.nivel1.descuento"
// - "aprobacion.nivel1.monto"
// - "aprobacion.modo" -> "escalonado" | "directo"
// - "cotizacion.vigencia.default"
// - "cotizacion.condiciones.default"
// - "credito.linea.default"

model NivelAprobacion {
  id              String   @id @default(cuid())
  nivel           Int      @unique          // 1, 2, 3
  nombre          String                    // "Jefe", "Gerente", "Administrador"
  rolAprobador    Rol
  
  // Disparadores
  descuentoMinimo Decimal? @db.Decimal(5, 2)
  montoMinimo     Decimal? @db.Decimal(12, 2)
  
  activo          Boolean  @default(true)
}
```

### Auditoría

```prisma
model AuditLog {
  id              String   @id @default(cuid())
  usuarioId       String?
  accion          String   // "CREATE", "UPDATE", "DELETE", "LOGIN", etc.
  entidad         String   // "Cotizacion", "Cliente", etc.
  entidadId       String?
  valoresAntes    Json?
  valoresDespues  Json?
  ip              String?
  userAgent       String?
  
  createdAt       DateTime @default(now())
  
  @@index([usuarioId])
  @@index([entidad])
  @@index([createdAt])
}
```

### Integración Alegra

```prisma
model ColaSincronizacion {
  id              String   @id @default(cuid())
  tipo            TipoOperacion
  entidad         String
  entidadLocalId  String
  payload         Json
  intentos        Int      @default(0)
  ultimoIntentoAt DateTime?
  ultimoError     String?
  estado          EstadoCola @default(PENDIENTE)
  prioridad       Int      @default(0)
  
  createdAt       DateTime @default(now())
  
  @@index([estado])
  @@index([prioridad])
}

enum TipoOperacion {
  CREAR
  ACTUALIZAR
  ELIMINAR
}

enum EstadoCola {
  PENDIENTE
  PROCESANDO
  COMPLETADO
  ERROR_REINTENTABLE
  ERROR_FATAL
}

model LogWebhookAlegra {
  id              String   @id @default(cuid())
  evento          String
  payload         Json
  procesado       Boolean  @default(false)
  procesadoAt     DateTime?
  error           String?
  
  recibidoAt      DateTime @default(now())
  
  @@index([evento])
  @@index([procesado])
}
```

## Entidades del schema `hidden` (módulo oculto)

```prisma
// IMPORTANTE: estas tablas viven en schema "hidden"
// En Prisma: @@schema("hidden")

model HiddenAccessLog {
  id              String   @id @default(cuid())
  usuarioId       String
  ip              String
  userAgent       String?
  ruta            String
  exitoso         Boolean
  
  createdAt       DateTime @default(now())
  
  @@schema("hidden")
  @@index([usuarioId])
  @@index([createdAt])
}

model EfectivoRegistro {
  id              String   @id @default(cuid())
  mes             String   // "2026-05"
  sucursalId      String
  
  montoTotalRecibido  Decimal @db.Decimal(12, 2) @default(0)
  montoTotalEntregado Decimal @db.Decimal(12, 2) @default(0)
  saldoPendiente      Decimal @db.Decimal(12, 2) @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([mes, sucursalId])
  @@schema("hidden")
}

model EfectivoMovimiento {
  id              String   @id @default(cuid())
  fecha           DateTime
  tipo            TipoMovimiento
  monto           Decimal  @db.Decimal(12, 2)
  
  // Referencias internas (no se cruzan con public.Cotizacion)
  referenciaInterna  String   // identificador opaco
  cotizacionRefId    String?  // ID de la cotización original (no FK)
  ordenProduccionRef String?
  
  notas           String?
  
  createdAt       DateTime @default(now())
  
  @@schema("hidden")
  @@index([fecha])
  @@index([tipo])
}

enum TipoMovimiento {
  RECIBIDO
  ENTREGADO
}
```

## Notas importantes para Claude Code

1. **Decimal para dinero**: nunca uses `Float` para montos. Siempre `Decimal` con precisión 12,2.
2. **Soft delete**: usa flag `activo` o `eliminadoAt` en entidades importantes, no DELETE físico.
3. **Índices**: agrega los `@@index` que veas necesarios para queries comunes.
4. **Constraints**: usa `@@unique` y `@unique` para garantizar integridad.
5. **CUID vs UUID**: CUID es más corto y suficiente para nuestro caso.
6. **Multi-schema**: necesitas configurar Prisma para usar dos schemas (`public` y `hidden`). Ver docs de Prisma sobre `multiSchema` preview feature.
7. **Migraciones**: cada cambio al schema → una migración nueva, commiteada.
