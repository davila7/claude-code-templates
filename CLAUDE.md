# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Node.js CLI tool for managing Claude Code components (agents, commands, MCPs, hooks, settings) with a static website for browsing and installing components. The dashboard and its API routes are deployed on Cloudflare Pages, with supporting cron and monitoring tasks running as Cloudflare Workers.

## Essential Commands

```bash
# Development
npm install                    # Install dependencies
npm test                       # Run tests
npm version patch|minor|major  # Bump version
npm publish                    # Publish to npm

# Component catalog
python scripts/generate_components_json.py  # Update docs/components.json

# Dashboard + API (Astro on Cloudflare Pages)
cd dashboard && npm run build  # Build before deploy
npm run deploy                 # Deploy www + app.aitmpl.com via wrangler
```

> Deploys to production happen automatically via GitHub Actions on push to `main`
> (changes in `dashboard/**`). Manual deploy uses `wrangler pages deploy`, not Vercel.

## Security Guidelines

### ⛔ CRITICAL: NEVER Hardcode Secrets or IDs

**NEVER write API keys, tokens, passwords, project IDs, org IDs, or any identifier in code.** This includes Cloudflare account/project IDs, Supabase URLs, Discord IDs, database connection strings, and any other infrastructure identifier. ALL must go in `.env` (or Cloudflare secrets via `wrangler secret put`).

```javascript
// ❌ WRONG
const API_KEY = "AIzaSy...";

// ✅ CORRECT
const API_KEY = process.env.GOOGLE_API_KEY;
```

**When creating scripts with API keys:**
1. Use `process.env` (Node.js) or `os.environ.get()` (Python)
2. Load from `.env` file using `dotenv`
3. Add variable to `.env.example` with placeholder
4. Verify `.env` is in `.gitignore`

**If you accidentally commit a secret:**
1. Revoke the key IMMEDIATELY
2. Generate new key
3. Update `.env`
4. Old key is compromised forever (git history)

## Component System

### Component Types

**Agents** (600+) - AI specialists for development tasks
**Commands** (200+) - Custom slash commands for workflows
**MCPs** (55+) - External service integrations
**Settings** (60+) - Claude Code configuration files
**Hooks** (39+) - Automation triggers
**Loops** (18+) - Autonomous agentic workflows (goal + interval + stop condition) that reference other components
**Templates** (14+) - Complete project configurations

### Installation Patterns

```bash
# Single component
npx claude-code-templates@latest --agent frontend-developer
npx claude-code-templates@latest --command setup-testing
npx claude-code-templates@latest --hook automation/simple-notifications
npx claude-code-templates@latest --loop engineering/docs-sweep-loop  # also installs the loop's referenced components

# Batch installation
npx claude-code-templates@latest --agent security-auditor --command security-audit --setting read-only-mode

# Interactive mode
npx claude-code-templates@latest
```

### Component Development

#### Adding New Components

**CRITICAL: Use the component-reviewer agent for ALL component changes**

When adding or modifying components, you MUST use the `component-reviewer` subagent to validate the component before committing:

```
Use the component-reviewer agent to review [component-path]
```

**Component Creation Workflow:**

1. Create component file in `cli-tool/components/{type}/{category}/{name}.md`
2. Use descriptive hyphenated names (kebab-case)
3. Include clear descriptions and usage examples
4. **REVIEW with component-reviewer agent** (validates format, security, naming)
5. Fix any issues identified by the reviewer
6. Run `python scripts/generate_components_json.py` to update catalog

**The component-reviewer agent checks:**
- ✅ Valid YAML frontmatter and required fields
- ✅ Proper kebab-case naming conventions
- ✅ No hardcoded secrets (API keys, tokens, passwords)
- ✅ Relative paths only (no absolute paths)
- ✅ Supporting files exist (for hooks with scripts)
- ✅ Clear, specific descriptions
- ✅ Correct category placement
- ✅ Security best practices

**Example Usage:**
```
# After creating a new agent
Use the component-reviewer agent to review cli-tool/components/agents/development-team/react-expert.md

# Before committing hook changes
Use the component-reviewer agent to review cli-tool/components/hooks/git/prevent-force-push.json

# For PR reviews with multiple components
Use the component-reviewer agent to review all modified components in cli-tool/components/
```

The agent will provide prioritized feedback:
- **❌ Critical Issues**: Must fix before merge (security, missing fields)
- **⚠️ Warnings**: Should fix (clarity, best practices)
- **📋 Suggestions**: Nice to have improvements

#### Skill Security Scanning (SkillSpector)

Skills under `cli-tool/components/skills/**` are scanned for security
vulnerabilities by [SkillSpector](https://github.com/NVIDIA/skillspector)
(NVIDIA, Apache-2.0) — a static analyzer with 64 vulnerability patterns
(prompt injection, data exfiltration, supply chain, dangerous code/AST, taint
tracking, YARA signatures, etc.). It runs in static-only mode (`--no-llm`), so
no API key or secret is required.

Two GitHub Actions drive it, both via the batch orchestrator
`scripts/skillspector_scan.py`:

- **`.github/workflows/skill-security-scan.yml`** (PR) — scans only the skills
  changed in the PR (`git diff`), posts an idempotent report comment, and
  **blocks** the check if any changed skill scores HIGH/CRITICAL (risk score
  > 50). Uploads an aggregated SARIF to the Security tab.
- **`.github/workflows/skill-security-scan-all.yml`** (weekly + manual) — scans
  all skills, reports to the run summary and SARIF, and **never blocks**.

SkillSpector requires Python 3.12+ and is installed from NVIDIA's `main`
branch (`pip install git+https://github.com/NVIDIA/skillspector.git@main`); it
is not published to PyPI. Risk bands: 0-20 LOW, 21-50 MEDIUM, 51-80 HIGH,
81-100 CRITICAL.

#### Statuslines with Python Scripts

Statuslines can reference Python scripts that are auto-downloaded to `.claude/scripts/`:

```javascript
// In src/index.js:installIndividualSetting()
if (settingName.includes('statusline/')) {
  const pythonFileName = settingName.split('/')[1] + '.py';
  const pythonUrl = githubUrl.replace('.json', '.py');
  additionalFiles['.claude/scripts/' + pythonFileName] = {
    content: pythonContent,
    executable: true
  };
}
```

### Publishing Workflow

```bash
# 1. Update component catalog
python scripts/generate_components_json.py

# 2. Run tests
npm test

# 3. Check current npm version and align local version
npm view claude-code-templates version  # check latest on registry
# Edit package.json version to be one patch above the registry version

# 4. Commit version bump and push
git add package.json && git commit -m "chore: Bump version to X.Y.Z"
git push origin main

# 5. Publish to npm (requires granular access token with "Bypass 2FA" enabled)
npm config set //registry.npmjs.org/:_authToken=YOUR_GRANULAR_TOKEN
npm publish
npm config delete //registry.npmjs.org/:_authToken  # always clean up after

# 6. Tag the release
git tag vX.Y.Z && git push origin vX.Y.Z

# 7. Deploy website (dashboard on Cloudflare Pages)
# Automatic on push to main (GitHub Actions). Manual: from dashboard/ run `npm run deploy`
```

**npm Publishing Notes:**
- Classic npm tokens were revoked Dec 2025. Use **granular access tokens** from [npmjs.com/settings/~/tokens](https://www.npmjs.com/settings/~/tokens)
- The token must have **Read and Write** permissions for `claude-code-templates` and **"Bypass 2FA"** enabled
- Always remove the token from npm config after publishing (`npm config delete`)
- The local `package.json` version may drift from npm if published from CI — always check `npm view claude-code-templates version` first
- Never hardcode or commit tokens

## API Architecture

### Critical Endpoints

API endpoints live as Astro API routes in `dashboard/src/pages/api/`:

**`/api/track-download-supabase`** (CRITICAL)
- Tracks component downloads for analytics
- Used by CLI on every installation
- Database: Supabase (component_downloads table)

**`/api/discord/interactions`**
- Discord bot slash commands
- Features: /search, /info, /install, /popular

**`/api/claude-code-check`**
- Monitors Claude Code releases
- Triggered every 30 minutes by the `cloudflare-workers/crons` Worker (not a Vercel cron)
- Database: Neon (claude_code_versions, claude_code_changes, discord_notifications_log, monitoring_metadata tables)

### Shared API Libraries

- `dashboard/src/lib/api/cors.ts` — CORS headers, `corsResponse()`, `jsonResponse()`
- `dashboard/src/lib/api/neon.ts` — Neon client factory
- `dashboard/src/lib/api/auth.ts` — Clerk JWT verification
- `dashboard/src/lib/api/changelog-parser.ts` — Claude Code changelog parser

### Emergency Rollback

```bash
# List recent Pages deployments
npx wrangler pages deployment list --project-name=aitmpl-dashboard
# Roll back to a previous deployment
npx wrangler pages deployment rollback <deployment-id> --project-name=aitmpl-dashboard
```

## Cloudflare Workers

The `cloudflare-workers/` directory contains Cloudflare Worker projects that run independently from the dashboard Pages project.

### crons

Replaces the old Vercel cron jobs. On a schedule it calls the dashboard API endpoints (which stay on Cloudflare Pages) with a shared `TRIGGER_SECRET`.

- `*/30 * * * *` → `/api/claude-code-check` (monitors Claude Code npm releases)
- `0 * * * *` → `/api/health-check` (hourly; was every 15 min on Vercel, reduced to save invocations)

Errors and cron check-ins are reported to Sentry (`sentry.js`, DSN from the `aitmpl-workers` project — see Error Tracking below).

```bash
cd cloudflare-workers/crons
npm run dev          # Local dev
npx wrangler deploy  # Deploy
```

**Secrets (Cloudflare):** `DASHBOARD_URL` (e.g. `https://www.aitmpl.com`), `TRIGGER_SECRET`, `SENTRY_DSN` (optional).

### docs-monitor

Monitors https://code.claude.com/docs for changes every hour and sends Telegram notifications. Also reports errors to Sentry via `sentry.js` (complements, doesn't replace, the Telegram error alert).

```bash
cd cloudflare-workers/docs-monitor
npm run dev          # Local dev
npx wrangler deploy  # Deploy
```

### pulse (Weekly KPI Report)

Collects metrics from GitHub, Discord, Supabase, npm, and Google Analytics every Sunday at 14:00 UTC and sends a consolidated report via Telegram.

**Architecture:** Single `index.js` file (no npm dependencies at runtime). All source collectors, formatter, and Telegram sender in one file.

**Cron:** `0 14 * * 0` (Sundays 14:00 UTC / 11:00 AM Chile)

```bash
cd cloudflare-workers/pulse
npm run dev          # Local dev
npx wrangler deploy  # Deploy

# Manual trigger
curl -X POST https://pulse-weekly-report.SUBDOMAIN.workers.dev/trigger \
  -H "Authorization: Bearer $TRIGGER_SECRET"

# Test single source
curl -X POST "https://pulse-weekly-report.SUBDOMAIN.workers.dev/trigger?source=github" \
  -H "Authorization: Bearer $TRIGGER_SECRET"

# Dry run (no Telegram)
curl -X POST "https://pulse-weekly-report.SUBDOMAIN.workers.dev/trigger?send=false" \
  -H "Authorization: Bearer $TRIGGER_SECRET"
```

**Secrets (Cloudflare):**
```bash
TELEGRAM_BOT_TOKEN          # Shared with docs-monitor
TELEGRAM_CHAT_ID            # Shared with docs-monitor
GITHUB_TOKEN                # GitHub PAT (public_repo scope)
SUPABASE_URL                # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY   # Supabase service role key
DISCORD_BOT_TOKEN           # Discord bot token
DISCORD_GUILD_ID            # Discord server ID
TRIGGER_SECRET              # For manual /trigger endpoint
GA_PROPERTY_ID              # GA4 property ID (optional)
GA_SERVICE_ACCOUNT_JSON     # Base64 service account (optional)
```

**Graceful degradation:** Each source catches its own errors. Missing secrets or API failures show `⚠️ Unavailable` instead of crashing the report. Failed collectors are also reported to Sentry via `sentry.js` (see Error Tracking below). The Vercel collector was removed (2026-07) since the dashboard no longer deploys to Vercel.

## Error Tracking (Sentry)

Free-tier Sentry, added to close the gap where automated cron/worker failures
were previously invisible. No official `@sentry/*` SDK is used anywhere —
every surface has its own tiny dependency-free client that posts directly to
the Sentry envelope API via `fetch()`, matching this repo's zero-dependency
worker style and avoiding Cloudflare Pages SSR friction with `@sentry/astro`.

**Status as of 2026-07-04: all 3 projects live and verified end-to-end** (each
confirmed with a manual test event returning HTTP 200 from Sentry and
appearing in its Issues dashboard).

- ✅ **Cloudflare Workers** (Sentry project `aitmpl-workers`) — `SENTRY_DSN`
  secret set on all 3 workers (`aitmpl-crons`, `pulse-weekly-report`,
  `claude-docs-monitor`) via `wrangler secret put SENTRY_DSN`.
- ✅ **Dashboard** (Sentry project `aitmpl-dashboard`) — `SENTRY_DSN` set as a
  Cloudflare Pages secret (`wrangler pages secret put SENTRY_DSN
  --project-name=aitmpl-dashboard`). Wired into `captureApiError()` calls in
  `claude-code-check`, `health-check`, and the three `track-*` endpoints.
- ✅ **CLI** (Sentry project `aitmpl-cli`) — the DSN is public by design
  (send-only, not a secret) and ships **hardcoded as the default** in
  `cli-tool/src/error-reporting.js` (`DEFAULT_SENTRY_DSN`, overridable via
  `CCT_SENTRY_DSN` for testing against a different project). Reporting
  itself stays **opt-in**: requires the end user to set
  `CCT_ERROR_REPORTING=true`, and always defers to the existing
  `CCT_NO_TRACKING`/`CCT_NO_ANALYTICS`/`CI` opt-outs.

**Not yet configured (any surface):** Sentry alert rules to Discord/Telegram,
and Cron Monitors dashboards for the workers' scheduled check-ins (the
`checkIn()` calls already send `in_progress`/`ok`/`error` events — a Monitor
just needs to be created in the Sentry UI with matching slugs:
`claude-code-check`, `health-check`, `pulse-weekly-report`, `docs-monitor`).

**Files:** `cloudflare-workers/{crons,pulse,docs-monitor}/sentry.js` (workers),
`dashboard/src/lib/api/error-tracking.ts` (dashboard), `cli-tool/src/error-reporting.js` (CLI).

## Dashboard (www.aitmpl.com)

Astro + React + Tailwind dashboard serving both `www.aitmpl.com` and `app.aitmpl.com`. Clerk auth for user collections. Source lives in `dashboard/`. All API endpoints are Astro API routes in the same project.

### Architecture

- **Framework**: Astro 5 with React islands, Tailwind v4, `output: 'server'`, `@astrojs/cloudflare` adapter (`mode: 'directory'`)
- **Hosting**: Cloudflare Pages (project `aitmpl-dashboard`), SSR on Workers runtime
- **Auth**: Clerk (`window.Clerk` global, no ClerkProvider per island)
- **Data**: `components.json` and `trending-data.json` served from `dashboard/public/` (same-origin)
- **APIs**: All endpoints in `dashboard/src/pages/api/` (Astro API routes, no separate serverless project)

### Featured Pages (`/featured/[slug]`)

Featured partner integrations shown on the dashboard homepage. Two files to edit:

**`dashboard/src/lib/constants.ts`** — `FEATURED_ITEMS` array. Each entry has:
- `name`, `description`, `logo`, `url` (`/featured/slug`), `tag`, `tagColor`, `category`
- `ctaLabel`, `ctaUrl`, `websiteUrl`
- `installCommand` — shown in the sidebar Quick Install box
- `metadata` — key/value pairs shown in the Details sidebar (e.g. `Components: '8'`)
- `links` — sidebar links list

**`dashboard/src/pages/featured/[slug].astro`** — Content for each slug rendered via `{slug === 'brightdata' && (...)}` blocks. Each block contains the full HTML content for that partner page.

**When adding a skill to a featured page:**
1. Add a new card `<div class="flex gap-3 ...">` inside the Skills Layer section of the relevant `{slug === '...'}` block
2. Update `installCommand` in `constants.ts` to include the new skill
3. Increment `metadata.Components` count in `constants.ts`

Current featured slugs: `brightdata`, `neon-instagres`, `claudekit`, `braingrid`

### Cloudflare Pages Project Setup

A single Cloudflare Pages project (`aitmpl-dashboard`) serves all domains. Config lives in `dashboard/wrangler.toml`:

| Project | Domains | Root Directory | Build output |
|---------|---------|----------------|--------------|
| `aitmpl-dashboard` | `www.aitmpl.com`, `aitmpl.com` (redirect), `app.aitmpl.com` | `dashboard` | `dist` |

`wrangler.toml` sets `pages_build_output_dir = "./dist"`, `compatibility_flags = ["nodejs_compat"]`, and the `PUBLIC_*` build-time vars in `[vars]`. Secrets are set via the Cloudflare Dashboard or `wrangler pages secret put`.

### Deployment

**ALWAYS use the deployer agent (`.claude/agents/deployer.md`) for all deployments.** It runs pre-deploy checks (auth, git status, build) and handles the full pipeline safely. Never deploy manually.

```bash
npm run deploy             # Build + `wrangler pages deploy dist` for www + app.aitmpl.com
npm run deploy:dashboard   # Same as above
```

**CI/CD**: Pushes to `main` auto-deploy via GitHub Actions (`.github/workflows/deploy.yml`):
- Changes in `dashboard/**` trigger a build and `wrangler pages deploy dist --project-name=aitmpl-dashboard`

**Required GitHub Secrets** (Settings > Secrets > Actions):
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Pages edit permission
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

### Environment Variables (Cloudflare)

`PUBLIC_*` vars are build-time and live in `dashboard/wrangler.toml` `[vars]` (and are also passed to the GitHub Actions build step). Everything else is a Cloudflare secret (`wrangler pages secret put <NAME>` or the Pages dashboard):

```bash
# Clerk
PUBLIC_CLERK_PUBLISHABLE_KEY=xxx   # [vars] — build-time
CLERK_SECRET_KEY=xxx               # secret

# Data
PUBLIC_COMPONENTS_JSON_URL=/components.json   # [vars] — build-time

# GitHub OAuth
PUBLIC_GITHUB_CLIENT_ID=xxx        # [vars] — build-time
GITHUB_CLIENT_SECRET=xxx           # secret

# Supabase (download tracking)
SUPABASE_URL=https://xxx.supabase.co        # secret
SUPABASE_SERVICE_ROLE_KEY=xxx               # secret

# Neon Database
NEON_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require   # secret

# Discord
DISCORD_APP_ID=xxx                 # secret
DISCORD_BOT_TOKEN=xxx              # secret
DISCORD_PUBLIC_KEY=xxx             # secret
DISCORD_WEBHOOK_URL_CHANGELOG=https://discord.com/api/webhooks/xxx   # secret
```

### Known Issues & Solutions

**Node built-ins in SSR**
- The Cloudflare Workers runtime does not expose Node's `fs`/`path`/etc. by default. `astro.config.mjs` enables `nodejs_compat` (via `wrangler.toml`) and externalizes `node:fs`, `node:path`, `node:url`, `node:stream` in SSR. Avoid adding new hard dependencies on Node-only APIs in server code.

**`react-dom/server` on Cloudflare**
- `astro.config.mjs` aliases `react-dom/server` to `react-dom/server.node` and marks `react-dom` as `noExternal` at build time so React SSR works on the Workers runtime. Don't remove this alias.

### Local Development

```bash
cd dashboard
npm install
npx astro dev --port 4321   # Dashboard + APIs at http://localhost:4321
```

## Data Files

### Component Catalog

- `docs/components.json` — Full generated catalog (source of truth), keeps `content` and `security` fields (needed by the legacy static site)
- `dashboard/public/components.json` — Dashboard copy, **without** `content`/`security` (lighter payload; dashboard doesn't need them)
- `dashboard/public/counts.json` — Per-type counts only (e.g. `{"agents": 421, ...}`), used by the sidebar/plugins pages instead of loading the full catalog
- `dashboard/public/components/{type}.json` — One file per component type (agents.json, commands.json, etc.), loaded on demand by `ComponentGrid.tsx` for the active tab
- `dashboard/public/search-index.json` — Flat array for `SearchModal.tsx`
- `dashboard/public/component-content/{type}/{slug}.json` — Full per-component content (incl. markdown body), fetched on demand when a component's detail view or PR flow needs it
- `dashboard/public/trending-data.json` — Trending/download stats

All of the above are served as static Cloudflare Pages assets with
`cache-control: public, max-age=86400, stale-while-revalidate=3600` (see
`dashboard/public/_headers`).

### Data Flow

1. `scripts/generate_components_json.py` scans `cli-tool/components/`
2. Generates `docs/components.json` (full, with `content`/`security`) and the split dashboard artifacts (`dashboard/public/components.json`, `counts.json`, `components/{type}.json`, `search-index.json`, `component-content/{type}/{slug}.json`) — these two writes are decoupled, so the dashboard payload stays lean without touching the legacy catalog
3. Dashboard islands (`ComponentGrid.tsx`, `SearchModal.tsx`, `Sidebar.astro`, `SendToRepoModal.tsx`) load the split artifacts instead of the full catalog
4. Download tracking via `/api/track-download-supabase`

### Legacy Static Site (docs/)

The `docs/` directory contains the old static HTML site (no longer deployed to www). Blog articles in `docs/blog/` are still referenced externally.

### Blog Article Creation

Use the CLI skill to create blog articles:

```bash
/create-blog-article @cli-tool/components/{type}/{category}/{name}.json
```

This automatically:
1. Generates AI cover image
2. Creates HTML with SEO optimization
3. Updates `docs/blog/blog-articles.json`

## Code Standards

### Path Handling
- Use relative paths: `.claude/scripts/`, `.claude/hooks/`
- Never hardcode absolute paths or home directories
- Use `path.join()` for cross-platform compatibility

### Naming Conventions
- Files: `kebab-case.js`, `PascalCase.js` (for classes)
- Functions/Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Components: `hyphenated-names`

### Error Handling
- Use try/catch for async operations
- Provide helpful error messages
- Log errors with context
- Implement fallback mechanisms

## Testing

```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

Aim for 70%+ test coverage. Test critical paths and error handling.

## Common Issues

**API endpoint returns 404 after deploy**
- API routes must be in `dashboard/src/pages/api/` as Astro API routes
- Export named HTTP methods: `export const POST: APIRoute`, `export const GET: APIRoute`

**Download tracking not working**
- Check Cloudflare Pages logs: `npx wrangler pages deployment tail --project-name=aitmpl-dashboard`
- Verify environment variables / secrets in the Cloudflare Pages dashboard
- Test endpoint manually with curl

**Components not updating on website**
- Run `python scripts/generate_components_json.py` (writes both `docs/components.json` and the split `dashboard/public/` artifacts directly — no manual copy step)
- Deploy and clear browser cache (artifacts are cached 24h at the edge, see `dashboard/public/_headers`)

## Important Notes

- **Component catalog**: Always regenerate after adding/modifying components
- **API tests**: Required before production deploy (breaks download tracking)
- **Secrets**: Never commit API keys (use environment variables)
- **Paths**: Use relative paths for all project files
- **Backwards compatibility**: Don't break existing component installations
