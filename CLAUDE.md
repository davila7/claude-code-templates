# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Node.js CLI tool (`cli-tool/`) for managing Claude Code components (agents, commands, MCPs, hooks, settings) with a static website for browsing and installing components. The dashboard and its API routes are deployed on Cloudflare Pages, with supporting cron and monitoring tasks running as Cloudflare Workers.

`cli-rust/` is a Rust port of the CLI's install core (preview binary, releases tagged `cli-rust-v*`, CI `rust-ci.yml` / `build-rust-cli.yml`), kept at byte-for-byte install parity with the Node CLI; everything else is delegated to the Node CLI.

## Essential Commands

```bash
# Development
npm install                    # Install dependencies
npm test                       # Run tests
npm version X.Y.Z --ignore-scripts=false  # Sync, commit, and tag all package versions
npm run version:set -- X.Y.Z   # Sync versions without creating a commit or tag
npm publish --ignore-scripts=false  # Publish and run the trusted prepublish guard

# Component catalog
python scripts/generate_components_json.py                   # Update docs/components.json (pulls download counts from Supabase: minutes)
python scripts/generate_components_json.py --skip-downloads  # Same, keeping the counts already in the catalog: seconds

# Dashboard + API (Astro on Cloudflare Pages)
cd dashboard && npm test && npm run build                          # Unit tests + build (dashboard-ci.yml runs both on PRs)
cd dashboard && npx wrangler pages deploy dist --project-name=aitmpl-dashboard  # Manual deploy (what deploy.yml runs)
```

> Deploys to production happen automatically via GitHub Actions on push to `main`
> (changes in `dashboard/**`). Manual deploy uses `wrangler pages deploy`, not Vercel.
> The root `npm run deploy` / `deploy:dashboard` still call `scripts/deploy.sh`, which is a stale **Vercel** deploy: do not use them.

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

**Agents** (400+) - AI specialists for development tasks
**Commands** (280+) - Custom slash commands for workflows
**MCPs** (100+) - External service integrations
**Settings** (75+) - Claude Code configuration files
**Hooks** (60+) - Automation triggers
**Loops** (18+) - Autonomous agentic workflows (goal + interval + stop condition) that reference other components
**Mods** (45) - Claude Mods: plugins whose behaviour lives in a function-hooks module (`register(on, options)` hooking engine events as `($, e, next)` middleware). Anthropic's reference is [anthropics/claude-code/mods](https://github.com/anthropics/claude-code/tree/main/mods) (three built-in mods + `mods/types/claude-code.d.ts`); discussion in [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870). Mods are official and on by default in Claude Code >= 2.1.287 ([docs](https://code.claude.com/docs/en/plugins/mods/overview)); 2.1.287+ ignores `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`, builds 2.1.259–2.1.286 still need it set to `1`; the `$` API may change between releases. Each mod is a complete plugin directory in Anthropic's `mods/` layout: `cli-tool/components/mods/{category}/{name}/` with `.claude-plugin/plugin.json` (name, description, `userConfig` — options are read from user/managed settings `pluginConfigs[name].options`, never project settings), `hooks/hooks.json` (`modules`), any number of hooks-modules under `hooks/` (relative imports allowed), optional `commands/*.md` (slash commands the plugin ships; a `skill.prompt` hook may rewrite their prompt at run time), `types/`, `tests/`, and a `README.md` the site shows. The generator uses README.md as content and ships every text file in the per-component content file (`files`), so the site explorer and the send-to-repo flow have the whole plugin. `--mod` (alias `--function-hook`) downloads the directory recursively (like a skill) and writes it verbatim to `.claude/skills/{name}/`, which Claude Code auto-loads as `{name}@skills-dir` — **only in a trusted project** (see "Debugging a mod that seems silent" below). Third-party mods are vendored as-is with LICENSE + attribution (e.g. `games/cc-arcade`). **Every module must typecheck against `cli-tool/components/mods/types/claude-code.d.ts`** (`cd cli-tool/components/mods && npx -y -p typescript@5 tsc -p tsconfig.json`; CI runs it in `mods-typecheck.yml`). Rules from the engine: import types only from `'claude-code'`, spell `$` as `$.noun.event(...)` at the call site (never pass `$` to a helper), treat `e` as frozen, deny with `{ deny }` without calling `next` (returning `{}` is fail-open). When Anthropic bumps the API, regenerate the d.ts with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude -p "/plugin-types <dir>"` on a current Claude Code and re-run tsc (the header's first line names the writing version; currently 2.1.301; 2.1.278 added `prompt.attachment` — the per-attachment hook `jev-skill-suggestion` uses to withhold the `skill_listing` system-reminder — and 2.1.283 changed `$.model.complete` from a string and `$.model.fork` from `result | null` to `{ isAnswered, text, usage } | { isAnswered: false, reason }`). Note `/context`'s "Skills" row is estimated from the roster and does not reflect that hook; a mod can ship `commands/*.md` and rewrite their prompt in `skill.prompt` (that is how `/jev-skill-suggestion:setup` hides every skill as `user-invocable-only` while the mod injects the chosen `SKILL.md` itself). Typechecking against the d.ts does not prove an older engine draws a mod: Claude Code 2.1.287 skips the whole `ui.render` of a Button with Text children instead of a `label` string, and the Claude Desktop app may run an older bundled build than your terminal: `ultra-config` drew in a 2.1.301 terminal and stayed empty in Desktop with exactly that skip. Test a pane on the oldest supported engine too: `npm i @anthropic-ai/claude-code@2.1.287` in a scratch folder, then run its `claude plugin test {category}/{name}` from `cli-tool/components/mods`. The early-access banner and Beta badge were removed 2026-10-04 (mods are official). Old URLs (`/function-hooks`, `/component/function-hook/*`) redirect via `dashboard/public/_redirects`.
**Templates** (14+) - Complete project configurations
**Skills** (890+) - `SKILL.md` directories under `cli-tool/components/skills/{category}/{name}/` (`--skill`); scanned by SkillSpector (see below)
**Sandbox** (11) - Launchers that run Claude Code in E2B, Cloudflare or Docker sandboxes (`cli-tool/components/sandbox/`)

Current per-type counts: `dashboard/public/counts.json`.

#### Debugging a mod that seems silent (verified 2026-09-19 on Claude Code 2.1.278)

A mod that "produces no output" has, in order of likelihood, these causes — none of which is the mod's code. Check them before touching the module:

1. **The project is not trusted.** Claude Code adopts a plugin from a project's `.claude/skills/{name}/` only when `~/.claude.json` has `projects[<path>].hasTrustDialogAccepted: true`; an untrusted folder's `.claude/` is repository content and is not read at all (`plugin.scope==="project"` candidates are dropped and re-discovered "post-trust"). `claude -p` never shows the trust prompt, so a headless run in a fresh folder never loads a project mod. Fix: open `claude` interactively in the folder and accept the prompt, or pass `--plugin-dir .claude/skills/{name}` (explicit, loads as `{name}@inline`). `~/.claude/skills/{name}/` (user-level) always loads.
2. **You are looking in the wrong place.** `$.ui.log` appends a dim transcript line and writes to the debug log; `$.ui.status` pins a line under the prompt. In `claude -p` / the SDK there is no transcript and no status row: the lines are only in `~/.claude/debug/<session-id>.txt` (`.txt`, not `.log`; `latest` symlinks the newest) and reach an SDK host as `ui_log`. The header, statusline and effort box show the *session's* settings and never move: a mod rewrites `model`/`effort` per *request*. The other observable is `"effort":"…"` in the transcript JSONL under `~/.claude/projects/<slug>/`.
3. **Options under the wrong key.** `pluginConfigs` is keyed by the plugin's full id: `"{name}@skills-dir"` when auto-loaded, `"{name}"` with `--plugin-dir`. Under the wrong key every option is its default and the debug log says `plugin {name}: no pluginConfigs["{name}@skills-dir"].options in user, --settings or managed settings`.
4. **Function hooks off.** On Claude Code < 2.1.287 with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` unset/`0` the debug log says `installed plugins' hooks modules not loaded: rollout flag (tengu_plugin_hooks_modules) is off`. Built-in mods (`agents-md@builtin`) load regardless, so their presence proves nothing about ours.

The lines that settle each question in `claude --debug`: `Found N plugins`, `Read hooks.json for plugin {name}`, `hooks module {name}@skills-dir loaded (worker, environment N, tier user); events: …`, then `hooks module {name}@… <event> settled in Xms`. Positive control: `pacman@skills-dir` loads from `.claude/skills/` in the trusted `claude-code-templates` checkout. Anthropic documents only `claude --plugin-dir mods/<name>` for its reference mods; the `.claude/skills` auto-load is Claude Code 2.1.157+ (CHANGELOG: "Plugins in `.claude/skills` directories are now automatically loaded").

### Installation Patterns

```bash
# Single component
npx claude-code-templates@latest --agent frontend-developer
npx claude-code-templates@latest --command setup-testing
npx claude-code-templates@latest --hook automation/simple-notifications
npx claude-code-templates@latest --loop engineering/docs-sweep-loop  # also installs the loop's referenced components
npx claude-code-templates@latest --mod security/secret-redactor          # Claude Mod: plugin at .claude/skills/secret-redactor/

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
6. **TEST before generating/publishing**: ask the human in the session whether
   they want to test the newly created/modified component(s) first. Do NOT run
   `generate_components_json.py`, commit, or publish until testing is confirmed
   or explicitly skipped by the user.
7. Run `python scripts/generate_components_json.py` to update catalog
   (**maintainers only** — see below)

#### Generated catalog files: who regenerates them

`scripts/generate_components_json.py` writes `docs/components.json` and the
split `dashboard/public/` artifacts (`components.json`, `counts.json`,
`search-index.json`, `components/*.json`, `component-content/**`, `api/v1/**`). These files
are **generated output, never hand-edited**, and who commits them depends on
the workflow:

| Workflow | Regenerate + commit the catalog? |
|----------|----------------------------------|
| Maintainer working directly on this repo (local branch, sync PRs, agent-driven migrations) | ✅ Yes — run the script (`--skip-downloads` is enough for a content change) and commit the output with the component |
| **External contributor PR (fork)** | ❌ **No** — the PR must only contain files under `cli-tool/components/` (plus supporting files). The catalog is regenerated automatically after merge (`update-json-data.yml` daily cron, or a maintainer). |

Why: the generated JSON files are single-line blobs that change on every
component/download-count update, so two PRs that both commit them always
conflict. `.github/workflows/generated-files-guard.yml` fails any
non-maintainer PR that touches them and posts revert instructions; the
`component-pr-welcome.yml` bot also warns about it up front.

Two workflows regenerate them on `main`: `update-component-content.yml`
runs on every push that touches `cli-tool/components/**` with
`--skip-downloads` (content only, seconds) and then dispatches `deploy.yml`
(its own push uses `GITHUB_TOKEN`, which never triggers other workflows, so
without that the new catalog would not reach aitmpl.com), and `update-json-data.yml`
(daily cron) refreshes the download counts by pulling the whole
`component_downloads` table from Supabase (minutes) — that table has one
row per download, which is what makes a full run slow.

When reviewing a contributor PR that includes these files, ask them to revert
with `git checkout origin/main -- docs/components.json dashboard/public/` rather
than resolving the conflict by hand.

**Mods (`cli-tool/components/mods/`) are plugin directories, not `.md` files.** Creating one: `mods/{category}/{name}/` with `.claude-plugin/plugin.json`, `hooks/hooks.json`, the hooks-modules under `hooks/`, a `README.md`, optionally `commands/`, `types/` and `tests/`. Before review: `cd cli-tool/components/mods && npx -y -p typescript@5 tsc -p tsconfig.json` and `claude plugin validate cli-tool/components/mods/{category}/{name}`. The component-reviewer applies this checklist to a mod:
- ✅ `plugin.json` parses, has `name` (= directory name), `description`, `license`, and `author`/`repository` (attribution for vendored code)
- ✅ `hooks/hooks.json` has a non-empty `modules` list and every entry exists under `hooks/`
- ✅ Modules import types only from `'claude-code'`, use relative imports, spell `$` as `$.noun.event(...)`, never shadow `h` in a surface module
- ✅ Options are declared in `plugin.json` `userConfig` (string/number/boolean/directory/file; lists as comma-separated strings)
- ✅ Guards deny with `{ deny }` without calling `next`; `.catch` where fail-closed matters
- ✅ No secrets (keys only via options), no absolute paths, no `$.process.run` with a shell
- ✅ README states the command, controls/options, the minimum Claude Code version and (for `games/`) the attribution

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

#### Official validation (`claude plugin validate`)

`.github/workflows/component-validate.yml` runs Claude Code's own validator through
`scripts/validate_components.py` (it flattens the nested `{type}/{category}/` layout,
which the validator does not recurse into, and wraps hooks/MCPs one file at a time).
PRs validate only the components they change; the weekly run validates the whole
catalog. Both fail on errors: the catalog reached 0 errors on 2026-10-24. Run it
locally with `python3 scripts/validate_components.py [--changed FILE] [--strict]`.

#### External skills (code in another repo)

A skill can live in its author's GitHub repo instead of being copied here. Its
catalog folder `cli-tool/components/skills/{category}/{name}/` then holds only a
`source.json` (`repo`, `path`, `commit`, `license`, optional `author`,
`requires`, `include`), never a `SKILL.md`. `include` lists the files/folders
under `path` to keep (must list `SKILL.md`; size limits of 200 files / 5 MB apply
after filtering) for repos whose skill folder also holds demos or tests. First ones: the 9 `git/` skills from
`t3dotgg/tstack` (2026-10-26).

- `commit` must be a full 40-hex sha: never a branch or tag, so upstream changes
  reach users only through a PR here that bumps it (the weekly
  `external-skills-outdated.yml` keeps an issue listing newer upstream commits).
- The CLI (`cli-tool/src/external-skill.js`) reads `source.json` from `main`,
  lists the tree with one GitHub API call, downloads the files from
  raw.githubusercontent at that commit and checks each against its git blob sha.
  `requires` skills are installed too; downloads count under `skill` +
  `{category}/{name}` like any skill.
- Add one with `python scripts/external_skills.py add OWNER/REPO PATH CATEGORY
  [--requires a/b ...] [--author NAME]` (resolves HEAD, checks the license).
  `check` validates manifests (license allowlist + matches the repo's LICENSE at
  that commit; CI runs it in `component-validate.yml`).
- Everything that reads a skill folder (generator, SkillSpector catalog and PR
  scans, `validate_components.py`) calls `external_skills.local_dir()`, which
  fetches the commit with git into `.cache/external-skills/` (gitignored). The
  generator puts the files in the component's content file (`files`) so the
  site can show them, and `source` on the catalog entry (Catalog API v1.1.0).

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
- **`.github/workflows/component-skillspector-scan.yml`** (PR) — the other
  types (agents, commands, hooks, MCPs, settings, loops, sandboxes, mods)
  changed in the PR, via `scripts/skillspector_components_pr.py`, which reuses
  the catalog's staging (`skillspector_catalog.scan`) so the PR shows what the
  component page will. Comments only, **never blocks** (many false positives
  outside skills).

**Catalog traffic light (every component type).** `generate_components_json.py`
also runs SkillSpector on every component through `scripts/skillspector_catalog.py`
and stores a `skillspector` object (score, severity, recommendation, top 5
findings, version, file hash) on each entry of `components.json`. The dashboard
shows a neutral "Scanned by NVIDIA SkillSpector" seal on cards and component pages
(`SkillSpectorBadge.tsx`) and an informative report on the component page
(`SkillSpectorReport.tsx`, `#security-scan`). Daniel's call (2026-10-21): no
traffic light, no red, no severity labels or install verdicts. It is
display-only: never use it for ordering, search or ranking. Results are cached in the previous
`docs/components.json` by file hash + SkillSpector version, so a run only scans
new or changed components; bumping the pinned tag in `update-component-content.yml`
/ `update-json-data.yml` rescans everything (~1 h). Without the `skillspector`
CLI on PATH the previous results are kept. Agents, commands, hooks, MCPs and
settings are wrapped in a temporary SKILL.md (SkillSpector requires one), which
is why JSON components with a script get an "MCP Least Privilege / no tool scope"
finding. Flags: `--skip-skillspector`, `--skillspector-only TYPE/PATH ...`.

SkillSpector requires Python 3.12+ and is installed from NVIDIA's repo at a
pinned tag (`pip install git+https://github.com/NVIDIA/skillspector.git@v2.12.0`)
in every workflow, so PR scores match the catalog; it is not published to PyPI.
Bump the tag in all five workflows together. Risk bands: 0-20 LOW, 21-50 MEDIUM, 51-80 HIGH,
81-100 CRITICAL.

#### Statuslines with Python Scripts

Statuslines can reference Python scripts that are auto-downloaded to `.claude/scripts/`:

```javascript
// In cli-tool/src/index.js:installIndividualSetting() (simplified)
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

# 3. Check current npm version, then create the synchronized version commit and tag
npm view claude-code-templates version  # check latest on registry
npm version X.Y.Z --ignore-scripts=false  # X.Y.Z = one patch above the registry version
npm run check:version-sync

# 4. Push the version commit and tag created by npm version
git push origin main --follow-tags

# 5. Publish to npm (requires granular access token with "Bypass 2FA" enabled)
npm config set //registry.npmjs.org/:_authToken=YOUR_GRANULAR_TOKEN
npm publish --ignore-scripts=false
npm config delete //registry.npmjs.org/:_authToken  # always clean up after

# 6. Deploy website (dashboard on Cloudflare Pages)
# Automatic on push to main (GitHub Actions). Manual: from dashboard/ run `npx wrangler pages deploy dist --project-name=aitmpl-dashboard`
```

**npm Publishing Notes:**
- Classic npm tokens were revoked Dec 2025. Use **granular access tokens** from [npmjs.com/settings/~/tokens](https://www.npmjs.com/settings/~/tokens)
- The token must have **Read and Write** permissions for `claude-code-templates` and **"Bypass 2FA"** enabled
- Always remove the token from npm config after publishing (`npm config delete`)
- The repository disables lifecycle scripts by default for security. Pass `--ignore-scripts=false` only to the trusted release commands shown above so their version and prepublish hooks can run.
- The local `package.json` version may drift from npm if published from CI — always check `npm view claude-code-templates version` first
- Never hardcode or commit tokens

## API Architecture

### Critical Endpoints

API endpoints live as Astro API routes in `dashboard/src/pages/api/`:

**`/api/track-download-supabase`** (CRITICAL)
- Tracks component downloads for analytics
- Used by CLI on every installation
- Database: Supabase (component_downloads table)

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

### docs-monitor (DECOMMISSIONED 2026-07)

Monitored https://code.claude.com/docs hourly with Telegram notifications. **Deleted from Cloudflare** to free a cron-trigger slot for the newsletter worker (the account's free plan allows 5 cron triggers total). The code remains in `cloudflare-workers/docs-monitor/` and can be redeployed if a slot frees up (`npx wrangler deploy`).

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

### newsletter (Weekly Community Components Email) — PAUSED 2026-09-20

Composes and sends a simple weekly email via Resend featuring trending components (one Skill, Agent, MCP, Hook and Setting per send, in that fixed order). Selection is weighted-random by recent downloads and the copy (subject, catalog intro, per-component sentences, stats cited, closer) rotates from pools so no two emails read the same. Body is plain text plus a minimal HTML version (bold + underlined component titles, clickable component links). Data comes from the live `trending-data.json` + `components.json`.

**Delivery:** Resend **Broadcast** targeting the segment in `RESEND_SEGMENT_ID` — Resend injects the per-recipient unsubscribe link (`{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder in the body) and manages the suppression list automatically. Replies go to `NEWSLETTER_REPLY_TO`. The segment is the safety gate: point it at a pilot segment for tests or the full-audience segment for community-wide sends. Open/click tracking is enabled on the `aitmpl.com` domain with tracking subdomain `track.aitmpl.com` (metrics per broadcast at resend.com/broadcasts). **The weekly send is paused** (2026-09-20) because the emails were reading as spam; the worker stays deployed and only the automatic send is off. `wrangler.toml` has `crons = []` (was `0 16 * * SUN`, a slot freed by decommissioning docs-monitor) and `NEWSLETTER_ENABLED = "false"` makes `scheduled()` a no-op, so restoring the trigger alone does not resume sending. Repo edits do not reach production: no GitHub Action deploys this worker, so a pause or a resume only lands via `npx wrangler deploy` from `cloudflare-workers/newsletter/`. `GET /preview?format=text` composes without sending and `POST /trigger` sends (`?send=false` for dry run) — both still work while paused.

```bash
cd cloudflare-workers/newsletter
npm run dev          # Local dev
npx wrangler deploy  # Deploy

# Preview content without sending (repeat to see the copy rotate)
curl "https://aitmpl-newsletter.SUBDOMAIN.workers.dev/preview?format=text" \
  -H "Authorization: Bearer $TRIGGER_SECRET"

# Real send: creates + sends a Broadcast to the segment in RESEND_SEGMENT_ID
curl -X POST "https://aitmpl-newsletter.SUBDOMAIN.workers.dev/trigger" \
  -H "Authorization: Bearer $TRIGGER_SECRET"
```

**Secrets (Cloudflare):** `RESEND_API_KEY` (full access — broadcasts/segments), `RESEND_SEGMENT_ID`, `NEWSLETTER_REPLY_TO`, `TRIGGER_SECRET`, `SENTRY_DSN` (optional). Public vars in `wrangler.toml [vars]`: `DASHBOARD_URL`, `RESEND_FROM_EMAIL` (`daniel.avila@aitmpl.com`), `NEWSLETTER_ENABLED` (currently `"false"` — the kill switch described above).

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

Current featured slugs: `brightdata`, `claudekit`, `braingrid`

### Cloudflare Pages Project Setup

A single Cloudflare Pages project (`aitmpl-dashboard`) serves all domains. Config lives in `dashboard/wrangler.toml`:

| Project | Domains | Root Directory | Build output |
|---------|---------|----------------|--------------|
| `aitmpl-dashboard` | `www.aitmpl.com`, `aitmpl.com` (redirect), `app.aitmpl.com` | `dashboard` | `dist` |

`wrangler.toml` sets `pages_build_output_dir = "./dist"`, `compatibility_flags = ["nodejs_compat"]`, and the `PUBLIC_*` build-time vars in `[vars]`. Secrets are set via the Cloudflare Dashboard or `wrangler pages secret put`.

### Deployment

Deploying = merging to `main`. The deployer agent (`.claude/agents/deployer.md`) only verifies and troubleshoots deploy runs (its rollback section still describes Vercel). Manual deploy only when CI cannot: `cd dashboard && npm run build && npx wrangler pages deploy dist --project-name=aitmpl-dashboard`. Root `npm run deploy` is the stale Vercel script.

**CI/CD**: Pushes to `main` auto-deploy via GitHub Actions (`.github/workflows/deploy.yml`):
- Changes in `dashboard/**` trigger tests, a build and `wrangler pages deploy dist --project-name=aitmpl-dashboard`
- `prod-smoke-test.yml` then runs read-only checks of www.aitmpl.com and the published CLI (also daily)

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
- `dashboard/public/component-content/{type}/{slug}.json` — Full per-component content (incl. markdown body), fetched on demand when a component's detail view or PR flow needs it. Also carries `meta` for the GitHub-style component page: `files` (path, bytes, lines), `languages` (bytes), and `lastCommit` / `addedAt` read from one `git log` pass, which is why both catalog workflows check out full history (`fetch-depth: 0`, `filter: blob:none`); in a shallow clone the generator keeps each file's previous git fields
- `dashboard/public/trending-data.json` — Trending/download stats
- `dashboard/public/api/v1/` — **Catalog API v1, the public contract** (see below)

All of the above are served as static Cloudflare Pages assets. The catalog
files (`components.json`, `counts.json`, `components/*`, `search-index.json`,
`component-content/*`) use `max-age=300, stale-while-revalidate=3600`, so a
deploy reaches browsers within minutes; `trending-data.json` keeps 1 h (see
`dashboard/public/_headers`). With the old 24 h `max-age` a browser kept a
stale `components/{type}.json` for a day after a deploy while `counts.json`
was already new: the sidebar counted a component the grid could not find.

### Catalog API v1 (public contract)

Outside code reads the catalog (known: `profullstack/niche-db` reads
`docs/components.json` from raw.githubusercontent.com; our own
`mods/productivity/aitmpl` reads `components/{type}.json`, `counts.json` and
`trending-data.json` from www.aitmpl.com, and installed copies never update).
`/api/v1/` is the versioned surface for them: `catalog.json`,
`catalog/{type}.json`, `version.json` (sha256 for cheap polling) and
`schema.json`, written by `scripts/catalog_api_v1.py` (called at the end of
`generate_components_json.py`) from `scripts/catalog_api_v1.schema.json`.
Docs page `/developers/catalog-api`; audit and design in
`docs/catalog-api-formalization.md`.

- **Within v1, changes are additive only.** Removing or renaming a field,
  changing a type, the `id` format or a URL needs `/api/v2/` with v1 kept for 6
  months. Record every format change in `docs/catalog-api/CHANGELOG.md`.
- Adding a field: add it to the schema (`$defs.component`, also `required`),
  bump `SCHEMA_VERSION` minor, add a changelog entry. The writer refuses
  undeclared fields and validates every run (fatal in CI, where `jsonschema`
  is installed); `catalog-api-v1.yml` runs the tests on PRs.
- Never add sponsored/placement data to v1, and never order it by anything but `id`.
- `generatedAt` only moves when the components changed, so a no-op run stays byte-identical.
- The legacy files stay the site's own data, but treat their current shape as
  frozen in practice (installed `/aitmpl` mods read them), and do not delete
  `docs/components.json` in a legacy-site cleanup: niche-db reads it.

### Data Flow

1. `scripts/generate_components_json.py` scans `cli-tool/components/`
2. Generates `docs/components.json` (full, with `content`/`security`) and the split dashboard artifacts (`dashboard/public/components.json`, `counts.json`, `components/{type}.json`, `search-index.json`, `component-content/{type}/{slug}.json`) — these two writes are decoupled, so the dashboard payload stays lean without touching the legacy catalog — then the Catalog API v1 files under `dashboard/public/api/v1/`
3. Dashboard islands (`ComponentGrid.tsx`, `SearchModal.tsx`, `Sidebar.astro`, `SendToRepoModal.tsx`) load the split artifacts instead of the full catalog
4. `scripts/generate_trending_data.py` writes only `docs/trending-data.json`; `update-json-data.yml` copies it to `dashboard/public/trending-data.json`, which is the one `TrendingView.tsx` and the home counters actually fetch
5. Download tracking via `/api/track-download-supabase`

### Plugins & Marketplaces Catalog

- `scripts/generate_plugins_json.py` — scans the repos listed in `REPOS` via the `gh` CLI (needs `gh auth login`) and writes `dashboard/public/plugins.json`. This is a **manual, offline step** — it does not run during `npm run build` or CI/CD, so re-running it never affects deploy time.
- For each marketplace it records `plugins_list[].components` (counts per type) and `plugins_list[].components_items` (`{name, description}` per command/agent/skill/hook/mcp/lsp, description parsed from the item's frontmatter). The dashboard's `/plugins/[slug].astro` page renders this through `MarketplacePluginsList.tsx`, which shows a search box and a "view details" modal per plugin.
- **`max_local_scans = 50`** in `extract_marketplace_plugins_detail()` caps how many *locally-sourced* plugins (i.e. `source: "./plugins/..."` within the marketplace's own repo) get scanned for real component names/descriptions, per marketplace, to bound GitHub API calls. Plugins beyond that cap (or plugins hosted in an external repo, which are never scanned) fall back to showing only tag badges in the modal, with no itemized breakdown — this is a graceful degradation, not an error.
  - As of 2026-07-11, `anthropics/claude-plugins-official` alone has 51 locally-sourced plugins (out of 255 total), i.e. already at the edge of this cap. Bump `max_local_scans` if more complete coverage is needed — GitHub's rate limit (5000 req/hour authenticated) is not the constraint, wall-clock run time is (each item now costs 1 extra API call to fetch its file content for the description).

### Legacy Static Site (docs/)

The `docs/` directory contains the old static HTML site (no longer deployed to www). GitHub Pages still builds it from repository settings and publishes it at `davila7.github.io/claude-code-templates`; nothing in production depends on that, and every article canonicalises to `aitmpl.com`. Exception: `docs/components.json` is read by external code from raw.githubusercontent.com (see Catalog API v1), so keep generating it. Blog articles in `docs/blog/` are still referenced externally.

### Blog Article Creation

Use the CLI skill to create blog articles:

```bash
/create-blog-article @cli-tool/components/{type}/{category}/{name}.json
```

This automatically:
1. Generates AI cover image
2. Creates HTML with SEO optimization
3. Updates `docs/blog/blog-articles.json`

**The site serves `dashboard/public/blog/`, not `docs/blog/`.** The skill writes
only the `docs/` copy, so after creating an article you must mirror it across —
the article directory, its cover under `assets/`, and the new entry in
`blog-articles.json` — or it never appears on aitmpl.com. Three articles were
stranded this way before 2026-09-20. `daily-blog-discord.yml` (schedule paused 2026-10-26 with the other Discord workflows; `workflow_dispatch` only) picks from
`docs/blog/blog-articles.json` and links to `aitmpl.com/blog/<slug>/`, so an
unmirrored article is posted to Discord as a 404. Keep the two
`blog-articles.json` files identical.

## Rust CLI (`cli-rust/`): in backlog

Daniel's call (2026-10-28): the Rust port is in the backlog until he picks it up
again. Do not take it into account: no parity work, no mentions of it as a gap
or follow-up in PRs, plans or replies, and no changes to it, unless he asks.

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
npm test                                   # Root: only the version-sync check + its test
cd dashboard && npm test                   # Dashboard unit tests (dashboard-ci.yml on PRs)
cd cli-tool && npm test                    # CLI Jest suite (also test:watch, test:coverage); long red and not run in CI
cd cli-tool/components/mods && npx -y -p typescript@5 tsc -p tsconfig.json  # Mods typecheck (mods-typecheck.yml)
```

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
- Deploy, then wait up to 5 min or hard-reload (catalog JSON is browser-cached 5 min, see `dashboard/public/_headers`)

## Important Notes

- **Component catalog**: Always regenerate after adding/modifying components
- **API tests**: Required before production deploy (breaks download tracking)
- **Secrets**: Never commit API keys (use environment variables)
- **Paths**: Use relative paths for all project files
- **Backwards compatibility**: Don't break existing component installations
