# Pulse — Weekly KPI Report (Cloudflare Worker)

Collects metrics from GitHub, Discord, Supabase, Vercel, and Google Analytics every Sunday at 14:00 UTC and sends a consolidated report via Telegram.

## Setup

### 1. Install dependencies

```bash
cd cloudflare-workers/pulse
npm install
```

### 2. Configure secrets

Set each secret using `wrangler secret put`:

```bash
# Telegram (same bot/chat as docs-monitor)
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID

# GitHub
wrangler secret put GITHUB_TOKEN          # PAT with public_repo scope

# Supabase
wrangler secret put SUPABASE_URL          # https://xxx.supabase.co
wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Discord
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_GUILD_ID

# Vercel
wrangler secret put VERCEL_TOKEN          # Personal access token
wrangler secret put VERCEL_PROJECT_ID     # aitmpl project ID

# Manual trigger auth
wrangler secret put TRIGGER_SECRET

# Optional — Google Analytics (add later)
wrangler secret put GA_PROPERTY_ID
wrangler secret put GA_SERVICE_ACCOUNT_JSON  # Base64-encoded service account JSON
```

### 3. Deploy

```bash
wrangler deploy
```

## Usage

### Automatic (Cron)

Runs every Sunday at 14:00 UTC (11:00 AM Chile). No action needed after deploy.

### Manual trigger

```bash
# Full report
curl -X POST https://pulse-weekly-report.YOUR_SUBDOMAIN.workers.dev/trigger \
  -H "Authorization: Bearer YOUR_TRIGGER_SECRET"

# Single source only
curl -X POST "https://pulse-weekly-report.YOUR_SUBDOMAIN.workers.dev/trigger?source=github" \
  -H "Authorization: Bearer YOUR_TRIGGER_SECRET"

# Dry run (don't send to Telegram)
curl -X POST "https://pulse-weekly-report.YOUR_SUBDOMAIN.workers.dev/trigger?send=false" \
  -H "Authorization: Bearer YOUR_TRIGGER_SECRET"
```

### Status

```bash
curl https://pulse-weekly-report.YOUR_SUBDOMAIN.workers.dev/status
```

## Local development

```bash
npm run dev              # Start local dev server
npm run test             # Test cron trigger locally
```

## Report format

```
📊 PULSE — Weekly Report
📅 Jan 25, 2026 - Jan 31, 2026

⭐ GITHUB
├ Stars: 1,234 (+45)
├ Forks: 156 (+8)
├ Issues: 12 open (3 new, 2 closed)
└ PRs: 5 opened, 4 merged

💬 DISCORD
├ Members: 890 (+23)
├ Active: ~145
└ Messages: 312

📦 DOWNLOADS
├ Total: 45,678 (+1,234)
├ Top: frontend-developer (89)
├ By type: agents 65% | commands 20% | settings 15%
└ Countries: US 40% | DE 15% | BR 10% | UK 8% | CL 5%

RETURNING INSTALLERS (week of Oct 26)
├ Returning: 361 of 3,098 active (11.7%) (-86)
├ 4-week avg: 444 (12.7%)
├ New installers: 2,737
├ New installers back: next week 3.8% (week of Oct 19), within 4 weeks 8.4% (week of Sep 28)
└ This week so far: 323 of 2,341 (13.8%)

🚀 VERCEL
├ Deploys: 12 (11 ✅ 1 ❌)
└ Latest: 2h ago ✅

📈 ANALYTICS
├ Visitors: 3,456
├ Pageviews: 12,345
├ Top: / (4,567) | /agents (2,345) | /commands (1,234)
└ Referrers: google (45%) | github (30%) | direct (15%)
```

Sources that fail gracefully show `⚠️ Unavailable` instead.

`RETURNING INSTALLERS` (`?source=returning`) calls the Supabase function
`public.weekly_returning_installers()` from
`database/migrations/005_weekly_returning_installers.sql`, which has the
definitions (installer, ISO week, returning, new, class split). Apply that
migration before deploying, or the section shows `Unavailable` (HTTP 404).
The cron runs before the week ends, so the headline is the last complete week
and the current week is the "so far" line.
