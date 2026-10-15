# Threat model

Read by Anthropic's OSS Scanner before it scans this repository. Reports go to the
`primary_contact` in the enrollment; do not open public issues for findings (see `SECURITY.md`).

## What this project does and where untrusted input enters

Claude Code Templates is a registry of Claude Code components (agents, commands, skills,
hooks, MCP server configs, settings, mods) and a CLI that installs them, published to npm as
`claude-code-templates` and run as `npx claude-code-templates@latest`. It runs on developer
machines with the user's full permissions, usually inside a project checkout.

Untrusted input enters through:

- **Component content.** The CLI downloads component files from this repository on GitHub
  and writes them into the user's project or `~/.claude/`. Component names, paths and file
  maps come from CLI arguments and from fetched JSON; treat both as attacker-controlled.
- **The working directory.** Any Claude Code configuration the CLI reads from the current
  directory (a repository the user has just cloned) is untrusted: `.claude/`, `.mcp.json`,
  `CLAUDE.md` and similar files.
- **CLI arguments** passed by scripts or copied from websites.
- **Local HTTP and WebSocket servers** the CLI starts for its dashboards (analytics, chats,
  plugins, skills, teams, sandbox). Assume other hosts on the network and other websites in
  the user's browser can reach them.
- **The public dashboard API** (`dashboard/src/pages/api/`, Astro routes on Cloudflare Pages,
  serving www.aitmpl.com). Every request body, query string and header is untrusted; some
  routes use Clerk auth, a shared trigger secret, or Discord request signatures.

## Components that matter most / least

Most important:

- `cli-tool/src/` and `cli-tool/bin/`: the npm CLI. Installation (`index.js`,
  `file-operations.js`), anything that spawns processes, and the local servers.
- `dashboard/src/pages/api/` and `dashboard/src/lib/api/`: internet-facing API routes.
- `cli-rust/`: the Rust port of the installer core (preview binary on GitHub Releases).

Less important but in scope:

- `cloudflare-workers/`: scheduled workers that call the dashboard API and third-party APIs.
- `scripts/` and `.github/workflows/`: catalog generation and CI. Workflow injection from
  pull request titles, branch names or bodies is in scope.
- Hook scripts and mod modules under `cli-tool/components/` that execute code on install
  targets.

Out of scope:

- The markdown text of agents, commands and skills under `cli-tool/components/`: it is
  prompt content reviewed by humans and SkillSpector, not code this project runs.
- `docs/` (legacy static site, not deployed to aitmpl.com) and generated JSON under
  `dashboard/public/` and `docs/`.
- Vendored third-party components (they keep their own LICENSE); report upstream unless our
  integration causes the issue.

## How to exercise it

- The CLI: `node cli-tool/bin/create-claude-config.js --help`, then for example
  `--agent <category>/<name>`, `--hook <category>/<name>`, `--setting <category>/<name>`,
  `--mcp <name>`, `--skill <name>`, `--health-check`, `--analytics`. Without network the
  installers cannot fetch components; tests in `cli-tool/tests/` stub that.
- Tests: `cd cli-tool && npx jest` (the suite has known unrelated failures) and
  `cd cli-rust && cargo test`.
- API routes are plain functions exporting `GET`/`POST` handlers and can be called directly.

## How you rate severity

- Critical: code execution or file writes outside the target project on the user's machine
  triggered by installing a component, by running the CLI inside a cloned repository, or by
  a remote request to a local dashboard server. Code execution or secret disclosure in the
  dashboard API or CI.
- High: writing outside `.claude/`, the project directory or `~/.claude/` without code
  execution; reading local files through a dashboard server; auth bypass in API routes;
  leaking Supabase, Neon, Clerk or Discord credentials.
- Medium: issues needing a local attacker already running as the user, stored or reflected
  XSS on aitmpl.com without session impact, open redirects.
- Low: denial of service, missing hardening headers, telemetry privacy issues.

## Anything to leave alone

- The CLI sends anonymous download counts unless `CCT_NO_TRACKING` or `CI` is set; that is
  documented behavior, not a finding.
- The Sentry DSN in `cli-tool/src/error-reporting.js` is public by design (send-only).
- `PUBLIC_*` variables in `dashboard/wrangler.toml` are build-time public values.
- Reports should include a reproducer and a minimal patch in the project's existing style
  (CommonJS in `cli-tool`, TypeScript in `dashboard`).
