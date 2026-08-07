---
name: ultracost
description: "Quality-first per-stage model routing and a pre-flight cost gate for Claude Code ultracode dynamic workflows. Pin the right model and effort on every agent() stage, estimate cost, and confirm before launching."
risk: low
source: community
date_added: "2026-06-15"
---

# ultracost

Per-stage model routing for Claude Code `ultracode` dynamic workflows. It applies to
**any** kind of work a dynamic workflow does — frontend, backend, research, refactors,
audits — not one domain.

## Purpose

When `ultracode` is on, the session runs on Opus @ `xhigh` and a single dynamic workflow
fans out to dozens of subagents that **inherit that session model** unless every `agent()`
stage is pinned. The built-in guidance even tells Claude to omit the per-agent model, so
the whole fan-out silently lands on Opus. This skill makes the per-stage routing explicit
and verifiable, keeping quality on the work that matters while dropping mechanical work to
a cheaper tier.

## Use this skill when

- Authoring or running an `ultracode` / dynamic-workflow script.
- Spawning subagents or writing `agent()` / `pipeline()` stages.
- You want to estimate and confirm a workflow's cost before it fans out.

## Routing policy

Route every subagent and every dynamic-workflow stage **explicitly**. Never let a stage
inherit the session model by default. Never use `haiku`.

### Tiers

- **`opus` @ `xhigh`** — Coding & reasoning: anything requiring judgment or a decision:
  writing/editing/refactoring code, debugging, designing APIs/schemas/architecture,
  non-trivial tests, code review, security/performance analysis, planning, synthesis,
  final consolidation.
- **`sonnet` @ `high`** — Pre-planned mechanical & support: applying a specified edit
  across files, search/grep/glob, file discovery, collecting/listing/extracting,
  reformatting, running tests and reporting results, routine git operations, gathering
  context for an opus stage to consume.

**Decision rule:** if a stage must DECIDE how to write or change code, use `opus`. If the
"how" is already planned and the stage only executes it mechanically — or it's
search/collection/formatting — use `sonnet`. When in doubt, use `opus`.

### Hard rules

- Never use `haiku`, ever.
- Pin the model per stage via the per-invocation `model` param, e.g.
  `agent(task, { model: 'sonnet' })`.
- These stages are always `opus`: `orchestrator`, `planner`, `final-synthesis`,
  `consolidation`.

### Effort per stage

Set `effort` per stage, choosing the lowest level that fits, bounded by model (`sonnet`
up to `high`, `opus` up to `xhigh`): `low` (trivial deterministic), `medium` (light
judgment), `high` (standard coding/analysis), `xhigh` (hard cross-file reasoning,
adversarial review, planning, final synthesis). e.g.
`agent(task, { model: 'sonnet', effort: 'low' })` for a mechanical scan.

### Pre-flight cost gate

Before launching a dynamic workflow: draft the script with per-stage `model` and `effort`
set, verify pins with `/ultracost:check <file>`, estimate it with
`/ultracost:estimate <file>` (agent count, model mix, cost vs an all-opus baseline), then
Approve / Cancel / Modify before launch.

## Full plugin

This is the self-contained routing-policy skill. The complete ultracost plugin — the
Workflow Guard, a deterministic `PreToolUse` cost gate, the closed-loop
`usage`/`reconcile`/`calibrate`/`ledger` commands, and the `/ultracost:*` slash commands —
installs from the canonical marketplace:

```text
/plugin marketplace add danielkremen818/ultracost
/plugin install ultracost@ultracost
```

Or via npm for CI/scripting: `npx ultracost init`.

- **Repository:** https://github.com/danielkremen818/ultracost
- **License:** MIT · zero dependencies · no telemetry · no network on the hot path
- **Author:** [danielkremen818](https://github.com/danielkremen818)
