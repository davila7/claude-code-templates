# Claude Code Documentation Monitor

Sistema de monitoreo que detecta cambios en la documentación oficial de Claude Code (code.claude.com/docs) y envía notificaciones detalladas a Telegram.

## Características

- **Monitoreo granular**: Detecta cambios a nivel de sección, no solo de página
- **Notificaciones detalladas**: Muestra la URL exacta, sección y diff del cambio
- **24 páginas monitoreadas**: Cubre toda la documentación oficial
- **Historial de cambios**: Guarda todos los cambios en base de datos
- **Resumen diario**: Opción de enviar resumen de cambios del día

## Información que proporciona

Cuando detecta un cambio, la notificación de Telegram incluye:

```
🔔 Cambio detectado en la documentación de Claude Code

📄 Página: Hooks Reference
🔗 URL: https://code.claude.com/docs/en/hooks
📅 Fecha: 28/01/2026, 15:30:00

📊 Resumen de cambios:
  • Secciones añadidas: 1
  • Secciones modificadas: 2
  • Secciones eliminadas: 0

🟡 Sección MODIFICADA
📍 Sección: PreToolUse Hook
🔗 Ver sección → (link directo a la sección)

❌ Texto eliminado:
Hooks execute before tool calls

✅ Texto añadido:
Hooks execute before and after tool calls with new timeout options
```

## Páginas Monitoreadas

| Categoría | Páginas |
|-----------|---------|
| Getting Started | overview, quickstart, how-claude-code-works |
| Guides | best-practices, common-workflows, memory, skills |
| Configuration | settings, mcp, hooks, hooks-guide |
| Extensions | plugins, plugins-reference, sub-agents |
| IDE Integration | vs-code, desktop, chrome, claude-code-on-the-web |
| CI/CD | github-actions, gitlab-ci-cd |
| Reference | security, troubleshooting, changelog |

## Setup

### 1. Configurar Base de Datos

Ejecuta la migración en tu base de datos Neon:

```bash
psql "$NEON_DATABASE_URL" < database/migrations/001_create_docs_snapshots.sql
```

### 2. Configurar Variables de Entorno en Vercel

```bash
# Base de datos (ya deberías tenerla del changelog monitor)
NEON_DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_CHAT_ID=-1001234567890
```

### 3. Crear Bot de Telegram

1. Habla con [@BotFather](https://t.me/botfather) en Telegram
2. Envía `/newbot` y sigue las instrucciones
3. Guarda el token que te da
4. Crea un grupo o canal y añade tu bot
5. Obtén el chat_id del grupo

### 4. Deploy a Vercel

```bash
vercel --prod
```

## Endpoints

### `GET /api/docs-monitor/check-docs`

Verifica todas las páginas de documentación.

**Parámetros:**
- `slug` (opcional): Verificar solo una página específica
- `notify` (default: true): Enviar notificaciones a Telegram
- `summary` (default: false): Solo enviar resumen diario

**Ejemplos:**

```bash
# Verificar todas las páginas
curl https://your-domain.vercel.app/api/docs-monitor/check-docs

# Verificar solo una página
curl "https://your-domain.vercel.app/api/docs-monitor/check-docs?slug=hooks"

# Sin notificaciones (solo guardar en DB)
curl "https://your-domain.vercel.app/api/docs-monitor/check-docs?notify=false"

# Enviar resumen diario
curl "https://your-domain.vercel.app/api/docs-monitor/check-docs?summary=true"
```

**Respuesta:**

```json
{
  "status": "success",
  "timestamp": "2026-01-28T15:30:00.000Z",
  "summary": {
    "pagesChecked": 24,
    "changesDetected": 2,
    "notificationsSent": 2,
    "errors": 0
  },
  "changes": [
    {
      "slug": "hooks",
      "pageTitle": "Hooks Reference",
      "url": "https://code.claude.com/docs/en/hooks",
      "summary": {
        "added": 1,
        "modified": 1,
        "removed": 0
      },
      "changes": [
        {
          "type": "modified",
          "section": "PreToolUse Hook",
          "anchor": "pretooluse-hook"
        },
        {
          "type": "added",
          "section": "New Timeout Options",
          "anchor": "new-timeout-options"
        }
      ]
    }
  ]
}
```

## Configurar Cron Job

### Opción 1: Vercel Cron (Recomendada)

En `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/docs-monitor/check-docs",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Esto verificará cada 6 horas.

### Opción 2: GitHub Actions

```yaml
name: Check Claude Code Docs

on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Check Documentation
        run: |
          curl -X GET https://your-domain.vercel.app/api/docs-monitor/check-docs
```

## Arquitectura

```
code.claude.com/docs
        ↓
[Vercel Function] /api/docs-monitor/check-docs
        ↓
[Scraper] Extrae contenido con Cheerio
        ↓
[Parser] Divide en secciones por headers
        ↓
[Comparador] Detecta cambios con diff
        ↓
[Neon DB] Guarda snapshots y cambios
        ↓
[Telegram Bot] Envía notificación detallada
```

## Esquema de Base de Datos

### `doc_page_snapshots`
Almacena el estado actual y histórico de cada página.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| slug | VARCHAR | Identificador de la página |
| url | VARCHAR | URL completa |
| page_title | VARCHAR | Título de la página |
| content_hash | VARCHAR | Hash para detección rápida |
| sections | JSONB | Secciones parseadas |
| is_latest | BOOLEAN | Si es el snapshot actual |

### `doc_changes`
Registra cada cambio detectado.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| slug | VARCHAR | Página donde ocurrió |
| change_type | VARCHAR | added, modified, removed |
| section_title | VARCHAR | Título de la sección |
| section_anchor | VARCHAR | Anchor para link directo |
| old_content | TEXT | Contenido anterior |
| new_content | TEXT | Contenido nuevo |
| diff_added | TEXT[] | Líneas añadidas |
| diff_removed | TEXT[] | Líneas eliminadas |

## Queries Útiles

```sql
-- Ver cambios recientes
SELECT * FROM recent_doc_changes LIMIT 20;

-- Estado de todas las páginas
SELECT * FROM doc_pages_status;

-- Cambios de las últimas 24 horas
SELECT
  slug,
  page_title,
  section_title,
  change_type,
  detected_at
FROM doc_changes
WHERE detected_at > NOW() - INTERVAL '24 hours'
ORDER BY detected_at DESC;

-- Páginas con más cambios
SELECT
  slug,
  COUNT(*) as total_changes
FROM doc_changes
GROUP BY slug
ORDER BY total_changes DESC;
```

## Diferencias con el Changelog Monitor

| Característica | Changelog Monitor | Docs Monitor |
|---------------|-------------------|--------------|
| Fuente | NPM + GitHub CHANGELOG | Web scraping docs |
| Granularidad | Por versión | Por sección |
| Frecuencia | Cada release | Configurable |
| Notificación | Discord | Telegram |
| Diff | Por tipo de cambio | Por línea de texto |

## Troubleshooting

### Error: "Could not find main content"
La estructura del sitio cambió. Actualizar selectores en `scraper.js`.

### Error: "TELEGRAM_BOT_TOKEN not configured"
Agregar variables de entorno en Vercel.

### Notificaciones no llegan
1. Verificar que el bot está en el chat
2. Verificar que el chat_id es correcto (incluir `-` para grupos)
3. Revisar logs en Vercel

### Muchos falsos positivos
Ajustar el algoritmo de comparación en `compareSnapshots()`.

## Dependencias

```json
{
  "@neondatabase/serverless": "^0.9.0",
  "axios": "^1.6.0",
  "cheerio": "^1.0.0-rc.12"
}
```

## Próximas mejoras

- [ ] Webhook para notificar cambios en tiempo real
- [ ] Dashboard web para ver historial de cambios
- [ ] Filtros por categoría de página
- [ ] Comparación visual de cambios (side-by-side)
- [ ] Alertas personalizadas por sección de interés

---

**Parte del proyecto Claude Code Templates** | [aitmpl.com](https://aitmpl.com)
