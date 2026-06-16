# ADR 0002 — Alcance MVP del módulo de Cotizaciones (Semana 2)

- **Estado:** Aceptada
- **Fecha:** 2026-06-16
- **Referencia:** modelo conceptual en [../handoff/05_modelo_datos.md](../handoff/05_modelo_datos.md)

## Contexto

El modelo de datos del handoff para Cotizaciones es muy completo (listas de precios por
sucursal, familias de producto, descuentos configurables, aprobaciones escalonadas, datos
fiscales/direcciones, ventas y pagos, historial). Construir todo eso de golpe retrasaría
tener un sistema de cotización **usable**. Se priorizó un primer corte funcional de punta a
punta (cliente → producto → cotización con folio y totales) y se difirió lo demás.

## Decisión

Se implementó el flujo mínimo completo: **Clientes**, **Productos** y **Cotizaciones**
(lista, constructor con totales en vivo, detalle y cambios de estado), con estas
simplificaciones respecto al handoff:

1. **Productos: `precioBase` único, sin listas de precios.** Se difiere `ListaPrecio`/`Precio`
   (mayoreo/menudeo/especial por sucursal). El precio se puede ajustar por partida al cotizar.
2. **Productos: `categoria` (texto libre), sin modelo `Familia`.** Agrupación ligera; la
   jerarquía formal de familias llega después.
3. **IVA 16% global.** Sin productos exentos ni tasas variables por ahora (constante
   `IVA_RATE` en el backend).
4. **Descuento por partida (`descuentoPct`).** Se difieren los descuentos configurables
   (`Descuento` por familia/volumen/promoción) y el modelo de `anticipo`.
5. **Estados simplificados:** `ABIERTA · APROBADA · RECHAZADA · COBRADA · EXPIRADA ·
ELIMINADA`. Se difieren los estados de aprobación escalonada
   (`PENDIENTE_APROBACION_*`), el modelo `Aprobacion`/`NivelAprobacion` y `HistorialCotizacion`.
   El cambio de estado es por transición simple (sin máquina de estados estricta todavía).
6. **Sin edición de partidas tras crear** la cotización (sí cambio de estado). Editar implica
   recalcular y versionar; se hará en una fase posterior. Por ahora: crear de nuevo.
7. **Cliente: datos fiscales y direcciones inline/diferidos.** El cliente guarda un `rfc`
   básico; `DatoFiscal[]` y `DireccionEntrega[]` completos (CFDI, régimen, uso) se difieren.
   También se difiere crédito (`lineaCreditoMax`/`creditoUsado`) y `asesorDueño` (CRM).
8. **Ventas/pagos diferidos.** `Venta`/`Pago` y la conversión cotización→venta no entran en
   este corte.

## Folios

La asignación de folio usa `RangoFolio` (`@@unique([sucursalId, tipoDocumento])`). Al crear
una cotización, en una **transacción** se lee `proximoFolio`, se incrementa, y se arma el
folio `{prefijoFolio}-COT-{n:6}` (ej. `CUN-COT-000001`). Esto garantiza consecutivos sin
huecos por sucursal.

## Permisos (regla #15/#16)

- **Clientes y Cotizaciones:** cualquier usuario autenticado (operación de ventas).
- **Catálogo de Productos:** lectura para todos; alta/edición para Gerente y Administrador.
- **Lectura de Sucursales** se abrió a cualquier autenticado (dato de referencia que
  clientes/cotizaciones necesitan); la escritura sigue siendo solo Administrador.

## Consecuencias

- **Positivas:** sistema de cotización utilizable de inmediato; modelo extensible (los
  campos de Alegra `alegraId`/`estadoSync` ya están presentes para la Fase 1.5).
- **Pendientes** (orden sugerido para fases siguientes): listas de precios + familias,
  edición de partidas, aprobaciones escalonadas + historial, datos fiscales completos +
  CFDI, ventas/pagos y conversión, módulo de efectivo (schema `hidden`).
