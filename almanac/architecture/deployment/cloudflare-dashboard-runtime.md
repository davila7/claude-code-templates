---
title: "Cloudflare Dashboard Runtime"
summary: "The dashboard now runs as an Astro server-rendered Cloudflare Pages app, while Vercel-oriented files remain stale deployment evidence."
topics: [architecture, deployment, dashboard]
sources:
  - id: claude-runtime
    type: file
    path: CLAUDE.md
  - id: dashboard-rule
    type: file
    path: .claude/rules/dashboard.md
  - id: astro-config
    type: file
    path: dashboard/astro.config.mjs
  - id: wrangler-config
    type: file
    path: dashboard/wrangler.toml
  - id: dashboard-package
    type: file
    path: dashboard/package.json
  - id: deploy-script
    type: file
    path: scripts/deploy.sh
  - id: vercel-config
    type: file
    path: vercel.json
  - id: old-deployment-guide
    type: file
    path: docs/guides/deployment.md
---

# Cloudflare Dashboard Runtime

The dashboard runtime is Cloudflare Pages running an Astro server build, not the older Vercel static deployment path. Contributors should treat `dashboard/` and `dashboard/wrangler.toml` as the current runtime contract, and treat `vercel.json`, `docs/guides/deployment.md`, and `scripts/deploy.sh` as drift to inspect carefully rather than follow blindly [@claude-runtime] [@dashboard-rule] [@wrangler-config] [@deploy-script] [@old-deployment-guide].

## Current Runtime

The dashboard is an Astro 5 application with React islands and Tailwind v4 dependencies [@dashboard-package]. Its Astro config sets `output: 'server'` and uses `@astrojs/cloudflare` in directory mode, so API routes and server-rendered pages target the Cloudflare Pages Workers runtime [@astro-config].

Cloudflare Pages configuration lives in `dashboard/wrangler.toml`. It names the Pages project `aitmpl-dashboard`, sets `pages_build_output_dir = "./dist"`, enables `nodejs_compat`, and stores public build-time values in `[vars]` [@wrangler-config]. Non-public values such as Clerk, Supabase, Neon, Discord, GitHub, and Sentry secrets are expected to be configured as Cloudflare secrets rather than committed source values [@claude-runtime] [@wrangler-config].

The runtime has two compatibility accommodations. `astro.config.mjs` aliases `react-dom/server` to `react-dom/server.node` during builds and marks `react-dom` as `noExternal`, which keeps React SSR working in this Cloudflare target [@astro-config] [@claude-runtime]. It also externalizes selected `node:` built-ins while `dashboard/wrangler.toml` enables `nodejs_compat`, so server code should be cautious about adding new Node-only assumptions [@astro-config] [@wrangler-config] [@claude-runtime].

## API and Data Boundary

The dashboard serves both pages and API routes from the Astro project. Repository guidance lists critical APIs under `dashboard/src/pages/api/`, including download tracking, Discord interactions, release monitoring, and health checks [@claude-runtime] [@dashboard-rule]. Scheduled calls into those APIs are owned by the separate Worker layer described in [Worker Scheduling and Reporting](../workers/worker-scheduling-and-reporting), so cron behavior should not be reintroduced into the Pages project itself [@wrangler-config] [@claude-runtime].

Static catalog artifacts are also part of this runtime. The dashboard rule says the app loads `components.json` plus per-component content from `dashboard/public/`, while `CLAUDE.md` records that generated dashboard artifacts include `components.json`, `counts.json`, per-type slices, `search-index.json`, and `component-content/{type}/{slug}.json` [@dashboard-rule] [@claude-runtime].

## Deployment Drift

The strongest current instructions say Cloudflare Pages is production. `CLAUDE.md` says manual deployment uses Wrangler Pages deploy, pushes to `main` deploy through GitHub Actions when `dashboard/**` changes, and `dashboard/wrangler.toml` is the Pages project setup [@claude-runtime]. The dashboard rule reinforces this and says not to recreate Vercel deployment config after migration [@dashboard-rule].

Several files still describe Vercel. `scripts/deploy.sh` requires `VERCEL_ORG_ID` and `VERCEL_DASHBOARD_PROJECT_ID`, then runs `npx vercel --prod` [@deploy-script]. The old deployment guide says the project auto-deploys to Vercel and asks for Vercel GitHub secrets [@old-deployment-guide]. The root `vercel.json` points the output directory at `docs` and rewrites component pages to old static HTML routes, which does not match the current Astro dashboard runtime [@vercel-config] [@astro-config].

The safe interpretation is chronological: Cloudflare Pages is current, and Vercel-oriented files are historical residue or compatibility leftovers. When deployment behavior disagrees, prefer `CLAUDE.md`, `.claude/rules/dashboard.md`, `dashboard/astro.config.mjs`, and `dashboard/wrangler.toml` over the Vercel script and guide [@claude-runtime] [@dashboard-rule] [@astro-config] [@wrangler-config] [@deploy-script] [@old-deployment-guide].
