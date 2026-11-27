---
title: "Environment Variables"
summary: "Lookup table for API, dashboard, Cloudflare Worker, telemetry, and deployment environment variables."
topics: [reference, api]
sources:
  - id: api-readme
    type: file
    path: api/README.md
  - id: repo-guidance
    type: file
    path: CLAUDE.md
  - id: env-example
    type: file
    path: .env.example
  - id: crons-config
    type: file
    path: cloudflare-workers/crons/wrangler.toml
  - id: pulse-config
    type: file
    path: cloudflare-workers/pulse/wrangler.toml
  - id: health-report-config
    type: file
    path: cloudflare-workers/daily-health-report/wrangler.toml
  - id: docs-monitor-config
    type: file
    path: cloudflare-workers/docs-monitor/wrangler.toml
  - id: deploy-script
    type: file
    path: scripts/deploy.sh
  - id: dashboard-api-dir
    type: file
    path: dashboard/src/lib/api/
---

# Environment Variables

Environment variables are the repository's boundary for secrets, deployment IDs, database URLs, Discord credentials, telemetry keys, and dashboard build-time public settings. The repository guidance says not to hardcode API keys, tokens, passwords, project IDs, organization IDs, Supabase URLs, Discord IDs, or database connection strings; it directs contributors to use `.env` or Cloudflare secrets instead [@repo-guidance]. The current runtime is mixed: API docs still list Vercel-style variables, Cloudflare Pages uses `PUBLIC_*` build-time vars plus secrets, workers use `wrangler secret put`, and the older deploy script still expects Vercel IDs [@api-readme] [@repo-guidance] [@deploy-script].

## API And Dashboard

| Variable | Used by | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Download tracking API and weekly pulse worker | Required with a Supabase service key for component download tracking and Supabase metrics [@api-readme] [@pulse-config] |
| `SUPABASE_SERVICE_ROLE_KEY` | Download tracking API and weekly pulse worker | Service-role secret for Supabase writes and pulse reads [@api-readme] [@pulse-config] |
| `SUPABASE_API_KEY` | Local generator `.env.example` | Listed for scripts that fetch Supabase REST data, while production API docs use `SUPABASE_SERVICE_ROLE_KEY` [@env-example] [@api-readme] |
| `NEON_DATABASE_URL` | API routes and dashboard API helpers | Required for Neon-backed command usage, release monitoring, collections, website events, and health logs [@api-readme] [@dashboard-api-dir] |
| `CLERK_SECRET_KEY` | Dashboard auth helpers and collection APIs | Secret server key used by dashboard authentication and public collection author display lookups [@repo-guidance] [@dashboard-api-dir] |
| `PUBLIC_CLERK_PUBLISHABLE_KEY` | Cloudflare Pages dashboard build | Build-time public Clerk key stored in `dashboard/wrangler.toml` `[vars]`, not as a secret [@repo-guidance] |
| `PUBLIC_COMPONENTS_JSON_URL` | Cloudflare Pages dashboard build | Public build-time catalog URL, documented as `/components.json` [@repo-guidance] |
| `PUBLIC_GITHUB_CLIENT_ID` | GitHub OAuth UI/build path | Public build-time GitHub OAuth client id [@repo-guidance] |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth token API | Secret paired with the public client id [@repo-guidance] [@dashboard-api-dir] |

## Discord, Sentry, And Tests

| Variable | Used by | Notes |
| --- | --- | --- |
| `DISCORD_APP_ID` | Discord interaction surfaces | Listed as an API/dashboard secret [@api-readme] [@repo-guidance] |
| `DISCORD_BOT_TOKEN` | Discord API calls and pulse worker | Used as a Discord bot credential [@api-readme] [@pulse-config] |
| `DISCORD_PUBLIC_KEY` | Discord interaction verification | Required by Discord interaction endpoints [@api-readme] |
| `DISCORD_GUILD_ID` | Discord guild metrics and optional API config | Used by the pulse worker and listed in repo secret guidance [@pulse-config] [@repo-guidance] |
| `DISCORD_WEBHOOK_URL_CHANGELOG` | Release notifications and health alerts | Preferred changelog/alert webhook variable in API docs and dashboard guidance [@api-readme] [@repo-guidance] |
| `DISCORD_WEBHOOK_URL` | Fallback Discord webhook | Present in `.env.example` as a generic webhook and used as a fallback by release monitoring code paths [@env-example] |
| `SENTRY_DSN` | Workers and dashboard API error reporting | Cloudflare Workers and dashboard use it as a secret; the repo notes a separate CLI default DSN is handled in code with opt-in reporting [@repo-guidance] [@crons-config] |
| `API_BASE_URL` | API endpoint tests | Used to run API tests against production or another base URL [@api-readme] |

## Cloudflare Workers

| Worker | Required variables |
| --- | --- |
| `aitmpl-crons` | `DASHBOARD_URL` and `TRIGGER_SECRET`; optional `SENTRY_DSN` for error tracking and cron monitor reporting [@crons-config] |
| `pulse-weekly-report` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and `TRIGGER_SECRET`; optional `GA_PROPERTY_ID`, `GA_SERVICE_ACCOUNT_JSON`, and `SENTRY_DSN` [@pulse-config] |
| `daily-health-report` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SENTRY_AUTH_TOKEN`, and `SENTRY_ORG_SLUG`; optional `TRIGGER_SECRET` and `DASHBOARD_URL` [@health-report-config] |
| `claude-docs-monitor` | `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`; optional `TRIGGER_SECRET` and `SENTRY_DSN`; it also binds the `DOCS_MONITOR_KV` namespace [@docs-monitor-config] |

## Deployment Drift

Cloudflare deployment guidance says GitHub Actions need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, while Cloudflare Pages secrets hold non-public dashboard runtime values [@repo-guidance]. The older `scripts/deploy.sh` still loads `.env`, validates `VERCEL_ORG_ID` and `VERCEL_DASHBOARD_PROJECT_ID`, and deploys with `npx vercel --prod` [@deploy-script]. Treat those Vercel variables as deploy-script legacy requirements, not as the current Cloudflare Pages runtime contract [@repo-guidance] [@deploy-script].
