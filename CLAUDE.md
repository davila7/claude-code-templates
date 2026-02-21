# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Node.js CLI tool for managing Claude Code components (agents, commands, MCPs, hooks, settings) with a static website for browsing and installing components. The project includes Vercel API endpoints for download tracking and Discord integration.

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
vercel --prod                  # Deploy to production
```

## Security Guidelines

### ⛔ CRITICAL: NEVER Hardcode Secrets or IDs

**NEVER write API keys, tokens, passwords, project IDs, org IDs, or any identifier in code.** This includes Vercel project/org IDs, Supabase URLs, Discord IDs, database connection strings, and any other infrastructure identifier. ALL must go in `.env`.

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
vercel --prod
```

**npm Publishing Notes:**
- Classic npm tokens were revoked Dec 2025. Use **granular access tokens** from [npmjs.com/settings/~/tokens](https://www.npmjs.com/settings/~/tokens)
- The token must have **Read and Write** permissions for `claude-code-templates` and **"Bypass 2FA"** enabled
- Always remove the token from npm config after publishing (`npm config delete`)
- The local `package.json` version may drift from npm if published from CI — always check `npm view claude-code-templates version` first
- Never hardcode or commit tokens

## API Architecture

### Critical Endpoints

The `/api` directory contains Vercel Serverless Functions:

**`/api/track-download-supabase`** (CRITICAL)
- Tracks component downloads for analytics
- Used by CLI on every installation
- Database: Supabase (component_downloads table)

**`/api/discord/interactions`**
- Discord bot slash commands
- Features: /search, /info, /install, /popular

**`/api/claude-code-check`**
- Monitors Claude Code releases
- Vercel Cron: every 30 minutes
- Database: Neon (claude_code_versions, claude_code_changes, discord_notifications_log, monitoring_metadata tables)

### Deployment Workflow

**ALWAYS test before deploying:**

```bash
# 1. Run API tests
cd api
npm test

# 2. If tests pass, deploy
cd ..
vercel --prod

# 3. Monitor logs
vercel logs aitmpl.com --follow
```

### Environment Variables (Vercel)

```bash
# Supabase
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

### Emergency Rollback

```bash
vercel ls                              # List deployments
vercel promote <previous-deployment>   # Rollback
```

## Cloudflare Workers

The `cloudflare-workers/` directory contains Cloudflare Worker projects that run independently from Vercel.

### docs-monitor

Monitors https://code.claude.com/docs for changes every hour and sends Telegram notifications.

```bash
cd cloudflare-workers/docs-monitor
npm run dev          # Local dev
npx wrangler deploy  # Deploy
```

### pulse (Weekly KPI Report)

Collects metrics from GitHub, Discord, Supabase, Vercel, and Google Analytics every Sunday at 14:00 UTC and sends a consolidated report via Telegram.

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
VERCEL_TOKEN                # Vercel personal access token (optional)
VERCEL_PROJECT_ID           # Vercel project ID (optional)
TRIGGER_SECRET              # For manual /trigger endpoint
GA_PROPERTY_ID              # GA4 property ID (optional)
GA_SERVICE_ACCOUNT_JSON     # Base64 service account (optional)
```

**Graceful degradation:** Each source catches its own errors. Missing secrets or API failures show `⚠️ Unavailable` instead of crashing the report.

## Dashboard (app.aitmpl.com)

Astro + React + Tailwind dashboard deployed at `https://app.aitmpl.com`. Clerk auth for user collections. Source lives in `dashboard/`.

### Architecture

- **Framework**: Astro 5 with React islands, Tailwind v4, `output: 'server'`
- **Auth**: Clerk (`window.Clerk` global, no ClerkProvider per island)
- **Data**: Fetches from `https://www.aitmpl.com/components.json` at runtime (NOT bundled)
- **API proxy**: `dashboard/src/pages/api/[...path].ts` proxies to `localhost:3000` in dev, `https://www.aitmpl.com` in prod

### Vercel Project Setup

Two separate Vercel projects deploy from the same repo:

| Project | Domain | Root Directory |
|---------|--------|----------------|
| `aitmpl` | `www.aitmpl.com` | `/` (root) |
| `aitmpl-dashboard` | `app.aitmpl.com` | `dashboard` |

Each directory has its own `.vercel/project.json` with the correct project ID. Do NOT mix them up.

### Deployment

**ALWAYS use the deployer agent (`.claude/agents/deployer.md`) for all deployments.** It runs pre-deploy checks (auth, git status, API tests) and handles the full pipeline safely. Never deploy manually.

```bash
npm run deploy:site        # Deploy www.aitmpl.com (main site + API)
npm run deploy:dashboard   # Deploy app.aitmpl.com (Astro dashboard)
npm run deploy:all         # Deploy both
```

**CI/CD**: Pushes to `main` auto-deploy via GitHub Actions (`.github/workflows/deploy.yml`):
- Changes in `docs/`, `api/`, or `vercel.json` trigger site deploy
- Changes in `dashboard/` trigger dashboard deploy

**Required GitHub Secrets** (Settings > Secrets > Actions):
- `VERCEL_TOKEN` — Vercel personal access token
- `VERCEL_ORG_ID` — Vercel org/team ID
- `VERCEL_SITE_PROJECT_ID` — Project ID for www.aitmpl.com
- `VERCEL_DASHBOARD_PROJECT_ID` — Project ID for app.aitmpl.com

### Dashboard Environment Variables (Vercel)

```bash
PUBLIC_CLERK_PUBLISHABLE_KEY=xxx           # Clerk public key
CLERK_SECRET_KEY=xxx                        # Clerk secret key
PUBLIC_COMPONENTS_JSON_URL=https://www.aitmpl.com/components.json  # MUST use www
```

### Known Issues & Solutions

**Node v24 breaks `fs.writeFileSync` on Vercel**
- Node v24 has a bug with `writeFileSync` in Vercel's build environment
- Solution: Dashboard project is pinned to Node 22.x (set via Vercel API/dashboard)

**CORS: Always use `www.aitmpl.com` for cross-origin fetches**
- `aitmpl.com` (bare domain) 307-redirects to `www.aitmpl.com`
- The redirect response has NO CORS headers, which blocks browser fetches from `app.aitmpl.com`
- `www.aitmpl.com` serves the actual response WITH `Access-Control-Allow-Origin: *`
- The `PUBLIC_COMPONENTS_JSON_URL` env var MUST point to `https://www.aitmpl.com/...` (not `https://aitmpl.com/...`)
- CORS headers are configured in the root `vercel.json` under `headers`

### Local Development

```bash
cd dashboard
npm install
npx astro dev --port 4321   # Dashboard at http://localhost:4321
# In another terminal, for API proxy:
node api/dev-server.js       # API at http://localhost:3000
```

## Website Architecture (docs/)

Static website at https://aitmpl.com for browsing components.

### Key Files

- `docs/components.json` - Component catalog (generated, ~2MB)
- `docs/index.html` - Main component browser
- `docs/blog/` - Blog articles
- `docs/js/` - Vanilla JavaScript (data-loader, search, cart)

### Data Flow

1. `scripts/generate_components_json.py` scans `cli-tool/components/`
2. Generates `docs/components.json` with embedded content
3. Website loads JSON and renders component cards
4. Download tracking via `/api/track-download-supabase`

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
cd api && npm test      # Test API endpoints
```

Aim for 70%+ test coverage. Test critical paths and error handling.

## Common Issues

**API endpoint returns 404 after deploy**
- Serverless functions must be in `/api/` directory
- Use format: `/api/function-name.js` or `/api/folder/index.js`

**Download tracking not working**
- Check Vercel logs: `vercel logs aitmpl.com --follow`
- Verify environment variables in Vercel dashboard
- Test endpoint manually with curl

**Components not updating on website**
- Run `python scripts/generate_components_json.py`
- Clear browser cache
- Check `docs/components.json` file size

## Important Notes

- **Component catalog**: Always regenerate after adding/modifying components
- **API tests**: Required before production deploy (breaks download tracking)
- **Secrets**: Never commit API keys (use environment variables)
- **Paths**: Use relative paths for all project files
- **Backwards compatibility**: Don't break existing component installations
