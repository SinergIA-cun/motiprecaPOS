# 04 — Arquitectura de Integración con Alegra

> **Importante**: Esta integración se construye en **Fase 1.5 (Semanas 7-8)**, NO en Fase 1.
> La Fase 1 construye el sistema completo sin Alegra. Pero el diseño de BD desde día 1 contempla esta integración.

## Principio arquitectónico

> **Alegra es la fuente de verdad fiscal y oficial. Nuestro PostgreSQL es un espejo operativo sincronizado. El POS lee del espejo (rápido, sin límites, funciona offline) y escribe a Alegra vía colas de sincronización.**

## Por qué no llamamos a Alegra directamente desde el POS

Tres razones técnicas hacen inviable la llamada directa:

### 1. Rate limit de Alegra: 150 req/min por usuario

Con 3 sucursales operando simultáneamente, consultas de inventario al teclear productos en el POS, etc., 150 req/min se agotan rápidamente. Cuando se exceden, Alegra responde con 429 (Too Many Requests) y bloquea por 1 minuto.

### 2. Modo offline del POS

Cuando se cae internet en una sucursal, las cajas deben seguir vendiendo. Si dependen de Alegra para todo, no pueden operar.

### 3. Latencia

Cada llamada a Alegra cruza internet. Para una operación frecuente como "consultar precio del producto X", es inaceptable agregar 300-1000 ms de latencia.

## Arquitectura

```
                    ┌─────────────────────────┐
                    │        ALEGRA           │
                    │  (Fuente de verdad      │
                    │   FISCAL Y OFICIAL)     │
                    │                         │
                    │  • Clientes (contactos) │
                    │  • Productos (ítems)    │
                    │  • Inventario           │
                    │  • Listas de precios    │
                    │  • Crédito por cliente  │
                    │  • Facturas CFDI        │
                    │  • Cuentas por cobrar   │
                    │  • Bodegas              │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
        Webhooks          API REST           API REST
        (Alegra avisa)   (lees de Alegra)   (escribes a Alegra)
              │                 │                 │
              ▼                 ▼                 ▼
        ┌───────────────────────────────────────────────┐
        │       TU SISTEMA (servidor central)           │
        │                                               │
        │   PostgreSQL = ESPEJO OPERATIVO de Alegra     │
        │   + Datos propios del sistema                  │
        │                                               │
        │   • Copia de productos (lectura rápida)        │
        │   • Copia de inventario (vía webhook)          │
        │   • Copia de clientes + datos CRM extra        │
        │   • Cotizaciones (solo aquí)                   │
        │   • Historial, aprobaciones, etapas (solo aquí)│
        │   • Cola de sincronización (BullMQ)            │
        │   • Logs de webhooks recibidos                 │
        └───────────────────┬───────────────────────────┘
                            │
                  ┌─────────┴──────────┐
                  │                    │
            Servidor local       Servidor local
            Sucursal Cancún      Sucursal Playa ...
                  │                    │
              POS cajas            POS cajas
```

## Tabla de fuentes de verdad

| Dato | Fuente de verdad | Dónde lo lee el POS |
|---|---|---|
| Productos | Alegra | Copia en PostgreSQL |
| Inventario | Alegra | Copia en PostgreSQL (actualizada por webhook) |
| Precios / listas | Alegra | Copia en PostgreSQL |
| Crédito por cliente | Alegra | Copia en PostgreSQL |
| Clientes (datos fiscales) | Alegra | Copia en PostgreSQL |
| Clientes (datos CRM: asesor dueño, notas, etapas de pedido) | **Tu sistema** | PostgreSQL |
| Cotizaciones | **Tu sistema** | PostgreSQL |
| Aprobaciones, historial | **Tu sistema** | PostgreSQL |
| Facturas CFDI | Alegra | Se consultan a Alegra cuando se necesitan |
| Caja STANDBY (efectivo oculto) | **Tu sistema** (aislado) | **NUNCA toca Alegra** |

## Estrategia de sincronización

### Estrategia B (la que vamos a seguir)

1. **Fase 1 (Semanas 1-6)**: el sistema se construye y opera **independientemente de Alegra**
2. **Fase 1.5 (Semanas 7-8)**: integramos Alegra
   - **Semana 7**: 
     - Exploración con credenciales reales
     - Mapeo de campos
     - Migración inicial: empujamos productos y clientes del sistema → Alegra
     - Cada registro local recibe su `alegra_id`
   - **Semana 8**: 
     - Sincronización bidireccional
     - Configurar webhooks
     - Facturación CFDI

## Diseño de BD compatible con Alegra (desde Fase 1)

Aunque Alegra entra en Fase 1.5, **el modelo de datos desde Fase 1 ya contempla la integración**. Esto evita refactors después.

### Campos comunes en tablas que se espejarán

Cada tabla que después se sincronizará con Alegra incluye estos campos desde el día 1:

```prisma
model Cliente {
  id              String   @id @default(cuid())
  // ... datos del cliente ...
  
  // === Campos de integración Alegra ===
  alegraId        String?  @unique          // null hasta que se sincronice
  estadoSync      EstadoSync @default(PENDIENTE)
  ultimaSyncAt    DateTime?
  errorSync       String?                   // mensaje del último error
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum EstadoSync {
  PENDIENTE      // creado localmente, aún no en Alegra
  SINCRONIZADO  // existe en Alegra con alegraId
  ERROR         // falló la sincronización, revisar errorSync
  DESACTUALIZADO // hay cambios locales no pusheados a Alegra
}
```

Aplica a: `Cliente`, `Producto`, `ListaPrecio`, `Sucursal` (mapea a bodega).

### Tabla `cola_sincronizacion`

```prisma
model ColaSincronizacion {
  id              String   @id @default(cuid())
  tipo            TipoOperacion
  entidad         String   // 'Cliente', 'Producto', etc.
  entidadLocalId  String
  payload         Json     // datos a enviar a Alegra
  intentos        Int      @default(0)
  ultimoIntentoAt DateTime?
  ultimoError     String?
  estado          EstadoCola @default(PENDIENTE)
  prioridad       Int      @default(0)
  createdAt       DateTime @default(now())
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
```

### Tabla `log_webhooks_alegra`

```prisma
model LogWebhookAlegra {
  id              String   @id @default(cuid())
  evento          String   // tipo de evento recibido
  payload         Json     // body completo
  procesado       Boolean  @default(false)
  procesadoAt     DateTime?
  error           String?
  recibidoAt      DateTime @default(now())
}
```

## Endpoints clave de Alegra que vamos a usar

Basado en la documentación pública de Alegra (developer.alegra.com):

### Autenticación
- Basic Auth con email + token en base64
- Header: `Authorization: Basic [base64(email:token)]`

### Contactos (clientes)
- `GET /contacts` — listar
- `POST /contacts` — crear
- `GET /contacts/{id}` — consultar
- `PUT /contacts/{id}` — editar

### Ítems (productos)
- `GET /items` — listar
- `POST /items` — crear
- `GET /items/{id}` — consultar
- `PUT /items/{id}` — editar

### Inventario
- `POST /inventory-adjustments` — ajustes de inventario
- `POST /warehouse-transfers` — transferencias entre bodegas

### Bodegas (= sucursales en nuestro sistema)
- `GET /warehouses` — listar bodegas
- Mapeo:
  - Bodega "Cancún" en Alegra ↔ Sucursal "Cancún" en sistema
  - Bodega "Playa del Carmen" en Alegra ↔ Sucursal "Playa del Carmen" en sistema
  - Bodega "Mérida" en Alegra ↔ Sucursal "Mérida" en sistema

### Facturas
- `POST /invoices` — crear factura de venta
- `POST /invoices/{id}/payments` — registrar pago

### Webhooks
- `POST /webhooks/subscriptions` — crear suscripción
- Eventos a suscribir (a confirmar en Semana 7):
  - Cambios de inventario
  - Pagos recibidos
  - Cambios de productos
  - Cambios de contactos

## Restricciones técnicas conocidas

| Restricción | Mitigación |
|---|---|
| Rate limit: 150 req/min por usuario | Espejo local + colas |
| Webhooks deben responder en < 5 seg | Endpoint solo confirma recepción, procesa con BullMQ |
| Listado de remisiones: máx 30 por request | Paginación obligatoria |
| IDs migrando a UUID v7 a partir de fechas específicas | Tratar IDs como strings, no enteros |

## Lo que se valida en Semana 7

Antes de integrar, hay que confirmar con la cuenta real estos puntos:

1. **Crédito por cliente**: ¿el campo es accesible y editable vía API?
2. **Múltiples datos fiscales por cliente**: ¿soportado nativo o cada RFC es un contacto separado?
3. **Múltiples direcciones de entrega**: ¿soportado o se maneja solo en nuestro sistema?
4. **Mapeo bodegas → sucursales**: confirmar que las bodegas sirven para representar nuestras sucursales
5. **Eventos de webhook**: lista exacta disponible
6. **Campos personalizados**: usar "campos adicionales" de Alegra si necesitamos guardar algo específico de Motipreca

## Manejo de errores y reintentos

### Estrategia de reintentos para BullMQ

```ts
// Configuración de job
{
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 5000   // 5s, 10s, 20s, 40s, 80s
  }
}
```

### Tipos de error y acciones

| Error de Alegra | Acción |
|---|---|
| 429 (rate limit) | Reintentar con backoff exponencial |
| 5xx (server error) | Reintentar con backoff exponencial |
| 401 (auth) | NO reintentar, alertar admin (token vencido) |
| 400 (validation) | NO reintentar, marcar como ERROR_FATAL, alertar |
| 404 (not found) | Investigar si el recurso se eliminó en Alegra |
| Timeout | Reintentar con backoff |

## Configuración inicial cuando se conecte Alegra (Semana 7)

Script de bootstrap que hace lo siguiente:

1. Autenticar con credenciales
2. Listar bodegas actuales en Alegra
3. Crear/mapear bodegas para Cancún, Playa, Mérida
4. Listar listas de precios en Alegra
5. Crear listas: "Mayoreo Cancún", "Menudeo Cancún", etc. (6 listas: 2 × 3 sucursales)
6. Empujar productos del sistema → Alegra (procesados por la cola)
7. Empujar clientes existentes → Alegra
8. Configurar webhooks de eventos relevantes
9. Validar que todo quedó sincronizado

Este script va en `scripts/bootstrap-alegra.ts` y se corre **una sola vez** al activar la integración.
