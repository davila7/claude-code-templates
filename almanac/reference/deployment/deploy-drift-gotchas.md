---
title: "Deploy Drift Gotchas"
summary: "Deployment references disagree across Cloudflare Pages, Vercel, GitHub Actions, and static docs, so this page identifies which files to trust cautiously."
topics: [reference, deployment, dashboard]
sources:
  - id: coverage-entry
    type: file
    path: almanac/coverage-map.md
  - id: root-claude
    type: file
    path: CLAUDE.md
  - id: claude-backup
    type: file
    path: CLAUDE_BACKUP.md
  - id: dashboard-rule
    type: file
    path: .claude/rules/dashboard.md
  - id: deployer-agent
    type: file
    path: .claude/agents/deployer.md
  - id: deploy-script
    type: file
    path: scripts/deploy.sh
  - id: predeploy-check
    type: file
    path: scripts/predeploy-check.sh
  - id: vercel-config
    type: file
    path: vercel.json
  - id: old-deployment-guide
    type: file
    path: docs/guides/deployment.md
  - id: docs-api-readme
    type: file
    path: docs/api/README.md
---

# Deploy Drift Gotchas

Deployment documentation in this repository is split across current Cloudflare Pages guidance and older Vercel-oriented artifacts. The coverage map assigns this page to the drift future agents must resolve before trusting Vercel, GitHub Pages, Cloudflare Pages, or Wrangler instructions; the safest starting point is to treat `CLAUDE.md` and `.claude/rules/dashboard.md` as newer Cloudflare guidance, then inspect older Vercel files as drift evidence [@coverage-entry] [@root-claude] [@dashboard-rule].

## Current Cloudflare Signal

`CLAUDE.md` says the dashboard and API routes deploy on Cloudflare Pages, with cron and monitoring tasks running separately as Cloudflare Workers [@root-claude]. It also says dashboard changes pushed to `main` deploy automatically through GitHub Actions, while manual deployment uses `wrangler pages deploy`, not Vercel [@root-claude].

The dashboard rule is even stricter for dashboard work. It names Astro 5, server output, the Cloudflare Pages adapter, `dashboard/wrangler.toml`, and separate cron jobs under `cloudflare-workers/crons/`, then says deployments are hosted on Cloudflare Pages and `vercel.json` should not be recreated after migration [@dashboard-rule].

## Vercel Artifacts Still Exist

The root package still has `dev` and `start` scripts that run `vercel dev`, and its deploy scripts call `./scripts/deploy.sh` [@deploy-script]. `scripts/deploy.sh` requires `VERCEL_ORG_ID` and `VERCEL_DASHBOARD_PROJECT_ID`, then runs `npx vercel --prod --yes --cwd "$REPO_ROOT"` [@deploy-script].

`scripts/predeploy-check.sh` is useful as a test runner but stale as deploy advice. It installs root and API dependencies, runs `npm run test:api` under `api/`, checks critical endpoint files, validates `.env.example`, validates `vercel.json`, checks for the Vercel CLI, and finishes by telling the user to deploy with `vercel --prod` [@predeploy-check].

The root `vercel.json` still points `outputDirectory` to `docs`, adds CORS headers for `components.json` and `trending-data.json`, and rewrites component and plugin routes to static HTML files [@vercel-config]. That does not describe the current Astro server-rendered dashboard path documented in the Cloudflare guidance [@root-claude] [@dashboard-rule].

## Older Written Guidance

`CLAUDE_BACKUP.md` preserves an older project overview that calls the API endpoints Vercel endpoints and says deployment uses `vercel --prod` [@claude-backup]. It also describes `/api/claude-code-check` as a Vercel Cron target, while the current root guidance says it is triggered by the `cloudflare-workers/crons` Worker [@claude-backup] [@root-claude].

The old deployment guide says the project is configured for automatic deployment to Vercel from `main`, asks for Vercel GitHub secrets, and documents manual `vercel` and `vercel --prod` commands [@old-deployment-guide]. The docs API README also assumes Vercel's root `/api/` serverless-functions behavior and `outputDirectory: "docs"` static-file behavior [@docs-api-readme].

## Deployer Agent Conflict

The `deployer` agent file is internally Vercel-oriented. It says deployments happen automatically through `.github/workflows/deploy.yml` on push to `main`, tells agents not to run manual Vercel commands, but then describes a single Vercel project, Vercel secrets, Vercel troubleshooting, and Vercel rollback commands [@deployer-agent].

Use that agent text cautiously. Its "do not run manual Vercel deploys" warning agrees with the idea that push-based automation should own production deploys, but its platform details conflict with the current Cloudflare Pages guidance [@deployer-agent] [@root-claude] [@dashboard-rule].

## Practical Trust Order

When deployment sources disagree, prefer `CLAUDE.md`, `.claude/rules/dashboard.md`, dashboard Cloudflare configuration, and Cloudflare Worker docs over `CLAUDE_BACKUP.md`, `docs/guides/deployment.md`, `docs/api/README.md`, `scripts/deploy.sh`, `scripts/predeploy-check.sh`, and `vercel.json` [@root-claude] [@dashboard-rule] [@claude-backup] [@old-deployment-guide] [@docs-api-readme] [@deploy-script] [@predeploy-check] [@vercel-config].

Keep the stale files as diagnostic clues rather than instructions. They explain why Vercel variables, Vercel rewrites, and Vercel rollback commands may appear in the repository, but they should not override the Cloudflare runtime page or the current dashboard rule when planning production changes [@root-claude] [@dashboard-rule] [@vercel-config] [@deploy-script].

For the current runtime, read [Cloudflare Dashboard Runtime](../../architecture/deployment/cloudflare-dashboard-runtime), follow [Deploy Dashboard and Workers](../../guides/deployment/deploy-dashboard-and-workers), and use [Cloudflare over Vercel Runtime](../../decisions/deployment/cloudflare-over-vercel-runtime) for the migration decision and its consequences [@coverage-entry].
