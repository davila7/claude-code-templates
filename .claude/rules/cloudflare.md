---
paths:
  - "cloudflare-workers/**"
---

# Cloudflare Workers

Independent worker projects, deployed separately from the dashboard Pages project.

## Projects

- **crons**: Calls dashboard API endpoints on a schedule — `/api/claude-code-check` (every 30 min) and `/api/health-check` (hourly)
- **docs-monitor**: Monitors code.claude.com/docs changes hourly, sends Telegram notifications
- **pulse**: Weekly KPI report (GitHub, Discord, Supabase, npm, GA) every Sunday 14:00 UTC via Telegram

## Architecture

- Single `index.js` files, no npm runtime dependencies
- Secrets managed via Cloudflare dashboard / `wrangler secret put`
- Graceful degradation: each data source catches its own errors

## Error Tracking (Sentry)

- Each worker has its own `sentry.js` (identical zero-dependency helper, sends
  directly to the Sentry envelope API via `fetch()` — no SDK).
- `reportError(env, error, context)` — reports an exception/message.
- `checkIn(env, monitorSlug, status, checkInId?)` — Sentry Cron Monitor
  check-in (`in_progress` / `ok` / `error`), used to detect a cron that stops
  running entirely.
- Configure per worker: `wrangler secret put SENTRY_DSN` (DSN from the
  "aitmpl-workers" Sentry project). Optional — workers degrade gracefully
  (console.error only) if unset.
- Complements, doesn't replace, existing Telegram notifications.

## Deploy

```bash
cd cloudflare-workers/<project>
npx wrangler deploy
```
