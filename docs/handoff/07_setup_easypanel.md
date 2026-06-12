# 07 — Setup de EasyPanel en el VPS

> Guía para preparar el VPS Hostinger antes del primer deploy.
> Esto se hace **antes** del Día 6 de la Semana 1.

## Contexto

- VPS: Hostinger KVM 2
- IP: ya tiene IP dedicada (Fer la tiene)
- SO: Ubuntu 24.04 LTS
- EasyPanel: preinstalado
- Acceso: SSH root

## Paso 1 — Asegurar el VPS antes que nada

> ⚠️ **NO saltar este paso. Es lo primero que se hace.**

### 1.1 Cambiar password de root

Desde el panel de Hostinger:
- Botón "Change" en Root password
- Generar password fuerte (mínimo 20 caracteres, mezcla)
- Guardar en gestor de contraseñas

### 1.2 Configurar SSH con llave pública

En la **Mac de Fer** (no en el VPS):

```bash
# Generar llave SSH si no existe
ssh-keygen -t ed25519 -C "fer@sinergia"
# Enter para ubicación default (~/.ssh/id_ed25519)
# Poner passphrase (RECOMENDADO)

# Copiar la llave al VPS
ssh-copy-id root@[IP_DEL_VPS]
# Te pide password de root la última vez

# Probar acceso
ssh root@[IP_DEL_VPS]
# Debe entrar sin pedir password (solo passphrase de la llave)
```

### 1.3 Deshabilitar login con password

Una vez confirmado que entras con llave, **en el VPS**:

```bash
# Editar config SSH
nano /etc/ssh/sshd_config

# Cambiar/agregar estas líneas:
PasswordAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes

# Guardar y reiniciar SSH
systemctl restart ssh
```

**Antes de cerrar la sesión actual**, abre OTRA terminal y prueba entrar de nuevo. Si falla, recuperas acceso vía el panel de Hostinger.

### 1.4 Instalar fail2ban

En el VPS:

```bash
apt update
apt install fail2ban -y

# Configurar
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
EOF

systemctl enable fail2ban
systemctl start fail2ban
systemctl status fail2ban  # debe estar active (running)
```

### 1.5 Configurar firewall

En el panel de Hostinger → Firewall rules, agregar:

| Acción | Protocolo | Puerto | Origen |
|---|---|---|---|
| Allow | TCP | 22 | Any (SSH protegido con llave + fail2ban) |
| Allow | TCP | 80 | Any (HTTP → redirige a HTTPS) |
| Allow | TCP | 443 | Any (HTTPS) |
| Allow | TCP | 3000 | Tu IP residencial (EasyPanel UI) |
| Deny | All | All | Any |

> **Nota**: si Fer no tiene IP fija, el puerto 3000 también queda con "Any" pero EasyPanel pide password.

### 1.6 Configurar auto-updates de seguridad

En el VPS:

```bash
apt install unattended-upgrades -y
dpkg-reconfigure -plow unattended-upgrades
# Selecciona "Yes"
```

### 1.7 Configurar zona horaria

```bash
timedatectl set-timezone America/Cancun
timedatectl  # verificar
```

## Paso 2 — Crear cuenta de admin en EasyPanel

1. Abrir navegador en `http://[IP_DEL_VPS]:3000`
2. Crear primer usuario admin:
   - Email: tu email real
   - Password fuerte (DIFERENTE al password de root)
3. Guardar credenciales en gestor de contraseñas
4. Activar 2FA si está disponible

## Paso 3 — Configurar dominio

### 3.1 En el panel del dominio que Fer use

Crear registro A:

```
Tipo:  A
Host:  app  (o el subdominio elegido)
Valor: [IP_DEL_VPS]
TTL:   3600
```

Esperar propagación DNS (puede tardar de minutos a horas). Verificar con:

```bash
dig app.[dominio].com +short
# Debe devolver la IP del VPS
```

### 3.2 En EasyPanel

1. Project Settings → Domains
2. Agregar dominio: `app.[dominio].com`
3. Activar Let's Encrypt para SSL automático

## Paso 4 — Crear servicios en EasyPanel

### 4.1 PostgreSQL

1. New Service → Database → PostgreSQL
2. Configuración:
   - Name: `motipreca-db`
   - Version: 16
   - Storage: 20 GB
   - Password: generar uno fuerte, guardar en gestor de contraseñas
3. Create

### 4.2 Redis

1. New Service → Database → Redis
2. Configuración:
   - Name: `motipreca-redis`
   - Version: 7
3. Create

### 4.3 App: Backend API

> Esto se hace **el Día 6 de la Semana 1**, cuando ya hay código en GitHub.

1. New Service → App
2. Configuración:
   - Name: `motipreca-api`
   - Source: GitHub → seleccionar repo
   - Branch: `main`
   - Build path: `apps/api`
   - Build command: `pnpm install && pnpm build`
   - Start command: `pnpm start`
   - Port: 3000
3. Variables de entorno (ver lista abajo)
4. Deploy

### 4.4 App: Frontend Web

1. New Service → App
2. Configuración:
   - Name: `motipreca-web`
   - Source: GitHub → seleccionar repo
   - Branch: `main`
   - Build path: `apps/web`
   - Build command: `pnpm install && pnpm build`
   - Static output: `dist/`
3. Variables de entorno: `VITE_API_URL=https://api.[dominio].com`
4. Deploy

## Paso 5 — Configurar variables de entorno en producción

En EasyPanel UI → Service → Environment:

```bash
# Conexiones
DATABASE_URL=postgresql://postgres:[PASSWORD]@motipreca-db:5432/motipreca
REDIS_URL=redis://motipreca-redis:6379

# JWT (generar con: openssl rand -base64 64)
JWT_SECRET=[generar]
JWT_REFRESH_SECRET=[generar]
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Servidor
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# CORS
CORS_ORIGIN=https://app.[dominio].com

# Módulo oculto (generar con: openssl rand -hex 16)
HIDDEN_MODULE_HASH=[generar]

# Integraciones (Semana 5+)
# ALEGRA_API_TOKEN=  ← agregar después
# RESEND_API_KEY=    ← agregar después
# R2_ACCOUNT_ID=     ← agregar después
```

## Paso 6 — Configurar backups automáticos

### 6.1 Backups de Hostinger

Ya viene "Weekly Backups" en el plan. Verificar en panel de Hostinger.

### 6.2 Backups adicionales de PostgreSQL

En EasyPanel → Service → Database → Backups:
- Frecuencia: diaria
- Retención: 30 días
- Destino: configurable (S3, R2, local)

> Recomendación: configurar a Cloudflare R2 cuando esté disponible.

## Paso 7 — Configurar dominios y SSL

En EasyPanel:

1. `motipreca-api` → Domains → `api.[dominio].com` → SSL automático
2. `motipreca-web` → Domains → `app.[dominio].com` → SSL automático

Esperar 1-2 minutos a que Let's Encrypt emita certificados.

Verificar:

```bash
curl https://app.[dominio].com
curl https://api.[dominio].com/health
```

## Paso 8 — Configurar GitHub → EasyPanel para deploy automático

En EasyPanel:

1. Service → Settings → Auto Deploy
2. Habilitar deploy automático en push a `main`
3. Configurar webhook si EasyPanel lo requiere

Probar:

```bash
# Hacer un cambio trivial
echo "test" >> README.md
git commit -am "test: auto deploy"
git push origin main

# Ver en EasyPanel UI que arranca el deploy automáticamente
```

## Paso 9 — Monitoreo básico

### 9.1 Logs en EasyPanel

UI → Service → Logs

### 9.2 Métricas

UI → Service → Metrics (CPU, RAM, request count)

### 9.3 Alertas

Configurar al menos:
- Servicio caído > 5 min
- CPU > 80% por 10 min
- Disco > 80%

## Paso 10 — Documentar todo en `/docs/deployment/`

Cuando Claude Code complete estos pasos con Fer, debe crear:

- `/docs/deployment/initial-setup.md` (resumen de lo que se hizo)
- `/docs/deployment/disaster-recovery.md` (cómo recuperar si algo falla)
- `/docs/deployment/secrets-management.md` (dónde se guarda cada credencial)

## Troubleshooting común

### "SSL no funciona"
- Verificar que el DNS está propagado (`dig`)
- Esperar a que Let's Encrypt termine (1-5 minutos)
- Revisar logs de Traefik en EasyPanel

### "API no se conecta a la BD"
- Verificar `DATABASE_URL` (debe usar el nombre del servicio, no IP)
- Verificar que PostgreSQL está corriendo
- Verificar que están en la misma red de Docker (EasyPanel lo maneja)

### "Login no funciona desde el frontend"
- Verificar CORS_ORIGIN coincide exactamente con el dominio del frontend
- Verificar que las cookies se están enviando (Network tab del browser)
- Verificar que el frontend usa la URL correcta de la API

### "Deploy automático no arranca"
- Verificar webhook de GitHub en repo settings
- Verificar credenciales de GitHub en EasyPanel
- Revisar logs de EasyPanel
