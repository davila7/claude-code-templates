# CLAUDE.md

<!-- HUMAN TODO: once the site migration is complete, move API Architecture into a scoped .claude/rules/ file so it only loads in dashboard/ context -->

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Node.js CLI tool for managing Claude Code components (agents, commands, MCPs, hooks, settings) with a static website for browsing and installing components. The project includes Astro API routes (deployed on Cloudflare Pages) for download tracking and Discord integration.

## Essential Commands

```bash
# Development
npm install                    # Install dependencies
npm test                       # Run tests
npm version patch|minor|major  # Bump version
npm publish                    # Publish to npm

# Component catalog
python scripts/generate_components_json.py  # Update docs/components.json

# API testing
cd api && npm test             # Test API endpoints before deploy
npm run deploy                 # Deploy dashboard to Cloudflare Pages
```

## Security Guidelines

### ⛔ CRITICAL: NEVER Hardcode Secrets or IDs

**NEVER write API keys, tokens, passwords, project IDs, org IDs, or any identifier in code.** This includes Cloudflare account/project IDs, Supabase URLs, Discord IDs, database connection strings, and any other infrastructure identifier. ALL must go in `.env`.

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
**Templates** (14+) - Complete project configurations

### Installation Patterns

```bash
# Single component
npx claude-code-templates@latest --agent frontend-developer
npx claude-code-templates@latest --command setup-testing
npx claude-code-templates@latest --hook automation/simple-notifications

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

# 7. Deploy website
npm run deploy
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
- Triggered by the `aitmpl-crons` Cloudflare Worker (`cloudflare-workers/crons/`): every 30 minutes
- Database: Neon (claude_code_versions, claude_code_changes, discord_notifications_log, monitoring_metadata tables)

### Shared API Libraries

- `dashboard/src/lib/api/cors.ts` — CORS headers, `corsResponse()`, `jsonResponse()`
- `dashboard/src/lib/api/neon.ts` — Neon client factory
- `dashboard/src/lib/api/auth.ts` — Clerk JWT verification
- `dashboard/src/lib/api/changelog-parser.ts` — Claude Code changelog parser

### Emergency Rollback

```bash
npx wrangler pages deployment list --project-name=aitmpl-dashboard      # List deployments
npx wrangler pages deployment rollback <deployment-id> --project-name=aitmpl-dashboard  # Rollback
```

Or via the Cloudflare dashboard: Pages > `aitmpl-dashboard` > Deployments > select a previous deployment > Rollback.

## Cloudflare Workers

The `cloudflare-workers/` directory contains Cloudflare Worker projects that run independently from the dashboard Pages project.

### crons (Vercel Cron replacement)

Runs the cron-triggered endpoints that used to run on Vercel Cron.

- `/api/claude-code-check` — every 30 minutes (monitors Claude Code npm releases)
- `/api/health-check` — every hour (was every 15 min on Vercel, reduced to save invocations)

```bash
cd cloudflare-workers/crons
npx wrangler deploy  # Deploy
```

Secrets: `DASHBOARD_URL` (`https://www.aitmpl.com`), `TRIGGER_SECRET` (shared secret for authenticating internal cron calls).

### docs-monitor

Monitors https://code.claude.com/docs for changes every hour and sends Telegram notifications.

```bash
cd cloudflare-workers/docs-monitor
npm run dev          # Local dev
npx wrangler deploy  # Deploy
```

### pulse (Weekly KPI Report)

Collects metrics from GitHub, Discord, Supabase, npm, Cloudflare Pages, and Google Analytics every Sunday at 14:00 UTC and sends a consolidated report via Telegram.

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
CLOUDFLARE_API_TOKEN        # Cloudflare API token (Account > Pages > Read)
CLOUDFLARE_ACCOUNT_ID       # Cloudflare account ID
CLOUDFLARE_PAGES_PROJECT    # Cloudflare Pages project name (aitmpl-dashboard)
TRIGGER_SECRET              # For manual /trigger endpoint
GA_PROPERTY_ID              # GA4 property ID (optional)
GA_SERVICE_ACCOUNT_JSON     # Base64 service account (optional)
```

**Graceful degradation:** Each source catches its own errors. Missing secrets or API failures show `⚠️ Unavailable` instead of crashing the report.

## Dashboard (www.aitmpl.com)

Astro + React + Tailwind dashboard serving both `www.aitmpl.com` and `app.aitmpl.com`. Clerk auth for user collections. Source lives in `dashboard/`. All API endpoints are Astro API routes in the same project.

### Architecture

- **Framework**: Astro 5 with React islands, Tailwind v4, `output: 'server'`
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

Single Cloudflare Pages project serves all domains:

| Project | Domains | Root Directory |
|---------|---------|----------------|
| `aitmpl-dashboard` | `www.aitmpl.com`, `aitmpl.com` (redirect), `app.aitmpl.com` | `dashboard` |

The project no longer runs on Vercel — deployment is Cloudflare Pages via `wrangler`.

### Deployment

**ALWAYS use the deployer agent (`.claude/agents/deployer.md`) for all deployments.** It runs pre-deploy checks (auth, git status, API tests) and handles the full pipeline safely. Never deploy manually.

```bash
npm run deploy             # Deploy www + app.aitmpl.com
npm run deploy:dashboard   # Same as above
```

**CI/CD**: Pushes to `main` auto-deploy via GitHub Actions (`.github/workflows/deploy.yml`):
- Changes in `dashboard/**` trigger a build (`npm run build`) and `npx wrangler pages deploy dist --project-name=aitmpl-dashboard`

**Required GitHub Secrets** (Settings > Secrets > Actions):
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Pages edit permissions
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

### Environment Variables (Cloudflare Pages)

Plain-text `PUBLIC_*` build vars live in `dashboard/wrangler.toml` under `[vars]`. Everything else is a secret set via `wrangler secret put <KEY>` (or the Cloudflare dashboard):

```bash
# Clerk
PUBLIC_CLERK_PUBLISHABLE_KEY=xxx
CLERK_SECRET_KEY=xxx

# Data
PUBLIC_COMPONENTS_JSON_URL=/components.json

# GitHub OAuth
PUBLIC_GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# Supabase (download tracking)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Neon Database
NEON_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Discord
DISCORD_APP_ID=xxx
DISCORD_BOT_TOKEN=xxx
DISCORD_PUBLIC_KEY=xxx
DISCORD_WEBHOOK_URL_CHANGELOG=https://discord.com/api/webhooks/xxx
```

### Known Issues & Solutions

**Node v24 breaks `fs.writeFileSync` during build**
- Node v24 has a known `writeFileSync` bug that affects the build step
- Solution: `.github/workflows/deploy.yml` pins Node to 22.x via `actions/setup-node`

### Local Development

```bash
cd dashboard
npm install
npx astro dev --port 4321   # Dashboard + APIs at http://localhost:4321
```

## Data Files

### Component Catalog

- `docs/components.json` — Generated catalog (source of truth)
- `dashboard/public/components.json` — Copy served by the dashboard
- `dashboard/public/trending-data.json` — Trending/download stats

### Data Flow

1. `scripts/generate_components_json.py` scans `cli-tool/components/`
2. Generates `docs/components.json` with embedded content
3. Copy to `dashboard/public/components.json` for the dashboard to serve
4. Dashboard loads JSON and renders component cards
5. Download tracking via `/api/track-download-supabase`

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
- Verify environment variables/secrets in the Cloudflare dashboard
- Test endpoint manually with curl

**Components not updating on website**
- Run `python scripts/generate_components_json.py`
- Copy `docs/components.json` to `dashboard/public/components.json`
- Deploy and clear browser cache

## Important Notes

- **Component catalog**: Always regenerate after adding/modifying components
- **API tests**: Required before production deploy (breaks download tracking)
- **Secrets**: Never commit API keys (use environment variables)
- **Paths**: Use relative paths for all project files
- **Backwards compatibility**: Don't break existing component installations
