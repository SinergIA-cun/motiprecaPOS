# 01 — Plan Formal del Sistema Motipreca

> **Versión 1.1** — Actualizada con arquitectura "Alegra al centro" (integración diferida a Semana 5+, Estrategia B)
> **Documento de planeación previo a desarrollo**

---

## 1. Visión general del ecosistema

El sistema se compone de **5 sub-módulos integrados** que comparten una base de datos central:

- **POS** (Punto de Venta) — para venta en mostrador, debe funcionar offline
- **Cotizador** (para asesores en campo) — online
- **CRM** (clientes con seguimiento de pedidos)
- **Admin Panel** (configuración y aprobaciones)
- **Módulo oculto** (URL privada, rastreo de efectivo STANDBY)

Conectados externamente con:
- **Alegra** (a partir de Semana 5+): CFDI, inventario oficial, cuentas por cobrar, listas de precios fiscales
- **Módulo de Producción** (Fase 3, futuro)

---

## 2. Sucursales

| Sucursal | Estado | Notas |
|---|---|---|
| Cancún | Av. López Portillo Región 100, Mza 101 Lote 1 | Sede principal |
| Playa del Carmen | Calle 11 Sur entre Av. 80 y 85, Col. Ejidal | |
| Mérida | *(por confirmar — Fer está consiguiendo dirección)* | |

Diseñar la arquitectura para **soportar más sucursales en el futuro** sin cambios estructurales.

---

## 3. Roles y permisos

| Rol | Puede hacer |
|---|---|
| **Asesor** | Crear/editar sus propias cotizaciones, alta de sus propios clientes, NO ve clientes de otros asesores, NO puede exportar BD |
| **Cajero** | Operar el POS de mostrador, ventas rápidas, crear cliente solo si es recurrente |
| **Jefe de Departamento** | Lo que hace un asesor + ver actividad de su equipo |
| **Gerente de Ventas** | Ve cotizaciones y ventas de **todas las sucursales y todos los asesores**, configura vigencia de cotizaciones |
| **Administrador** | Acceso total: configuración, aprobaciones, alta de usuarios, reglas de descuento, niveles de aprobación, dashboard oculto |

---

## 4. Estados de la cotización (máquina de estados)

```
              ┌──────────────┐
              │   ABIERTA    │ ◄─── (creación)
              │  (editable)  │
              └──────┬───────┘
                     │ click "Mandar a aprobación"
                     ▼
        ┌────────────────────────┐
        │  ¿Necesita aprobación  │
        │   según reglas OR?     │
        └─┬────────────────────┬─┘
    NO ◄──┘                    └──► SÍ
    (auto-aprueba)                  │
          │                         ▼
          │                ┌─────────────────┐
          │                │   PENDIENTE DE  │
          │                │   APROBACIÓN    │
          │                │     INTERNA     │
          │                └────┬───────┬────┘
          │                     │       │
          │            APROBAR  │       │ RECHAZAR
          │                     ▼       ▼
          │                  ┌────────────┐
          ▼                  │  RECHAZADA │ ──► editable, regresa a abierta
    ┌──────────────┐         │  (interna) │
    │   APROBADA   │ ◄───────┴────────────┘
    │ (no editable)│
    └──────┬───────┘
           │ asesor entrega al cliente
           ▼
    ┌──────────────────────┐
    │ PENDIENTE APROBACIÓN │
    │       CLIENTE        │
    └────┬─────────────────┘
         │
    ┌────┴────────────┐
    ▼                 ▼
┌────────┐      ┌──────────┐
│ COBRADA│      │RECHAZADA │  (por cliente)
└───┬────┘      │   o      │
    │           │ELIMINADA │
    │           └──────────┘
    ▼
┌──────────────────────────┐
│ ¿Es efectivo sin factura?│
└─┬────────────────────┬───┘
NO│                   SÍ│
  ▼                    ▼
FACTURA           STANDBY
(Alegra,           (caja paralela
 Semana 5+)         aislada)
```

### Acciones disponibles por estado

| Estado | Botones |
|---|---|
| **Abierta** | Editar, Editar en POS, Cobrar, Mandar a aprobación, Eliminar |
| **Pendiente aprob. interna** | (Admin: Aprobar, Rechazar, Eliminar con alerta) |
| **Aprobada** | Imprimir/PDF, Enviar a cliente (PDF), Cobrar, Cancelar |
| **Rechazada interna** | Editar, Reenviar a aprobación, Eliminar |
| **Pendiente aprob. cliente** | Marcar aceptada, Marcar rechazada |
| **Cobrada** | Ver factura/recibo, ver orden de producción asociada |
| **Eliminada / Rechazada final** | Solo lectura, archivada |

### Campos de la cotización

- Cliente
- Datos fiscales (si los hay)
- Datos de entrega
- Productos con cantidad, precio unitario, descuento
- Subtotal, IVA, Total
- Condiciones
- Vigencia (configurable por admin/gerente)
- Observaciones
- % de anticipo
- Asesor responsable
- Sucursal

---

## 5. Reglas de aprobación

### Configuración (Admin Panel)

El administrador configura **3 niveles máximo**:

```
NIVEL 1 (ej. Jefe de Depto)
  - Se activa si: descuento ≥ X%  OR  monto ≥ $Y
  
NIVEL 2 (ej. Gerente)
  - Se activa si: descuento ≥ X%  OR  monto ≥ $Y
  
NIVEL 3 (ej. Administrador)
  - Se activa si: descuento ≥ X%  OR  monto ≥ $Y
  - También aprueba: aumento de línea de crédito
```

### Ruta de aprobación (configurable)

- **Modo escalonado**: 8% → Nivel 1 → Nivel 2 → Nivel 3
- **Modo directo**: 8% → va directo al nivel correspondiente

### Estado inicial (operación día 1)

**Solo Administrador aprueba todo** (configuración por defecto). Los demás niveles se activan cuando el admin los configure.

### Reglas combinadas

- Lógica **OR** entre todos los disparadores
- Si descuento = 0% y monto = $0 → **todo** va a aprobación
- Comentario al rechazar: **opcional** (no obligatorio)

### Crédito de cliente

- Cada cliente tiene una **línea de crédito máxima configurable**
- Si una cotización excede el crédito disponible:
  - Marca visual de alerta
  - Va automáticamente a aprobación del administrador
- Aumentar la línea de crédito también va a aprobación del administrador

---

## 6. Listas de precios

- Cada **sucursal** tiene precios por defecto distintos (Mayoreo + Menudeo)
- Por defecto:
  - **Venta en mostrador (cajero)** → lista Menudeo de la sucursal
  - **Cotización de asesor** → lista Mayoreo de la sucursal
- El asesor puede cambiar la lista al cotizar
- Las listas se autogeneran a partir de:
  - Precio base del producto
  - Descuentos aplicables (general, familia, producto, volumen, promociones con vigencia)

### Reglas automáticas (configurables por admin)

Ejemplo: "si cantidad ≥ 500 m² → aplica precio mayoreo automáticamente"

### Promociones con vigencia

Ejemplo: "del 1 al 31 de mayo, 10% descuento en familia Celosías"

---

## 7. Productos

### Familias (extraídas del sitio motipreca.com)

1. Pozos de Visita
2. Registros Prefabricados
3. Cisternas Prefabricadas
4. Bases para Luminaria
5. Adocreto y Adopasto
6. Celosías
7. Tubos de Albañal y Concreto
8. Lavaderos
9. Columnas
10. Balustradas
11. Gárgolas
12. Decorativos de Concreto

(Mosaicos de Pasta y Piedra Decorativa son **empresas separadas**, NO se incluyen.)

### Tipos de producto (campo `tipo_producto`)

- **Tipo 1**: Se fabrica solo cuando hay pedido (mayoría)
- **Tipo 2**: Puede haber stock pero NO se repone automáticamente al vender
- **Tipo 3**: Stock mínimo. Al vender, se repone hasta el mínimo (`stock_minimo`)

### Comportamiento de venta con stock

- Si hay stock suficiente → **siempre se vende del stock primero**
- Si la orden es **mayor** que el stock disponible:
  - Se le da al cliente la opción de:
    - (A) llevarse lo disponible y dejar pendiente lo demás (genera orden de producción parcial)
    - (B) esperar a que se fabrique el pedido completo

---

## 8. STANDBY — Rastreo de efectivo no facturado

**Este módulo es delicado. Léelo con atención.**

### Objetivo

Permitir rastreabilidad interna del efectivo no facturado **sin que sea visible en la contabilidad oficial ni para una auditoría**.

### Mecánica

1. Cliente paga en efectivo y NO pide factura
2. La cotización se marca como `es_standby = true`
3. Se genera una orden de producción **genérica** (sin ligar visiblemente a la cotización)
4. La orden produce → el producto entra al **almacén físico STANDBY** (que existe legítimamente como "producto producido sin pedido específico" — esa es la fachada)
5. La **cotización desaparece** del tablero al fabricarse el producto
6. Cuando el cliente recoge → el producto sale del almacén STANDBY como salida normal de inventario
7. **El registro real del rastreo** vive en un **dashboard oculto** accesible solo por URL privada

### Reglas técnicas del dashboard oculto

- **URL no enlazada en menús**: `https://[dominio]/admin/[hash-32-chars]/registro`
- El hash se genera **una sola vez al deploy inicial** y se guarda en variables de entorno
- El administrador lo guarda en favoritos de su navegador
- **2FA obligatorio** para acceder (TOTP con Google Authenticator)
- **Logs de cada acceso** con IP, hora, usuario
- **BD lógicamente separada**: tablas en schema PostgreSQL distinto del resto
- **Cero conexión con Alegra**: ningún dato fluye hacia Alegra
- **Ruta inválida → 404** (no 401 ni 403, para no delatar que existe)
- Solo accesible por rol **Administrador**

### Datos que se guardan en el módulo oculto

- Registro mensual: monto total recibido en efectivo por sucursal
- Movimientos: entradas (cobros) y salidas (entregas de producto al cliente)
- Referencia interna a la cotización original y a la orden de producción genérica

### Lo que NO se debe hacer

- NO crear factura en Alegra para ventas STANDBY
- NO descontar inventario "oficial" para ventas STANDBY (se descuenta del almacén STANDBY que es independiente)
- NO enlazar la cotización original con la orden de producción de forma visible
- NO permitir que ningún rol distinto a Administrador acceda a estos datos
- NO incluir el dashboard oculto en ningún menú, breadcrumb o sitemap

---

## 9. POS y modo offline

### Operación normal (online)

- POS conectado a internet → opera contra el servidor central en la nube

### Operación offline

- Cuando se pierde internet, las cajas de la sucursal operan contra un **servidor local** designado por sucursal (una PC marcada como "servidor local")
- Las demás cajas se conectan vía LAN al servidor local
- El servidor local mantiene una BD réplica con productos, precios, clientes activos y folios pre-asignados
- Al recuperar internet:
  - El servidor local sincroniza con la nube
  - La nube valida que los folios no colisionen (no debería pasar gracias a los rangos pre-asignados)
  - Se procesan las facturas hacia Alegra (cuando esté integrado)

### Folios

- Cada sucursal tiene un **rango de folios pre-asignado** para evitar colisiones
- Tipos de folio separados:
  - Venta de mostrador
  - Cotización
- Formato sugerido: `[PREFIJO_SUCURSAL]-[TIPO]-[NÚMERO]`
  - Ejemplos: `CUN-COT-000432`, `PDC-VTA-000891`, `MID-COT-000123`

### Cotizaciones en campo (asesores)

- Los asesores **NO necesitan modo offline**
- Si están sin señal: anotan en su celular, crean la cotización al regresar a señal

---

## 10. Cobro y formas de pago

### Métodos aceptados

- Efectivo
- Transferencia
- Tarjeta (débito / crédito)
- Mixto (combinación de los anteriores)

### Anticipos

- El % de anticipo se define **por cotización** (no es fijo)
- Default sugerido por admin: 60%

### Flujo de cobro

1. Click "Cobrar" en cotización aprobada
2. Sistema muestra:
   - Total
   - % anticipo configurado para esa cotización
   - Monto del anticipo a cobrar
3. Cajero/asesor registra el cobro:
   - Método(s) de pago
   - Comprobante (si aplica)
4. Sistema decide:
   - Si es facturable → manda datos a Alegra (Semana 5+)
   - Si es efectivo sin factura → STANDBY
5. Cotización pasa a estado COBRADA
6. Se genera la orden de producción

### Pagos parciales

- El sistema contable (Alegra) lleva el seguimiento de cuentas por cobrar
- En el módulo POS solo registramos el cobro principal
- En STANDBY sí rastreamos pagos parciales internamente

---

## 11. CRM con seguimiento de pedidos

### Vista de cliente

```
┌─────────────────────────────────────────────────┐
│ Cliente: HOME CARE DISEÑO Y CONSTRUCCIÓN        │
│ Asesor: Rosaura Jiménez                         │
│ Línea de crédito: $200,000 / Usado: $35,000     │
├─────────────────────────────────────────────────┤
│ DATOS FISCALES (2)                              │
│ DIRECCIONES DE ENTREGA (3)                      │
├─────────────────────────────────────────────────┤
│ PEDIDOS ACTIVOS (con estado en tiempo real)     │
│  • RJ432 — Adopasto · En cola de producción     │
│  • RJ441 — Celosías · En secado                 │
│  • RJ445 — Adocretos · En almacén, listo entrega│
├─────────────────────────────────────────────────┤
│ HISTÓRICO (cotizaciones cerradas y entregadas)  │
└─────────────────────────────────────────────────┘
```

### Estados de un pedido (cadena completa)

```
Cotización abierta → Aprobada → Cobrada → Orden de producción
   → En cola → Fabricando → Secado → Almacén
   → Entrega programada → Entregado
```

> El módulo de Producción (Fase 3) será el que dispare estos cambios de estado.
> Mientras no exista, admin/gerente actualiza el estado manualmente.

### Visibilidad de clientes

- **Asesor**: solo ve sus propios clientes
- **Cajero**: solo ve clientes creados desde su sucursal
- **Jefe de Depto**: ve clientes de su equipo
- **Gerente**: ve todos los clientes de todas las sucursales
- **Administrador**: ve todos + puede exportar

### Datos múltiples por cliente

Un cliente puede tener:
- **N datos fiscales** (RFC, razón social, régimen, uso CFDI, domicilio fiscal)
- **N direcciones de entrega** (con alias: "Casa", "Obra Cancún", etc.)
- **1 línea de crédito** máxima
- **1 asesor dueño** (visibilidad)

Al cotizar, el asesor selecciona:
- Cuál dato fiscal usar (de los que el cliente tiene)
- O captura uno nuevo al vuelo (se guarda)
- Cuál dirección de entrega usar

---

## 12. Configuración (Admin Panel)

Secciones:

### 12.1 Usuarios y Roles
- Alta/baja de usuarios
- Asignar rol y sucursal
- Definir iniciales (para folios)

### 12.2 Sucursales
- Alta/edición
- Prefijo de folio
- IP del servidor local (para offline)
- Lista de precios por defecto

### 12.3 Productos y Familias
- Catálogo de productos
- Familias (las 12 listadas)
- Tipo de producto (1/2/3)
- Stock mínimo (si tipo = 3)

### 12.4 Descuentos
- Descuentos generales (% global)
- Descuentos por familia
- Descuentos por producto
- Descuentos por volumen (≥ X cantidad → Y%)
- Promociones con vigencia

> Las **listas de precios se autogeneran** aplicando descuentos sobre precios base.

### 12.5 Reglas de Aprobación
- 3 niveles configurables
- Por nivel: % descuento, monto disparador
- Asignar aprobador por nivel
- Modo escalonado o directo

### 12.6 Cotizaciones
- Vigencia por defecto (días)
- Texto de condiciones por defecto
- % anticipo sugerido por defecto

### 12.7 Crédito
- Línea de crédito default
- Comportamiento al exceder: alerta visual + va a aprobación admin

---

## 13. Generación de PDF de cotización

Basada en la plantilla actual RJ432, con las siguientes mejoras:

- **Solo datos bancarios de Motipreca** (sin Petra/Mosaicos)
- **Código QR** en el PDF para que el cliente verifique autenticidad
- **Footer con redes sociales** (Facebook, Instagram, YouTube)
- **Limpiar duplicación** de puntos en términos y condiciones
- Mantener el branding visual (logo MTP azul + estructura general)
- **Responsabilidad del asesor enviarlo** (el sistema solo genera el PDF descargable)

---

## 14. Vigencia de cotizaciones

- Vigencia default: configurable (sugerido: 14 días)
- Configurable por administrador y gerente
- Cuando vence:
  - Se marca como "Expirada" automáticamente
  - Se puede **reactivar**, pero el sistema avisa: "los precios pueden haber cambiado, revisa antes de reactivar"

---

## 15. Plan de fases

### **FASE 1 — MVP (4–6 semanas)**

**Objetivo**: Motipreca puede operar diariamente con el sistema.

| Semana | Entregables |
|---|---|
| 1 | Setup técnico, BD, autenticación, roles, sucursales |
| 1–2 | Catálogo productos (carga vía Excel), familias, lista precios básica |
| 2 | CRM básico: clientes, datos fiscales, direcciones |
| 2–3 | Cotizaciones: crear, editar, estados completos, historial |
| 3 | Aprobaciones: 1 nivel (admin), reglas OR configurables |
| 3–4 | POS de mostrador online, ticket, cobro básico |
| 4–5 | STANDBY: caja paralela + módulo oculto + registro mensual |
| 5 | Configuración Admin Panel: lo esencial |
| 5–6 | Pruebas con datos reales, capacitación, ajustes |

**Lo que NO está en Fase 1**:
- Integración con Alegra (Fase 1.5)
- Modo offline del POS
- 3 niveles de aprobación
- Reglas avanzadas de descuento
- Listas de precios múltiples (solo 1 default por sucursal)
- Bloqueo automático por línea de crédito (solo alerta)

### **FASE 1.5 — Integración Alegra (semanas 7–8)**

- Conectar API de Alegra con credenciales
- Mapear modelo de datos local → Alegra
- Empujar productos del sistema → Alegra (creando los items en Alegra)
- Empujar clientes del sistema → Alegra (creando los contactos)
- Configurar facturación CFDI (Semana 8)
- Configurar webhooks de Alegra → sistema (para sync bidireccional)
- Mapeo: bodegas de Alegra ↔ sucursales del sistema

### **FASE 2 — Robustez (semanas 9–12)**

- Modo offline del POS con servidor local LAN
- 3 niveles de aprobación configurables
- Reglas de descuento avanzadas (familia, temporada, volumen)
- Listas de precios múltiples
- Promociones con vigencia
- Reglas automáticas (≥ 500 m² → mayoreo)

### **FASE 3 — Extensión (mes 4+)**

- Módulo de Producción independiente
- CRM con seguimiento en tiempo real
- BI / Dashboards gerenciales
- App móvil nativa (si se requiere)

---

## 16. Decisiones cerradas

- **Estrategia**: B — construir sistema completo, integrar Alegra después
- **Token Alegra**: regenerado por Fer, se usará en Fase 1.5
- **GitHub**: organización SinergIA creada, repos privados
- **Hosting**: VPS Hostinger KVM 2 (Ubuntu 24.04) con EasyPanel preinstalado
- **Plataforma de deploy**: EasyPanel
- **Cloudflare**: no por ahora, se evalúa después
- **PDF**: solo datos Motipreca, con QR, footer con redes, limpiar duplicados
- **Logo**: PNG alta resolución (Fer lo subirá a `/apps/web/public/`)
