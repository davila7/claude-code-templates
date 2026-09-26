---
title: "Deploy Dashboard and Workers"
summary: "Deploy the Cloudflare Pages dashboard and the separate Cloudflare Workers without following stale Vercel instructions."
topics: [guides, deployment, dashboard, workers]
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
  - id: dashboard-package
    type: file
    path: dashboard/package.json
  - id: workers-readme
    type: file
    path: cloudflare-workers/README.md
  - id: old-deploy-script
    type: file
    path: scripts/deploy.sh
  - id: old-deployment-guide
    type: file
    path: docs/guides/deployment.md
---

# Deploy Dashboard and Workers

Deploying this repository means treating the Astro dashboard as a Cloudflare Pages project and treating `cloudflare-workers/` as separate Wrangler-managed Worker projects. The current instructions say the dashboard/API runtime deploys through Wrangler Pages and GitHub Actions, while older Vercel scripts and docs still exist and should be read as drift, not as the deployment path [@claude-runtime] [@dashboard-rule] [@old-deploy-script] [@old-deployment-guide].

## Task

Use this guide when a change needs to reach production for `www.aitmpl.com`, `app.aitmpl.com`, dashboard API routes, or scheduled Worker jobs. Dashboard page/API changes live under `dashboard/`; scheduled release checks, health checks, docs monitoring, pulse reports, and daily health reports live under `cloudflare-workers/` [@claude-runtime] [@workers-readme].

## Outcome

A successful dashboard deployment has a built Astro server app deployed to the Cloudflare Pages project `aitmpl-dashboard`, with API routes still served from `dashboard/src/pages/api/` [@claude-runtime]. A successful Worker deployment updates one Worker project from inside its own `cloudflare-workers/<project>` directory using `wrangler deploy` [@cloudflare-rule] [@workers-readme].

## Steps

1. Identify the runtime you are changing. Use [Cloudflare Dashboard Runtime](../../architecture/deployment/cloudflare-dashboard-runtime) for `dashboard/**`, and use [Worker Scheduling and Reporting](../../architecture/workers/worker-scheduling-and-reporting) for `cloudflare-workers/**` [@dashboard-rule] [@cloudflare-rule].

2. For dashboard changes, build from `dashboard/` with `npm run build`. The dashboard package defines `build` as `astro build`, and the repository deployment notes require a build before deploy [@dashboard-package] [@claude-runtime].

3. Prefer the automatic dashboard deployment path. Pushes to `main` that change `dashboard/**` trigger production deployment; manual deployment is documented as Wrangler Pages deploy, not Vercel [@claude-runtime].

4. If a manual dashboard deploy is required, run it from `dashboard/` through Wrangler Pages: `npx wrangler pages deploy dist --project-name=aitmpl-dashboard`. `CLAUDE.md` mentions an `npm run deploy` shortcut, but this checkout's `dashboard/package.json` only defines dev, build, preview, and Astro scripts, so the explicit Wrangler command is the safer local command [@claude-runtime] [@dashboard-package].

5. For Worker changes, enter the specific Worker directory and run `npx wrangler deploy`. The Worker rule and README both describe each Worker as an independent project with its own config, secrets, and deployment command [@cloudflare-rule] [@workers-readme].

6. Keep secrets out of source. Dashboard non-public values belong in Cloudflare Pages secrets, and Worker secrets belong in Cloudflare through `wrangler secret put` [@claude-runtime] [@workers-readme].

## Verification

For dashboard deploys, check recent Pages deployments with Wrangler and tail the Pages deployment when API behavior is wrong. `CLAUDE.md` records `npx wrangler pages deployment list --project-name=aitmpl-dashboard`, rollback commands, and Pages logs as the operational tools [@claude-runtime].

For dashboard API changes, verify the route exists under `dashboard/src/pages/api/` and that required environment variables or secrets are present in Cloudflare Pages. The dashboard rule requires Astro API route exports and shared API helpers for CORS and error tracking [@dashboard-rule].

For Worker deploys, use the Worker README's Wrangler operations: `wrangler tail` for logs, deployment listing commands for rollout state, KV commands when the docs monitor state is involved, and `wrangler secret list` when a missing secret is suspected [@workers-readme].

## Recovery

If someone suggests `./scripts/deploy.sh`, stop and inspect drift first. That script requires Vercel project identifiers and runs `npx vercel --prod`, while the current runtime documentation says manual deploys use Wrangler Pages [@old-deploy-script] [@claude-runtime].

If someone follows `docs/guides/deployment.md`, treat it as old static-site deployment documentation. It describes Vercel tokens, Vercel project linking, and Vercel custom domains, which conflict with the current Cloudflare Pages runtime [@old-deployment-guide] [@claude-runtime].

If a scheduled job appears broken after a dashboard deploy, check the Worker layer before changing dashboard cron behavior. The crons Worker owns calls to `/api/claude-code-check` and `/api/health-check`, and the dashboard rule says cron jobs run separately in `cloudflare-workers/crons/` [@workers-readme] [@dashboard-rule].
