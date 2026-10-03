# linear-tickets

Your [Linear](https://linear.app) tickets in a side pane, with their status and a chart of how you are progressing.

```
linear: 2 in progress · 5 todo · 12 done (14d)
██████████████████▒▒▒▒▒▒░░░░░░░░░░░░████████████████████████
closed per day · 12 in 14d · max 4/day
        █          █
   ▄    █     ▄    █
▁ ▁█▁▁ ▁█▁▁ ▁ █▁▁ ▁█▁
14d ago                          today
cycle 12 Sprint 40% done · 36% of time
scope ▅▅▆▆▇▇
done  ▁▂▂▃▄▅
In progress (2)
◐ CLA-149 High  Wizard, pricing and the slot
```

The drawing above is schematic; the real chart is as wide as the pane allows, one column per day, four rows tall. `/linear` opens it (`/linear stop` closes it). A row opens the ticket's detail (state, priority, estimate, project, due date) and a `copy url` button; the backlog folds open from its header.

## What the charts are

- **Status bar**: your tickets split into in progress, todo, backlog and done (done = closed inside the `days` window).
- **Closed per day**: a bar chart of how many tickets you closed on each of the last `days` days, today last, in your local timezone, from each ticket's `completedAt`.
- **Cycle burn-up**: when your tickets sit in a cycle running now, that cycle's `scopeHistory` and `completedScopeHistory` as two sparklines, with its progress next to the share of its time already gone. Behind schedule is a "done" percentage below the "of time" one.

## Scope and secrets

Read-only: one GraphQL query for issues and one for the cycle, never a mutation. The API key comes from the plugin options (`linearApiKey`, stored as sensitive), goes only to `api.linear.app` in the `Authorization` header (a personal key as given, an OAuth token `lin_oauth_…` as `Bearer`), and is never logged or drawn. Ticket titles are read into the pane in memory and not stored.

Writing back (moving a ticket to In Progress, commenting) is deliberately left out of this first version.

## Options

```
  linearApiKey: string        Linear API key (required)
  assignee: string            "me" | "anyone" (default me)
  teamKey: string             only this team, the CLA of CLA-143 (default: every team)
  project: string             only projects whose name contains this (case-insensitive)
  days: number                history, 7-60 (default 14)
  pollSeconds: number         refresh interval, 30-3600 (default 120)
  status: boolean             status line summary; keeps polling with the pane closed (default false)
  openOnStart: boolean        open the pane at session start (default false)
```

The query asks for the first 100 tickets that are open or closed inside the window, most recently updated first, without pagination: with `assignee: anyone` or a very busy account the done count and the closed-per-day chart can undercount, so narrow it with `teamKey` or `project`. The pane lists at most 10 in-progress, 8 todo and 5 done tickets (`+N more` says how many are left) and 12 backlog tickets once it is folded open. `pollSeconds` is honoured to the nearest 5 seconds. Fields used were checked against Linear's published `schema.graphql`: `issues(filter, first, orderBy)`, `Issue.state.type`, `completedAt`, `cycle`, and `cycle(id)` with `scopeHistory` and `completedScopeHistory`.

## Install

```sh
npx claude-code-templates@latest --mod integrations/linear-tickets
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/linear-tickets/`, which Claude Code auto-loads as `linear-tickets@skills-dir` once the workspace trust prompt is accepted. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/linear-tickets`. `claude plugin validate .claude/skills/linear-tickets` prints every event it hooks and every `$` call it makes; `claude plugin test .claude/skills/linear-tickets` runs its tests.

Options are read from user settings (`~/.claude/settings.json`, never project settings), `--settings <file>` or managed settings, under the plugin's full id:

```json
{ "pluginConfigs": { "linear-tickets@skills-dir": { "options": { } } } }
```

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
