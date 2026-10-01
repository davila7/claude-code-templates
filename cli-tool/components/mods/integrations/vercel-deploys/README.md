# vercel-deploys

Your [Vercel](https://vercel.com) projects in a side pane: each connected site with the state of its latest deployment, its production domain, the Git commit behind it and whether the site answers right now. It refreshes itself and toasts when a deployment finishes or fails.

```
vercel: 5 ready · 1 building · 1 failed
◐ web  1m                    ✓200
✕ api  5s                    ✕502
● docs 25h                   ✓200
```

`/vercel` opens it (`/vercel stop` closes it). A row opens that project's last five deployments (production or preview, age, commit message) and a `copy url` button.

## How it stays current

- `$.clock.every(5000)` decides when to read: every `pollSeconds` (60 by default) while nothing builds, every 10 seconds while a deployment builds or is queued, and nothing while the pane is closed and the status line is off.
- A deployment that turns **ready** or **failed** raises a toast (`vercel: web is ready in production`, `vercel: api failed: …`). The first read announces nothing.
- `$.ui.status` keeps `vercel: 5 ready · 1 building · 1 failed` under the prompt.
- With `healthCheck` on, each production domain gets one `GET` at most once a minute, with a 5-second cap. A site "answers" with any status below 500, so a protected deployment (401) counts as up and a gateway failure does not.

## Scope and secrets

Read-only: it lists projects (`GET /v10/projects`) and deployments (`GET /v7/deployments`) and sends nothing else to Vercel. The access token comes from the plugin options (`vercelToken`, stored as sensitive), goes only to `api.vercel.com` in the `Authorization` header, and is never logged or drawn. The health probes carry no credentials and go to the hostnames Vercel reports for your projects, which are your own sites but not hosts this mod controls: turn `healthCheck` off to send nothing but API calls. Use a token scoped to the team you want to see (`teamId` takes a `team_…` id or a team slug).

This is separate from `security/jev-vercel-sandbox`, which runs Claude's work in a Vercel Sandbox.

## Options

```
  vercelToken: string   Vercel access token (required)
  teamId: string        team_... id or slug (default: the token's own account)
  maxProjects: number   projects listed, 1-50 (default 20)
  pollSeconds: number   idle refresh interval, 10-3600 (default 60)
  healthCheck: boolean  GET each production domain, at most once a minute (default true)
  status: boolean       status line summary; keeps polling with the pane closed (default true)
  toast: boolean        toast when a deployment finishes (default true)
  openOnStart: boolean  open the pane at session start (default false)
```

Vercel's response fields come from its REST reference; the parsers read what they find and leave out what is missing, so an API change degrades rows rather than breaking the pane.

## Install

```sh
npx claude-code-templates@latest --mod integrations/vercel-deploys
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/vercel-deploys/`, which Claude Code auto-loads as `vercel-deploys@skills-dir` once the workspace trust prompt is accepted. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/vercel-deploys`. `claude plugin validate .claude/skills/vercel-deploys` prints every event it hooks and every `$` call it makes; `claude plugin test .claude/skills/vercel-deploys` runs its tests.

Options are read from user settings (`~/.claude/settings.json`, never project settings), `--settings <file>` or managed settings, under the plugin's full id:

```json
{ "pluginConfigs": { "vercel-deploys@skills-dir": { "options": { } } } }
```

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
