# 03 — Reglas de Seguridad Innegociables

> Estas reglas **NO se rompen**, ni siquiera por velocidad de desarrollo.

## Secrets y credenciales

1. **NUNCA hardcodear secrets** (API keys, passwords, tokens). Solo variables de entorno.
2. **NUNCA commitear `.env`**. Usar `.env.example` como referencia (con valores vacíos o placeholders).
3. **`.gitignore` debe incluir desde el día 1**:
   ```
   .env
   .env.local
   .env.*.local
   *.pem
   *.key
   secrets/
   ```
4. **Los logs nunca deben imprimir secrets**. Usar Pino con redacción configurada:
   ```ts
   redact: ['req.headers.authorization', 'password', 'token', '*.password']
   ```

## Autenticación

5. **Passwords**: hash con **argon2id** (no bcrypt, no SHA, no MD5)
6. **JWT access tokens**: 15 minutos máximo
7. **Refresh tokens**: en cookies `httpOnly`, `secure`, `sameSite=strict`
8. **2FA obligatorio** para rol Administrador (TOTP con Google Authenticator o similar)
9. **Logout invalida refresh token** (lista negra en Redis con TTL)
10. **Rate limiting** en endpoints de auth:
    - Login: 5 intentos / 15 minutos por IP
    - Refresh: 20 / minuto por usuario

## Validación

11. **Zod en TODOS los endpoints, sin excepción**. Schemas en `packages/shared/src/schemas/`.
12. **Validación antes de cualquier operación de BD**.
13. **Sanitización de input** para campos de texto libre (HTML escape).
14. **Whitelisting** en parámetros de query (no aceptar cualquier filtro arbitrario).

## Permisos y multi-tenancy

15. **Middleware de autenticación** en todos los endpoints excepto login/health.
16. **Middleware de roles** que valida que el usuario tenga permisos para el recurso.
17. **Filtro automático por sucursal** en queries (excepto roles Gerente y Administrador).
18. **Filtro automático por asesor** en queries de clientes (rol Asesor solo ve los suyos).
19. **NUNCA permitir** que un asesor consulte recursos de otro asesor vía parámetros manipulables.

## Headers y CORS

20. **Headers de seguridad obligatorios** (usar helmet o equivalente para Fastify):
    - `Content-Security-Policy`
    - `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `Strict-Transport-Security` (en producción)
    - `Referrer-Policy: no-referrer`
21. **CORS estricto**: solo el dominio del frontend autorizado.
22. **No exponer detalles de errores** en respuestas. Logs internos sí, respuesta al cliente: mensaje genérico.

## Base de datos

23. **Migraciones de Prisma versionadas** en Git.
24. **NUNCA hacer cambios manuales** a la BD en producción (siempre por migración).
25. **Backups automáticos diarios** configurados en EasyPanel (mínimo 30 días de retención).
26. **Connection pool** configurado (Prisma maneja esto).
27. **Soft deletes** preferidos sobre delete físico para datos importantes (cotizaciones, clientes, ventas).

## Módulo oculto (STANDBY)

> Estas reglas son adicionales y específicas. **Léelas con atención**.

28. **URL con hash aleatorio de 32 caracteres** generado al deploy inicial.
29. **Hash guardado en variable de entorno** `HIDDEN_MODULE_HASH`, nunca en código.
30. **2FA obligatorio** para acceder al módulo oculto (independiente del 2FA general).
31. **Logs de cada acceso**: IP, hora, usuario, ruta accedida. Tabla `hidden_access_logs`.
32. **BD lógicamente separada**: usar schema PostgreSQL distinto (`hidden`) para tablas del módulo.
33. **NUNCA enlazar** en menús, breadcrumbs, sitemaps, robots.txt.
34. **Ruta inválida o sin permisos → 404**. NO 401 ni 403 (no delatar que existe).
35. **Solo accesible por rol Administrador**.
36. **NUNCA enviar datos del módulo oculto a Alegra** ni a ningún sistema externo.
37. **NUNCA incluir datos del módulo oculto en reportes generales o BI**.
38. **NUNCA loguear** contenidos sensibles del módulo oculto (montos, referencias) en logs estándar.

## Folios y concurrencia

39. **Folios pre-asignados por sucursal**: cada sucursal tiene su rango.
40. **Asignación atómica de folios** (transacción con bloqueo o secuencia).
41. **Validación de unicidad** de folios a nivel BD (unique constraint).

## API y errores

42. **Rate limiting global**: 100 requests / minuto por IP por defecto.
43. **Endpoints sensibles** (login, registro, módulo oculto): rate limit más estricto.
44. **Códigos HTTP correctos**:
    - 200/201 éxito
    - 400 validación
    - 401 no autenticado
    - 403 no autorizado
    - 404 no existe
    - 409 conflicto
    - 422 entidad inválida
    - 500 error servidor
45. **Respuestas de error estandarizadas**:
    ```json
    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Mensaje legible para el usuario",
        "details": [...] // opcional
      }
    }
    ```

## Logs y auditoría

46. **Logs estructurados** (JSON) con Pino.
47. **Trace ID por request** para seguimiento.
48. **Auditoría completa** en operaciones críticas:
    - Cambios de estado en cotizaciones
    - Aprobaciones
    - Cobros
    - Cambios de configuración
    - Accesos al módulo oculto
49. **Tabla `audit_logs`** con: quién, qué, cuándo, dónde, valores antes/después.

## Dependencias y supply chain

50. **Auditoría de dependencias** mensual: `pnpm audit`.
51. **Renovate o Dependabot** configurado para alertas de vulnerabilidades.
52. **No agregar dependencias innecesarias** (cada `npm install` debe justificarse).
53. **Lockfile commiteado** (`pnpm-lock.yaml`).

## Despliegue

54. **HTTPS obligatorio en producción** (Traefik/EasyPanel maneja Let's Encrypt).
55. **Variables de entorno en EasyPanel UI**, nunca en código.
56. **Healthcheck endpoint** `/health` (sin auth) que valide BD y Redis.
57. **Graceful shutdown**: cerrar conexiones BD/Redis al recibir SIGTERM.

## Para el equipo (Fer)

58. **No compartir credenciales por chat** (incluido este).
59. **Gestor de contraseñas obligatorio** (1Password, Bitwarden, Apple Passwords).
60. **Rotación de credenciales** ante cualquier sospecha de filtración.

---

## Si algo de estas reglas requiere flexibilidad

**Discútelo con Fer antes de violarlas.** Documenta la excepción en un ADR explicando:
- Qué regla se está flexibilizando
- Por qué
- Qué medidas compensatorias se toman
- Cuándo se va a corregir
