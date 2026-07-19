# Cloudflare Workers

This directory contains Cloudflare Workers for automation and monitoring tasks that run on Cloudflare's edge network.

## Why Cloudflare Workers?

We separate monitoring and automation tasks into Cloudflare Workers to:

- ✅ **Separation of concerns**: the dashboard Pages project serves the web app, these Workers handle automated tasks
- ✅ **Better performance**: Ultra-fast edge computing with 0 cold starts
- ✅ **Free cron jobs**: Unlimited on the free tier
- ✅ **Scalability**: 100k requests/day on free tier
- ✅ **KV Storage included**: Save state without a database
- ✅ **100% CLI managed**: No dashboard needed - everything via `wrangler` CLI

## 📦 Available Workers

### [`crons`](./crons/)

Scheduled caller for the dashboard API (replaces the old Vercel cron jobs).

**Functionality:**
- Calls `/api/claude-code-check` every 30 minutes (monitors Claude Code npm releases)
- Calls `/api/health-check` every hour
- Reports errors and cron check-ins to Sentry

**Quick Start (CLI only):**
```bash
cd crons
npm install
wrangler login
npm run deploy
```

**Config & secrets:** see [crons/wrangler.toml](./crons/wrangler.toml) (schedules, `DASHBOARD_URL`, `TRIGGER_SECRET`, `SENTRY_DSN`).

### [`docs-monitor`](./docs-monitor/)

Claude Code documentation monitor with Telegram notifications.

**Functionality:**
- Monitors https://code.claude.com/docs every 6 hours
- Detects changes using SHA-256 hash
- Sends Telegram notifications when changes occur
- Includes HTTP endpoint for manual triggers

**Quick Start (CLI only):**
```bash
cd docs-monitor
npm install
wrangler login
npm run deploy
```

**Full documentation:** [docs-monitor/README.md](./docs-monitor/README.md)

### [`pulse`](./pulse/)

Weekly KPI report sent via Telegram every Sunday at 14:00 UTC.

**Functionality:**
- Collects metrics from GitHub, Discord, Supabase, npm, and Google Analytics
- Formats a consolidated weekly report
- Sends to Telegram automatically via cron
- Manual trigger via HTTP endpoint

**Quick Start (CLI only):**
```bash
cd pulse
npm install
wrangler login
npm run deploy
```

**Full documentation:** [pulse/README.md](./pulse/README.md)

### [`daily-health-report`](./daily-health-report/)

Daily monitoring digest sent via Telegram, every day at 14:00 UTC (10:00 AM EDT).

**Functionality:**
- Checks dashboard site health (reuses `/api/health-check`)
- Summarizes unresolved Sentry issues from the last 24h across all 3 Sentry projects (`aitmpl-workers`, `aitmpl-dashboard`, `aitmpl-cli`)
- Auto-resolves known test/verification noise (title match only, conservative by design — see `index.js`); real errors are always left open and listed for human review
- Complements (doesn't replace) docs-monitor's change/error alerts and pulse's weekly KPI report — this is the "everything's fine" / "here's what's broken" heartbeat
- Does NOT poll the other 3 workers directly (Cloudflare blocks Worker-to-Worker fetches over `*.workers.dev` within the same account — error 1042); their health is covered by Sentry Cron Monitor check-ins instead

**Quick Start (CLI only):**
```bash
cd daily-health-report
npm install
wrangler login
npm run deploy
```

**Config & secrets:** see [daily-health-report/wrangler.toml](./daily-health-report/wrangler.toml) (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`).

## 🚀 General Setup (CLI)

### Prerequisites

1. Cloudflare account (free)
2. Wrangler CLI installed:
   ```bash
   npm install -g wrangler
   ```

### Common CLI Commands

```bash
# Authenticate
wrangler login

# Develop locally
wrangler dev

# Deploy to production
wrangler deploy

# View real-time logs
wrangler tail

# List deployments
wrangler deployments list

# View deployment details
wrangler deployments view <deployment-id>

# List workers
wrangler deployments list

# Delete a worker
wrangler delete
```

### KV Storage Commands (CLI)

```bash
# Create KV namespace
wrangler kv:namespace create MY_KV

# List all namespaces
wrangler kv:namespace list

# List keys in namespace
wrangler kv:key list --namespace-id=<id>

# Get key value
wrangler kv:key get <key> --namespace-id=<id>

# Set key value
wrangler kv:key put <key> "<value>" --namespace-id=<id>

# Delete key
wrangler kv:key delete <key> --namespace-id=<id>
```

### Secrets Management (CLI)

```bash
# Set a secret
wrangler secret put SECRET_NAME

# List all secrets
wrangler secret list

# Delete a secret
wrangler secret delete SECRET_NAME
```

## 📁 Project Structure

Each worker follows this structure:

```
worker-name/
├── index.js          # Main worker code
├── wrangler.toml     # Cloudflare configuration
├── package.json      # Dependencies and scripts
├── .env.example      # Environment variables template
├── .gitignore        # Git ignored files
└── README.md         # Specific documentation
```

## 🔐 Secrets Management

Secrets are stored securely in Cloudflare via CLI:

```bash
# Add a secret (prompts for value)
wrangler secret put SECRET_NAME

# List configured secrets (doesn't show values)
wrangler secret list

# Delete a secret
wrangler secret delete SECRET_NAME
```

**⚠️ IMPORTANT**: Never commit secrets to code or .env files. Always use `wrangler secret put` for production.

## 💰 Costs

Cloudflare Workers **free tier** includes:

- 100,000 requests/day
- 10ms CPU time/request
- Unlimited cron triggers
- KV: 100k reads/day, 1k writes/day
- 1 GB storage

**For most use cases: $0.00/month**

## 📚 Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Workers Examples](https://developers.cloudflare.com/workers/examples/)
- [Cloudflare KV Storage](https://developers.cloudflare.com/kv/)
- [Cron Triggers Guide](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

## 🤝 Contributing

To add a new worker:

1. Create a directory: `cloudflare-workers/my-worker/`
2. Follow the standard structure (see above)
3. Document clearly its purpose in README.md
4. Add an entry in this main README
5. Use CLI for all operations

## 🎯 CLI-First Philosophy

This project emphasizes CLI usage:

- ✅ No need to access Cloudflare Dashboard
- ✅ Everything scriptable and automatable
- ✅ Version control friendly (wrangler.toml)
- ✅ CI/CD ready
- ✅ Reproducible deployments

All worker management, deployment, monitoring, and debugging can be done via `wrangler` CLI.

---

**Part of the [claude-code-templates](https://github.com/danipower/claude-code-templates) project**
