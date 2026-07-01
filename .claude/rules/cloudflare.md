---
paths:
  - "cloudflare-workers/**"
---

# Cloudflare Workers

Independent worker projects, deployed separately from the dashboard Pages project.

## Projects

- **docs-monitor**: Monitors code.claude.com/docs changes hourly, sends Telegram notifications
- **pulse**: Weekly KPI report (GitHub, Discord, Supabase, npm, Cloudflare Pages, GA) every Sunday 14:00 UTC via Telegram
- **crons**: Runs `/api/claude-code-check` (every 30 min) and `/api/health-check` (hourly) on the dashboard — replaces the old Vercel Cron config

## Architecture

- Single `index.js` files, no npm runtime dependencies
- Secrets managed via Cloudflare dashboard / `wrangler secret put`
- Graceful degradation: each data source catches its own errors

## Deploy

```bash
cd cloudflare-workers/<project>
npx wrangler deploy
```
