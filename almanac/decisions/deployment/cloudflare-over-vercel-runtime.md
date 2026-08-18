---
title: "Cloudflare Over Vercel Runtime"
summary: "Cloudflare Pages and Workers are the authoritative production runtime even though Vercel-oriented artifacts remain in the repository."
topics: [decisions, deployment, dashboard, workers]
sources:
  - id: claude-runtime
    type: file
    path: CLAUDE.md
  - id: dashboard-rule
    type: file
    path: .claude/rules/dashboard.md
  - id: cloudflare-rule
    type: file
    path: .claude/rules/cloudflare.md
  - id: astro-config
    type: file
    path: dashboard/astro.config.mjs
  - id: old-deploy-script
    type: file
    path: scripts/deploy.sh
  - id: vercel-config
    type: file
    path: vercel.json
  - id: old-deployment-guide
    type: file
    path: docs/guides/deployment.md
---

# Cloudflare Over Vercel Runtime

The production runtime is Cloudflare Pages for the Astro dashboard/API and Cloudflare Workers for scheduled automation. Vercel files and docs still exist, but they conflict with current repository guidance and should be treated as stale evidence unless a future migration deliberately restores them [@claude-runtime] [@dashboard-rule] [@cloudflare-rule] [@old-deploy-script] [@old-deployment-guide].

## Status

Accepted. `CLAUDE.md` says the dashboard and API routes deploy on Cloudflare Pages, and supporting cron and monitoring tasks run as Cloudflare Workers [@claude-runtime].

## Context

The dashboard is configured for Cloudflare. `astro.config.mjs` sets `output: 'server'` and uses the Cloudflare adapter in directory mode, which targets the Cloudflare Pages Workers runtime rather than a static Vercel output [@astro-config].

The dashboard rule states the same operational contract: Astro 5, React islands, Tailwind v4, Cloudflare Pages hosting, Cloudflare adapter, `dashboard/wrangler.toml`, and cron jobs in `cloudflare-workers/crons/` [@dashboard-rule].

The Worker rule records independent Worker projects for crons, docs monitoring, and pulse reporting, with secrets managed through Cloudflare and deployments done from each Worker directory using Wrangler [@cloudflare-rule].

## Decision

Cloudflare Pages is authoritative for the dashboard and API runtime. Manual dashboard deploys use Wrangler Pages deploy, automatic deploys happen on `main` for `dashboard/**`, and Cloudflare Pages secrets hold non-public runtime values [@claude-runtime].

Cloudflare Workers are authoritative for scheduled automation. The old Vercel cron role is replaced by the `crons` Worker calling `/api/claude-code-check` every 30 minutes and `/api/health-check` hourly [@claude-runtime] [@cloudflare-rule].

Vercel artifacts are not deployment instructions. The root deploy script still requires Vercel identifiers and runs `npx vercel --prod`, the old deployment guide describes Vercel GitHub secrets and Vercel domains, and `vercel.json` points at old static `docs` output and rewrites [@old-deploy-script] [@old-deployment-guide] [@vercel-config].

## Consequences

Deployment work should start from [Cloudflare Dashboard Runtime](../../architecture/deployment/cloudflare-dashboard-runtime) and [Deploy Dashboard and Workers](../../guides/deployment/deploy-dashboard-and-workers), not from Vercel docs or scripts [@claude-runtime] [@dashboard-rule].

New API routes should be implemented as Astro API routes under the dashboard, because the current runtime serves dashboard pages and APIs from the Cloudflare Pages project [@claude-runtime] [@dashboard-rule].

Cron behavior should stay in Workers. Reintroducing Vercel cron config or dashboard-owned cron behavior would duplicate the Worker layer and conflict with the current separation between Pages runtime and scheduled automation [@claude-runtime] [@cloudflare-rule].

The repository still has drift to clean up. Until stale Vercel artifacts are removed or rewritten, deployment reviews must explicitly prefer Cloudflare source files and current root guidance over the old script, old guide, and root Vercel config [@claude-runtime] [@old-deploy-script] [@old-deployment-guide] [@vercel-config].
