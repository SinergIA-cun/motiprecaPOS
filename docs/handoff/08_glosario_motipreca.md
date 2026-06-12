# 08 — Glosario del Negocio Motipreca

> Términos importantes que Claude Code debe entender al construir el sistema.

## Sobre Motipreca

**Motipreca** es una empresa mexicana con más de 30 años fabricando productos de concreto prefabricados. Tiene 3 sucursales en el sureste de México (Cancún, Playa del Carmen, Mérida). Su slogan es **#ApasionadosdelConcreto**.

## Productos típicos

### Familias

- **Adopastos / Adocretos**: bloques de concreto para pisos exteriores. Ej: Adopasto Cruz Maya, Adocreto rectangular.
- **Celosías**: piezas decorativas de concreto para muros y fachadas (con orificios para ventilación).
- **Pozos de Visita / Registros**: estructuras prefabricadas para drenaje y sistemas hidráulicos.
- **Cisternas Prefabricadas**: tanques de almacenamiento de agua de concreto.
- **Bases para Luminaria**: bases de concreto para postes de luz urbana.
- **Tubos de Albañal y Concreto**: tubería para sistemas de drenaje.
- **Lavaderos, Columnas, Balustradas, Gárgolas, Decorativos**: piezas arquitectónicas.

### Unidades comunes

- **M2** (metros cuadrados): cuando se vende por superficie (ej. adopasto)
- **PZA** (pieza): cuando se cuenta individualmente (ej. celosía, pozo)
- **ML** (metro lineal): tuberías, balustradas
- **JGO** (juego): combos de piezas

### Características importantes

- **La mayoría se fabrica bajo pedido**, no hay stock grande
- **Algunos productos tienen stock mínimo** (adocretos, celosías comunes)
- **Tienen tonos variables** por la naturaleza del concreto (mencionado en términos de cotización)
- **Tiempo de secado** afecta la entrega — hay etapa de "secado" en producción

## Términos del negocio

### Roles humanos

- **Asesor**: vendedor que sale a campo, atiende clientes empresariales/constructores, cotiza, da seguimiento. Cada cliente tiene un asesor asignado.
- **Cajero**: atiende el mostrador en la sucursal, vende a clientes que llegan directo.
- **Jefe de Departamento**: supervisa a un grupo de asesores en una sucursal.
- **Gerente de Ventas**: responsable de las 3 sucursales.
- **Administrador**: dueño/socio, aprueba descuentos grandes, configura el sistema.

### Operación

- **Cotización**: propuesta comercial. La forma actual es un PDF llamado "Presupuesto" (ver RJ432 de referencia).
- **Folio**: número único de cotización. Hoy se usa "RJ432" donde RJ son iniciales del asesor. En el nuevo sistema cambiará a formato `[SUCURSAL]-[TIPO]-[NÚMERO]`.
- **Anticipo**: pago inicial al confirmar pedido. Típicamente 60% del total. Se cobra antes de empezar producción.
- **Saldo contra entrega**: el 40% restante se paga al recibir el producto.
- **Vigencia**: una cotización vence en 14 días (configurable). Después puede reactivarse pero los precios pueden cambiar.

### Producción

- **Orden de producción**: instrucción a fábrica para producir cierto producto en cierta cantidad.
- **En cola**: el pedido está esperando turno para producirse.
- **Fabricando**: el producto se está moldeando.
- **Secado**: tras moldear, hay un período de curado del concreto (días).
- **Almacén**: producto terminado, listo para entrega.
- **STANDBY** (almacén): producto fabricado sin asignación específica a un pedido. Esta es la "fachada legítima" del módulo oculto.

### Comerciales

- **Mayoreo / Menudeo**: 
  - **Mayoreo** se aplica a asesores y clientes recurrentes (constructores, arquitectos, contratistas).
  - **Menudeo** es para venta en mostrador, cliente final.
- **Línea de crédito**: monto máximo que un cliente puede deber. Configurable por cliente.
- **Cuenta por cobrar (CxC)**: dinero que un cliente nos debe. Se lleva en Alegra.
- **Descuento**: rebaja sobre precio de lista. Puede ser:
  - General (toda la venta)
  - Por familia (ej. "10% en celosías")
  - Por producto específico
  - Por volumen (ej. "≥ 500 m² → precio mayoreo")
  - Promocional con vigencia (ej. "del 1 al 31 de mayo")

### Fiscales

- **CFDI**: Comprobante Fiscal Digital por Internet (la factura electrónica en México).
- **RFC**: Registro Federal de Contribuyentes (clave fiscal del cliente).
- **Régimen fiscal**: clasificación del contribuyente (cada uno tiene su código SAT).
- **Uso de CFDI**: el uso que el cliente le dará a la factura (G01, G03, P01, etc.).
- **IVA**: Impuesto al Valor Agregado, 16% en México.
- **Timbrar**: emitir la factura ante el SAT (lo hace Alegra).

### Sobre el efectivo (STANDBY)

> Este es un tema sensible. Léelo para entender el contexto, pero las reglas técnicas están en `03_reglas_seguridad.md`.

En México, parte del flujo de venta en algunas industrias se hace en efectivo sin emitir factura. El cliente paga, recibe el producto, y la transacción no entra a la contabilidad oficial.

Motipreca necesita rastrear internamente este flujo (saber cuánto entró, qué se entregó, a quién), pero **debe parecer ante una auditoría** que el efectivo no existe en sus libros y que el almacén STANDBY contiene producto "fabricado sin pedido específico".

**Tu rol como sistema**: 
- Crear el mecanismo técnico que cumple ambos objetivos
- Aislar completamente esta información del resto del sistema
- Garantizar que solo el Administrador tenga acceso
- No emitir juicio sobre esta práctica — es decisión del cliente del cliente

## Sobre la cotización RJ432 (referencia)

La cotización adjuntada como ejemplo (RJ432) tiene esta estructura:

- **Header**: logo Motipreca + título "Presupuesto" + datos de la sucursal
- **Datos del asesor**: nombre, correo, sucursal, teléfono
- **Datos de la cotización**: folio, fecha, vencimiento
- **Datos del cliente**: nombre, contacto, teléfono, ciudad de entrega
- **Tabla de productos**: cantidad, unidad, descripción, precio unitario, importe
- **Totales**: subtotal, IVA 16%, total
- **Datos bancarios**: BBVA (cuenta Motipreca) + Scotiabank (cuenta Petra — para Mosaicos y Piedra)
- **Términos y condiciones** generales
- **Condiciones específicas** para Mosaicos de Pasta

### Lo que cambia en el nuevo PDF

- Solo datos bancarios de Motipreca (Petra/Mosaicos son empresas separadas, fuera de scope)
- Eliminar condiciones de Mosaicos de Pasta
- Limpiar duplicación de números (vi "5." dos veces)
- Agregar código QR para verificación de autenticidad
- Agregar footer con redes sociales (Facebook, Instagram, YouTube)
- Mantener identidad visual general

## Términos técnicos que NO son obvios

- **Espejo operativo**: copia local de datos que viven en otro sistema (Alegra). El espejo se mantiene sincronizado vía API y webhooks.
- **Sincronización bidireccional**: cambios fluyen en ambas direcciones (sistema → Alegra, Alegra → sistema).
- **Idempotencia**: una operación que se puede repetir sin cambiar el resultado (importante para reintentos de sync).
- **Webhook**: notificación HTTP que un sistema envía a otro cuando ocurre un evento.
- **POS**: Point of Sale (Punto de Venta).
- **CRM**: Customer Relationship Management.
- **BI**: Business Intelligence (dashboards y reportes).
- **CFDI**: ver arriba, sección fiscal.

## Cosas que el sistema NUNCA hace

- ❌ Enviar dinero a cuentas
- ❌ Aplicar descuentos sin autorización
- ❌ Emitir facturas sin pasar por Alegra (cuando esté integrado)
- ❌ Mostrar clientes de un asesor a otro asesor
- ❌ Borrar cotizaciones (siempre soft delete, queda historial)
- ❌ Permitir editar una cotización aprobada
- ❌ Enviar emails automáticamente al cliente (lo hace el asesor manualmente)

## Cosas que el sistema SÍ hace automáticamente

- ✅ Asigna folios secuenciales por sucursal
- ✅ Calcula IVA y totales
- ✅ Aplica descuentos según reglas configuradas
- ✅ Manda a aprobación si supera umbrales
- ✅ Marca cotizaciones como expiradas al vencer
- ✅ Genera PDFs descargables
- ✅ Sincroniza con Alegra (cuando esté activo)
- ✅ Mantiene historial de auditoría
- ✅ Aplica filtros de visibilidad según rol
