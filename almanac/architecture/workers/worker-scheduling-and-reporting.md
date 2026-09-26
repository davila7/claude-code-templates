---
title: "Worker Scheduling and Reporting"
summary: "Cloudflare Workers own the repository's scheduled monitoring and reporting jobs, while the dashboard remains the API target they call."
topics: [architecture, workers, monitoring]
sources:
  - id: workers-readme
    type: file
    path: cloudflare-workers/README.md
  - id: crons-worker
    type: file
    path: cloudflare-workers/crons/index.js
  - id: crons-config
    type: file
    path: cloudflare-workers/crons/wrangler.toml
  - id: docs-monitor-worker
    type: file
    path: cloudflare-workers/docs-monitor/index.js
  - id: docs-monitor-config
    type: file
    path: cloudflare-workers/docs-monitor/wrangler.toml
  - id: pulse-worker
    type: file
    path: cloudflare-workers/pulse/index.js
  - id: pulse-config
    type: file
    path: cloudflare-workers/pulse/wrangler.toml
  - id: daily-health-worker
    type: file
    path: cloudflare-workers/daily-health-report/index.js
  - id: daily-health-config
    type: file
    path: cloudflare-workers/daily-health-report/wrangler.toml
  - id: cloudflare-rule
    type: file
    path: .claude/rules/cloudflare.md
---

# Worker Scheduling and Reporting

Cloudflare Workers are the scheduled operations layer for this repository. They run separately from the Astro dashboard, call dashboard API routes when needed, and report operational state through Telegram and Sentry instead of relying on a web server process to stay awake [@workers-readme] [@cloudflare-rule].

## Runtime Shape

Each Worker project is a small directory under `cloudflare-workers/` with its own `index.js`, `wrangler.toml`, package file, and optional Sentry helper [@workers-readme]. The repository treats these projects as independent deployments: the dashboard serves the web app and API routes, while Workers handle automation, monitoring, and reporting schedules [@workers-readme] [@cloudflare-rule].

The `crons` Worker is the bridge from Cloudflare Cron Triggers into the dashboard API. Its configured schedules are every 30 minutes for `/api/claude-code-check` and hourly for `/api/health-check`; the Worker builds requests against `DASHBOARD_URL`, authenticates with `TRIGGER_SECRET`, and sends a worker-specific user agent [@crons-config] [@crons-worker]. This keeps release monitoring and health checks in the dashboard API surface while moving the scheduler itself out of legacy Vercel cron configuration [@workers-readme].

## Reporting Workers

The docs monitor watches `https://code.claude.com/docs`, normalizes the HTML, hashes the cleaned content with SHA-256, and stores the last hash plus timestamps in Cloudflare KV [@docs-monitor-worker]. It sends Telegram notifications only when the hash changes or when an error occurs, and its `wrangler.toml` binds `DOCS_MONITOR_KV` and runs the check hourly [@docs-monitor-worker] [@docs-monitor-config].

The pulse Worker is a weekly KPI reporter. On its Sunday 14:00 UTC schedule, it collects GitHub, Discord, Supabase download, npm, and optional Google Analytics data, formats one consolidated report, and sends it through Telegram [@pulse-config] [@pulse-worker]. The collectors are intentionally local to the single file and degrade per source, so one missing token or failed upstream API can be rendered as unavailable without dropping the whole report [@pulse-worker] [@cloudflare-rule].

The daily health report is the daily heartbeat. It checks the dashboard health endpoint, queries Sentry for unresolved issues across `aitmpl-workers`, `aitmpl-dashboard`, and `aitmpl-cli`, conservatively auto-resolves only known manual verification noise, and sends the digest to Telegram at 14:00 UTC [@daily-health-worker] [@daily-health-config].

## Sentry Check-Ins

The scheduled Workers use direct Sentry check-ins to show whether cron jobs are still running. The `crons`, `docs-monitor`, and `pulse` flows call `checkIn()` with `in_progress`, `ok`, or `error` statuses around their scheduled work, and they call `reportError()` when a request or collector fails [@crons-worker] [@docs-monitor-worker] [@pulse-worker]. The Cloudflare rule documents this as a zero-dependency Sentry pattern that complements Telegram notifications rather than replacing them [@cloudflare-rule].

The daily health Worker deliberately does not poll sibling Workers through their public `*.workers.dev` hostnames. Its source comments and configuration explain that same-account Worker-to-Worker fetches are blocked in that path, so the repo relies on the other Workers' Sentry Cron Monitor check-ins and summarizes Sentry instead [@daily-health-worker] [@daily-health-config].

## Operational Boundary

Worker deployment is CLI-first through Wrangler. The worker README documents `wrangler login`, `wrangler dev`, `wrangler deploy`, `wrangler tail`, KV commands, and `wrangler secret put` as the management path [@workers-readme]. That boundary matters because the dashboard runtime described in [Cloudflare Dashboard Runtime](../deployment/cloudflare-dashboard-runtime) is a Cloudflare Pages project, while these schedulers are separate Worker projects with their own secrets and cron definitions [@workers-readme] [@cloudflare-rule].
