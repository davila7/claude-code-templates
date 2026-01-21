# Claude Code Changelog Monitor

Sistema automatizado para monitorear releases de Claude Code y enviar notificaciones a Discord.

## 🚀 Características

- ✅ **Detección automática** de nuevas versiones en NPM
- ✅ **Parseo inteligente** del CHANGELOG.md
- ✅ **Notificaciones Discord** con embeds formateados
- ✅ **Base de datos Neon** para tracking y logs
- ✅ **Clasificación automática** de cambios (features, fixes, improvements)
- ✅ **Sin cron jobs** - trigger directo desde NPM webhooks o manual

## 📋 Arquitectura

```
NPM Release
    ↓
[Vercel Function] /api/claude-code-monitor
    ↓
[Fetch CHANGELOG.md] ← GitHub
    ↓
[Parse Changes] → Clasificar por tipo
    ↓
[Save to Neon DB]
    ↓
[Send to Discord] → Webhook
    ↓
[Log Result]
```

## 🛠️ Setup

### 1. Crear Base de Datos en Neon

1. Ve a [Neon Console](https://console.neon.tech/)
2. Crea un nuevo proyecto
3. Copia la connection string
4. Ejecuta el script de migración:

```bash
psql "YOUR_NEON_CONNECTION_STRING" < database/migrations/001_create_claude_code_versions.sql
```

### 2. Configurar Variables de Entorno

En Vercel, agrega estas variables:

```bash
# Neon Database
NEON_DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Discord Webhook (específico para Claude Code changelog)
DISCORD_WEBHOOK_URL_CHANGELOG=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN

# O usa el webhook general (fallback)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

### 3. Deploy a Vercel

```bash
npm install
vercel --prod
```

## 📡 Endpoints

### `GET/POST /api/claude-code-monitor`

Endpoint principal que hace todo el proceso:

1. Verifica última versión en NPM
2. Descarga CHANGELOG.md
3. Parsea cambios
4. Guarda en Neon DB
5. Envía a Discord
6. Registra logs

**Respuesta exitosa:**

```json
{
  "status": "success",
  "version": "2.0.31",
  "versionId": 1,
  "changes": {
    "total": 15,
    "byType": {
      "feature": 8,
      "fix": 5,
      "improvement": 2
    }
  },
  "discord": {
    "sent": true,
    "status": 200
  }
}
```

**Respuesta si ya fue procesada:**

```json
{
  "status": "already_processed",
  "version": "2.0.31",
  "message": "Version already notified to Discord"
}
```

### `POST /api/claude-code-monitor/webhook`

Webhook para recibir notificaciones de NPM (alternativa).

### `POST /api/claude-code-monitor/discord-notifier`

Procesa y notifica una versión ya guardada en la DB.

**Body:**

```json
{
  "versionId": 1
}
```

## 🔄 Configurar Trigger Automático

### Opción 1: NPM Webhooks (Recomendada)

NPM puede enviar webhooks cuando se publica un paquete, pero requiere cuenta Pro.

Si tienes NPM Pro:

1. Ve a la configuración del paquete
2. Agrega webhook: `https://your-domain.vercel.app/api/claude-code-monitor/webhook`

### Opción 2: GitHub Actions (Gratis)

Crea `.github/workflows/check-claude-code.yml`:

```yaml
name: Check Claude Code Updates

on:
  schedule:
    - cron: '0 */4 * * *' # Cada 4 horas
  workflow_dispatch: # Manual trigger

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Vercel Function
        run: |
          curl -X POST https://your-domain.vercel.app/api/claude-code-monitor
```

### Opción 3: Vercel Cron Jobs

En `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/claude-code-monitor",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

### Opción 4: Manual

Simplemente abre en el navegador o haz un GET request:

```bash
curl https://your-domain.vercel.app/api/claude-code-monitor
```

## 📊 Schema de Base de Datos

### `claude_code_versions`

Almacena todas las versiones detectadas.

| Campo                           | Tipo      | Descripción                      |
| ------------------------------- | --------- | -------------------------------- |
| id                              | SERIAL    | ID único                         |
| version                         | VARCHAR   | Número de versión (ej: "2.0.31") |
| published_at                    | TIMESTAMP | Fecha de publicación             |
| changelog_content               | TEXT      | Contenido completo del changelog |
| npm_url                         | VARCHAR   | URL del paquete en NPM           |
| github_url                      | VARCHAR   | URL del changelog en GitHub      |
| discord_notified                | BOOLEAN   | Si ya se notificó a Discord      |
| discord_notification_sent_at    | TIMESTAMP | Cuándo se envió la notificación  |

### `claude_code_changes`

Cambios individuales parseados.

| Campo       | Tipo    | Descripción                               |
| ----------- | ------- | ----------------------------------------- |
| id          | SERIAL  | ID único                                  |
| version_id  | INTEGER | FK a claude_code_versions                 |
| change_type | VARCHAR | feature, fix, improvement, breaking, etc. |
| description | TEXT    | Descripción del cambio                    |
| category    | VARCHAR | Plugin System, CLI, Performance, etc.     |

### `discord_notifications_log`

Log de todas las notificaciones enviadas.

| Campo           | Tipo      | Descripción                   |
| --------------- | --------- | ----------------------------- |
| id              | SERIAL    | ID único                      |
| version_id      | INTEGER   | FK a claude_code_versions     |
| webhook_url     | VARCHAR   | URL del webhook usado         |
| payload         | JSONB     | Payload completo enviado      |
| response_status | INTEGER   | HTTP status code de respuesta |
| response_body   | TEXT      | Respuesta del webhook         |
| error_message   | TEXT      | Error si hubo                 |
| sent_at         | TIMESTAMP | Cuándo se envió               |

### `monitoring_metadata`

Metadata del sistema de monitoreo.

| Campo              | Tipo      | Descripción                      |
| ------------------ | --------- | -------------------------------- |
| id                 | SERIAL    | ID único (siempre 1)             |
| last_check_at      | TIMESTAMP | Última verificación              |
| last_version_found | VARCHAR   | Última versión encontrada        |
| check_count        | INTEGER   | Número de verificaciones         |
| error_count        | INTEGER   | Número de errores                |
| last_error         | TEXT      | Último error (si hubo)           |

## 🧪 Testing

### Test Manual

```bash
# Verificar endpoint
curl https://your-domain.vercel.app/api/claude-code-monitor

# Ver respuesta completa
curl -v https://your-domain.vercel.app/api/claude-code-monitor
```

### Test Local

```bash
# Instalar dependencias
cd api
npm install

# Configurar .env
echo "NEON_DATABASE_URL=your_connection_string" > .env
echo "DISCORD_WEBHOOK_URL=your_webhook_url" >> .env

# Ejecutar con Vercel Dev
vercel dev

# En otra terminal
curl http://localhost:3000/api/claude-code-monitor
```

## 📝 Parser de Changelog

El parser clasifica automáticamente los cambios:

### Tipos de Cambios

- **feature**: Add, New, Introduce, Support for
- **fix**: Fix, Resolve, Correct, Patch
- **improvement**: Improve, Enhance, Optimize, Better
- **breaking**: Breaking, Removed, Deprecated
- **performance**: Performance, Speed, Faster
- **documentation**: Docs, Documentation

### Categorías Detectadas

- Plugin System
- CLI
- Performance
- UI/UX
- API
- Models (Sonnet, Opus, Haiku)
- MCP (Model Context Protocol)
- Agents/Subagents
- Settings
- Hooks
- Security
- Platform-specific (Windows, macOS, Linux)

## 🎨 Formato de Discord

El embed incluye:

- **Título**: 🚀 Claude Code [version] Released
- **Color**: Purple (#8B5CF6) - color de Claude
- **Fields**:
  - ⚠️ Breaking Changes (si hay)
  - ✨ New Features
  - ⚡ Improvements
  - 🐛 Bug Fixes
  - 📦 Installation command
  - 🔗 Links (NPM + GitHub)

## 🐛 Troubleshooting

### Error: "NEON_DATABASE_URL not configured"

**Solución**: Agrega la variable de entorno en Vercel Settings → Environment Variables

### Error: "Discord webhook URL not configured"

**Solución**: Agrega `DISCORD_WEBHOOK_URL_CHANGELOG` o `DISCORD_WEBHOOK_URL`

### Error: "Version not found in changelog"

**Causa**: La versión en NPM aún no está en el CHANGELOG.md de GitHub

**Solución**: Esperar a que Anthropic actualice el changelog, o verificar manualmente

### Notificación duplicada

**Causa**: El sistema está configurado con múltiples triggers

**Solución**: Revisa que no tengas cron jobs duplicados en GitHub Actions + Vercel

### Base de datos no conecta

**Solución**:

```bash
# Test connection string
psql "$NEON_DATABASE_URL" -c "SELECT 1"

# Verificar que el proyecto de Neon esté activo
# Verificar que la IP de Vercel no esté bloqueada
```

## 📊 Queries Útiles

```sql
-- Ver últimas versiones procesadas
SELECT version, published_at, discord_notified
FROM claude_code_versions
ORDER BY published_at DESC
LIMIT 10;

-- Ver estadísticas de cambios por tipo
SELECT
  v.version,
  c.change_type,
  COUNT(*) as count
FROM claude_code_versions v
JOIN claude_code_changes c ON c.version_id = v.id
GROUP BY v.version, c.change_type
ORDER BY v.published_at DESC;

-- Ver logs de Discord
SELECT
  v.version,
  dl.response_status,
  dl.sent_at,
  dl.error_message
FROM discord_notifications_log dl
JOIN claude_code_versions v ON v.id = dl.version_id
ORDER BY dl.sent_at DESC;

-- Ver metadata de monitoreo
SELECT * FROM monitoring_metadata;
```

## 🚀 Próximas Mejoras

- [ ] Command Discord `/claude-changelog [version]`
- [ ] Comparación entre versiones
- [ ] Estadísticas de adopción
- [ ] Alertas para breaking changes
- [ ] Integración con Slack/Telegram
- [ ] Dashboard web para visualizar releases

## 📚 Referencias

- [Claude Code GitHub](https://github.com/anthropics/claude-code)
- [Claude Code NPM](https://www.npmjs.com/package/@anthropic-ai/claude-code)
- [Neon Database Docs](https://neon.tech/docs)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
- [Vercel Functions](https://vercel.com/docs/functions)

---

**Made with ❤️ for the Claude Code community**
