# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed
- **The `cct` binary.** It only worked after a global install, and
  `npx cct` never ran it: npm downloads the unrelated `cct` package, owned by
  another account. Use `npx claude-code-templates@latest` (or, installed
  globally, `claude-code-templates`). Anyone who used `cct` from a global
  install must switch to one of those.

### Added
- **FLOSS/fund application** (#1359, #1361): `funding.json` (funding.json
  v1.1.0) at the repository root, with `.well-known/funding-manifest-urls` in
  the repository and served by aitmpl.com. Submitted to the FLOSS/fund
  directory on 2026-11-02 as an application for a 25,000 USD/year grant; both
  URLs show as verified in the
  [listing](https://dir.floss.fund/view/project/@github.com/davila7/claude-code-templates).

## [1.33.0] - Unreleased

### Changed
- **Mods download from aitmpl.com** (`--mod`): one request to
  `www.aitmpl.com/component-content/mods/{category}/{name}.json`, accepted only
  when its files match `meta.files` exactly (same paths, same sizes in bytes).
  The GitHub contents API, whose anonymous rate limit caused 85% of failed mod
  installs, is now the fallback, and its rate-limit error says so. The
  component-content shape is now a CLI contract (`cli-tool/src/component-content.js`).
- **Short names resolve** through Catalog API v1: `--agent frontend-developer`
  installs `development-team/frontend-developer` when exactly one agent has
  that name. A name that matches several or none installs nothing new and the
  summary prints `Did you mean:` commands (or a `--search` command) instead of
  repeating the failing one.
- **After an install** the CLI prints each installed component's page
  (`utm_source=cli&utm_medium=install`) and, for two or more, a `Stack:` line
  with the one command that installs them all. Plain lines in a fixed order, so
  an agent running the CLI can relay them.
- Help examples printed `cct --agent ...`; they now print
  `npx claude-code-templates@latest --agent ...`. The no-terminal help lists
  `--plugin` and `--search`.

### Added
- **`--search "<words>"`**: up to 5 components matching every word, ranked by
  text match (never by downloads), each with its page and install command.
  Counted as a `search` command event with the number of results, never the words.
- **System-folder guard**: refuses to install into `C:\Windows` (and anything
  under it) or the root of a drive, writes nothing, and says which folder to
  open instead. About 18% of failed installs were EPERM in
  `C:\Windows\System32`.

## [1.31.0] - 2026-11-02

Includes the changes prepared as 1.30.1 (#1334), which was never published to npm.

### Removed
- **CLI flags that saw little or no use** (0 to 65 runs each in the last 30
  days, against 16.8K npm downloads): `--plugins`, `--skills-manager`,
  `--command-stats`, `--hook-stats`, `--mcp-stats`, `--agents`,
  `--chats-mobile`, `--teams`, `--2025`, `--studio`, `--sandbox` (with
  `--e2b-api-key` and `--anthropic-api-key`), `--tunnel`, `--create-agent`,
  `--list-agents`, `--update-agent`, `--remove-agent` and `--clone-session`.
  Running one prints what replaced it (`/plugin`, `/hooks`, `/mcp`, the
  `ui/stack-viewer` mod, `--analytics`, `--chats`) and exits with code 1;
  `npx claude-code-templates@1.30.0 <flag>` still runs the old version, except
  for `--tunnel`. Global agents created with `--create-agent` keep working.
- The sandbox launchers are no longer in the npm package; they stay in
  `cli-tool/components/sandbox/`.
- Dependencies: `@supabase/supabase-js`, `axios`, `dotenv`, `qrcode`, `uuid`.

### Added
- **No arguments opens the catalog browser** (#1333): pick a type, search,
  select across types, then the usual plan table and install. Without a
  terminal it prints short usage text and exits 0.
- A setting's `.claude/themes/` files go to `~/.claude/themes/`, the only
  folder Claude Code reads custom themes from (#1338).

### Security
- `--analytics` and `--chats` listen on 127.0.0.1 only (they listened on every
  interface) and answer only requests addressed to `localhost` from their own
  page: a foreign `Host` (DNS rebinding) or `Origin` (another site) gets 403,
  including the `/ws` WebSocket handshake. `Access-Control-Allow-Origin: *` is
  gone.
- `--prompt` starts `claude` without a shell, so the prompt is one argument and
  never shell syntax.

### Fixed
- `--analytics` and `--chats` showed 0 conversations when `~/.claude` held a
  dangling symlink, which Claude Code itself leaves at `~/.claude/debug/latest`
  (#575, #621). The scan now reads only `~/.claude/projects`, skips entries it
  cannot read and follows each linked folder once; the project count no longer
  includes `debug/`, `todos/` and the other `~/.claude` folders.
- `--analytics` never received live updates: the page reopened its WebSocket
  on every status change, subscribed with a message the server ignored, and
  routed messages by a field the server did not send. It now keeps one
  connection and refreshes within a second of a conversation changing.
- `--chats` loaded an empty page since June (`WebSocketService is not
  defined`): its three scripts were deleted by the analytics UI build and are
  back, also in `analytics-ui/public/` so the next build keeps them.
- `--health-check` did not exit after the report: its connectivity check left
  the connection to api.anthropic.com open. Without a terminal (CI, pipes,
  agents) it also waited forever on its setup question; it now prints the
  report and exits in under a second, without the 19 s of pauses between
  sections. `--check` and `--verify` were rejected as unknown
  options and work again. The placeholder "MCP Hooks: not implemented" warning
  no longer lowers the score.
- `--prompt` split the prompt into words (and failed on quotes), and without a
  terminal waited on its confirmation; it now prints the `claude` command to
  run instead. The template review prompt (`--template`) used `sh -c`, which
  does not exist on Windows.
- A dashboard whose port is taken reports it instead of crashing.
- Usage tracking: `--analytics` and `--health-check` were also sent to the
  download counter, which rejected them; `--workflow` runs and removed flags
  are now counted as commands, and the dashboard API accepts installation
  outcomes for mods and loops (until now always rejected). Tracking calls
  return their request so a caller can wait for it before exiting.

## [1.30.0] - 2026-10-10

### Changed
- **Redesigned multi-component install output** (`--agent x --hook y ...`): a
  step rail with a plan table (per-type icons, what each component writes), a
  location prompt that shows each settings file, one row per component that
  turns from a spinner into ✔/✖ with the files written or the failure reason,
  and a summary with a retry command for failures. Plain lines without a TTY
  or in CI. The installers' internal logs and the zero-count type list are gone.

### Fixed
- The banner's right border was misaligned.

## [1.29.7] - 2026-10-09

### Security
- **Fix command injection in the analytics Console Bridge** (port 3334) —
  GHSA-4jm9-m3fr-9jpx, reported by @manus-pi. Affected 1.11.0 through
  1.29.6. Terminal input is spawned with argv and passed through the
  environment instead of interpolated into `expect`/`osascript` source, the
  macOS `do script` fallback is removed, and the WebSocket handshake now
  requires a loopback peer, the local dashboard origin and a per-process token.
- **Same class, found by the follow-up audit**: `--health-check`,
  `--command-stats`, `--hook-stats`, `--mcp-stats`, global agent wrappers and
  `--clone-session` no longer pass text from project files, downloaded
  components or arguments through a shell. The Claude API proxy (port 3335)
  binds to loopback and refuses browser and non-loopback requests. A setting
  component can only write files under `.claude/`.

### Changed
- Mods: removed the early-access warning and the
  `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` instruction; Claude Code 2.1.287+ loads
  mods by default.

## [1.29.4] - 2026-07-13

### Security
- **Fix unauthenticated OS command injection / RCE in Claude Code Studio
  (`--studio`)** — GHSA-79wm-x847-7cvg (CWE-78, CWE-306, CWE-352; CVSS 8.8).
  Reported by @spartan8806. The studio server
  (`cli-tool/src/sandbox-server.js`) bound to all interfaces, sent
  `Access-Control-Allow-Origin: *`, required no auth, and passed request-body
  fields into `child_process.spawn(..., { shell: true })`. Fixes:
  - Removed `shell: true` from all task/agent spawns so arguments stay discrete
    argv entries and shell metacharacters can no longer execute.
  - Added a strict allowlist (`^[A-Za-z0-9._/-]+$`) for the `agentName`/`agent`
    fields, rejected before reaching any child process.
  - Bound the server to loopback (`127.0.0.1`) instead of `0.0.0.0`, removing
    the LAN attack surface.
  - Restricted CORS to the local Studio UI origin and rejected cross-origin
    requests, closing the drive-by CSRF vector.
  - Resolved `npx`/`claude` via their `.cmd` shims on Windows so removing
    `shell: true` does not break agent installation on win32.

## Changes after 1.28.16 (not assigned to a release)

### Added
- X/Twitter scraper skill (#390)
- Git context controller skill (#380)
- Vercel Speed Insights integration with deployer agent updates
- Interview toolkit (6 components)
- Worktree-ghostty hook component
- Agirails agent payments skill (#358)
- Desktop notification hook on Stop event (#360)
- Garry's Mod addon code helper skill (#370)
- Manifest observability skill (#371)
- AI Maestro skill suite (6 skills for agent orchestration) (#373)
- Collections API endpoints with improved dashboard proxy
- Dashboard source code (app.aitmpl.com) — Astro + React + Tailwind
- Deploy scripts and CI/CD for dual Vercel projects (www + dashboard)
- Deployer agent for safe Vercel production deploys
- Beta dashboard banner on docs site
- FootballBin predictions MCP and skill (#369)
- Company-announcements settings component
- Spinner-tips-override settings component
- Design-to-code skill (#356)
- DevPlan MCP server (#362)
- 3 daily Discord bots (blog, general, community help) (#361)
- Telegram Bot Builder skill (#359)
- FastMCP 3.0 server development skill with 30 reference files
- 3 planning-first skills (FastAPI, Rust CLI, Playwright E2E)
- Daily component pick Discord notification workflow
- Monitoring points P1-P5 (installation outcomes, website events, API health)
- Neon database context statusline
- Component page redesign with GitHub PR-style tabs and Giscus comments (#351)
- GitHub Actions creator skill

### Changed
- Group My Components items by type in sidebar and right panel
- Docs link updated to docs.aitmpl.com
- Dashboard icons simplified and data loading streamlined
- GitHub Actions upgraded for Node 24 compatibility (#368)

### Fixed
- SEO: H1 tag, structured data, accessibility, and robots.txt sitemap URL (#383)
- Vercel Speed Insights script tag and localStorage quota handling
- Dangerous-command-blocker hook script path reference (#367)
- Trending page fetching data from production URL
- CORS headers for components.json and trending-data.json
- Dashboard prebuild hack removed, uses standard Astro public/ dir
- Forum channel thread_name for community help bot (#363)
- Daily component workflow rewritten using jq for JSON payload
- Neon statusline endpoint matching default branch
- Sidebar sticky position to clear header
- Security audit made non-blocking for deploys
- Missing js-yaml and qrcode dependencies added to package.json

### Security
- XSS vulnerabilities fixed in docs site and dashboard
- Hardcoded Vercel IDs removed from deploy scripts
- Security policy extended to prohibit all hardcoded IDs

## [1.28.16] - 2026-02-08

### Fixed
- Missing js-yaml dependency in package.json
- Missing qrcode dependency in package.json

### Changed
- npm publishing instructions updated with granular token workflow

## [1.28.14] - 2026-02-08

### Added
- Agent Teams Dashboard (`--teams`) for reviewing multi-agent collaboration sessions
- 119 agents migrated from VoltAgent/awesome-claude-code-subagents (#340)
- 21 skills migrated from OpenAI skills repository (#343)
- Telegram PR webhook hook for PR creation notifications (#342)
- Technical Debt Manager agent (#335)
- Blog article for Hackathon AI Strategist agent (#334)
- Blog article for Vercel Deployment Monitor statusline (#331)
- Cloudflare Workers: docs-monitor and pulse weekly KPI report
- 6 web quality skills migrated from addyosmani/web-quality-skills (#325)
- Friday deploy warning spinner
- ClaudeKit featured card on homepage (#320)
- Console.log cleaner for production branches (#310)
- Rootly Incident Responder agent (#315)
- 7 AI research skills migrated (#319)
- Claude Code PR tracking dashboard (#317)
- Neon Open Source Program partnership (#284)
- Security hooks secrets detection blog article (#311, #312)
- npm download metrics to pulse weekly report (#332)
- Secret scanner hook improvements with stdin JSON parsing and expanded patterns

### Changed
- Footer reorganized into columns with updated copyright year (#333)
- Vercel statusline updated with clickable deploy link
- Z.AI partnership removed from website and README (#339, #347)
- Blog standardization and .gitignore fixes (#341)

### Fixed
- X/Twitter preview images for Neon pages (#316)
- Social preview images and meta tags across all pages (#313)
- Neon install commands using comma-separated format
- Debug: removed 90 console.log statements from docs/js/

## [1.28.3] - 2025-11-15

### Added
- Skills Dashboard with progressive context loading visualization
- Plugin skills support in Skills Manager Dashboard
- Automatic port fallback for Skills Dashboard
- Growth Kit content marketing automation plugin (#129)
- ElevenLabs MCP (#125)
- GitHub Actions workflow for daily JSON data updates

### Changed
- `--skills` renamed to `--skills-manager` to avoid conflict with component installation
- Data processing limit increased from 200k to 1M records

### Fixed
- Windows Python command compatibility (#118)
- Generate scripts removed from gitignore for GitHub Actions

## [1.27.0] - 2025-11-02

### Added
- Docker Sandbox Provider for local Claude Code execution
- Command usage tracking system to Neon Database
- Comprehensive API testing and deployment documentation
- Claude Code changelog monitor with Discord notifications
- Session Analytics modal (Beta)

### Fixed
- Duplicate shutdown handlers and memory leaks in chats server
- gtag config moved to preset options for Docusaurus

## [1.26.0] - 2025-10-30

### Added
- Discord bot with Vercel Functions (`/search`, `/info`, `/install`, `/popular`)
- Clickable links in all Discord bot responses
- Command examples in download modal
- Context download feature (replacing session sharing)

### Changed
- Context file format updated to be Claude Code-friendly

### Fixed
- Resume command and project name in session sharing
- Category included in component URLs
- Code block formatting and URL improvements in search results
- Discord bot: ES module compatibility, dependency resolution
- GitHub Actions workflows optimized

## [1.25.0] - 2025-10-27

### Added
- Component browser website at aitmpl.com
- Download tracking via Supabase
- Component catalog generation (`docs/components.json`)
- Search, filtering, and batch installation in the CLI
- Blog system with terminal-themed articles

## Earlier Releases

For changes prior to v1.25.0, see the [commit history](https://github.com/davila7/claude-code-templates/commits/main).

[Unreleased]: https://github.com/davila7/claude-code-templates/compare/v1.31.0...HEAD
[1.28.16]: https://github.com/davila7/claude-code-templates/compare/v1.28.14...v1.28.16
[1.28.14]: https://github.com/davila7/claude-code-templates/compare/v1.28.3...v1.28.14
[1.28.3]: https://github.com/davila7/claude-code-templates/compare/v1.27.0...v1.28.3
[1.27.0]: https://github.com/davila7/claude-code-templates/compare/v1.26.0...v1.27.0
[1.26.0]: https://github.com/davila7/claude-code-templates/compare/v1.25.0...v1.26.0
[1.25.0]: https://github.com/davila7/claude-code-templates/releases/tag/v1.25.0
