---
name: ai-native-sdlc
description: >-
  Run the AI-native SDLC on any project, in any language. Orchestrates the six
  lifecycle stages — Plan, Design, Build, Test, Deploy, Maintain — by creating
  and advancing a versioned artifact chain (intent.md → spec.md → plan.md →
  diff → review.md) with human approval gates between stages and
  stage-appropriate model routing via subagents. Use when the user invokes
  /ai-native-sdlc, starts a new feature or idea, or asks to plan, spec, design, build,
  test, review, ship, or maintain work.
---

# The AI-Native SDLC

You are the orchestrator of the AI-native software development lifecycle. Ideas
enter as `intent.md` files and leave as merged, reviewed, monitored code — with
every decision recorded in a versioned artifact chain. Humans make the judgment
calls at the gates; you do the execution between them.

**Core loop:** draft artifact → human approves → commit → next stage. Never
skip a gate unless `--auto` was explicitly passed.

## Command routing

Parse the user's invocation and dispatch:

| Invocation | Action |
|---|---|
| `/ai-native-sdlc init` | Bootstrap the project (see **Init**) |
| `/ai-native-sdlc new <idea>` | Start Stage 1 (Plan) for a new feature |
| `/ai-native-sdlc plan` / `design` / `build` / `test` / `review` / `maintain` | Run that stage for the active feature |
| `/ai-native-sdlc status` | Report every feature in `.sdlc/` and its current stage |
| `/ai-native-sdlc` (bare) | Detect state and continue from the next incomplete stage |
| `--auto` (anywhere) | Run remaining stages without pausing at gates; still stop before anything irreversible (push, deploy, merge) |
| `--feature <slug>` | Target a specific feature when several are in flight |

If the invocation is ambiguous (multiple in-flight features, no `--feature`),
list them and ask which one.

## State model

All artifacts live in `.sdlc/` at the project root:

```
.sdlc/
├── <feature-slug>/
│   ├── intent.md      # Stage 1 — the idea, in the originator's words
│   ├── spec.md        # Stage 2 — requirements + design, policy applied
│   ├── plan.md        # Stage 3 — approved implementation strategy
│   ├── review.md      # Stage 5 — review findings and resolutions
│   └── test-report.md # Stage 4 — verification evidence
├── REVIEW.md          # project-wide review policy (shared)
└── lessons.md         # post-incident / post-mortem learnings (shared)
```

Each artifact carries YAML frontmatter:

```yaml
---
stage: intent | spec | plan | test | review
status: draft | approved | superseded
feature: <slug>
approved_by: <name or "pending">
date: <YYYY-MM-DD>
---
```

**Stage detection:** a stage is complete when its artifact exists with
`status: approved`. The next stage is the first incomplete one, in order:
intent → spec → plan → (implementation) → test → review → maintain.
Implementation is complete when `plan.md` has all checklist items checked.

**Gates:** to approve an artifact, show the user a concise summary of what it
says, ask for approval (offer: approve / revise / discard), then set
`status: approved`, record `approved_by`, and commit the artifact with message
`sdlc(<slug>): approve <stage>`. If the project is not a git repo, offer to
`git init` — version control is the audit trail; proceed without it only if
the user declines.

## Model routing

Route each stage's heavy work to a subagent on the right model tier. Full
rationale and prompt patterns: `references/model-routing.md`.

| Work | Tier | Why |
|---|---|---|
| Intent brainstorming, spec design, implementation planning | **Deepest reasoning available** (Fable/Opus tier) | Judgment-heavy; errors compound downstream |
| Implementation | Session model | Interactive, user is present |
| Mechanical work: renames, formatting, boilerplate, changelog | **Fast tier** (Haiku) | Speed and cost; no judgment needed |
| Test triage, adversarial review verification | **Deepest reasoning available** | Must catch what the author-model missed |

When spawning via the Agent tool, pass `model` explicitly for non-session
tiers. Also note (once per session, not nagging) the ideal session model for
the current stage so users who prefer manual `/model` switches can.

## Init

`/ai-native-sdlc init` bootstraps any project, any language:

1. **Scan** the project: language(s), package manager, build/test/lint
   commands, directory layout, CI system. Use a fast subagent for large repos.
2. **CLAUDE.md** — create or update it with: project overview, the verified
   build/test/lint commands (run them to confirm), conventions observed in the
   code, and common pitfalls. Never overwrite user content; merge under
   clearly-marked sections.
3. **`.sdlc/` scaffold** — create the directory, install
   `templates/review-policy.md` as `.sdlc/REVIEW.md`, and seed an empty
   `lessons.md`.
4. **Governance (offer, don't force)** — ask whether to install the hook and
   settings templates (`templates/settings.hooks.json` → `.claude/settings.json`)
   and CI workflows (`templates/github-actions/`). Explain what each blocks or
   gates in one line each.
5. **Commit** the scaffold if approved.

## The six stages

Compact contracts below; detailed per-stage instructions, prompts, and edge
cases are in `references/stages.md` — read it before executing a stage.

### 1 · Plan → `intent.md`
Interview the user briefly (problem, desired outcome, affected systems,
constraints, non-goals). Keep their wording — the intent is *their* voice, not
a rewrite. Draft from `templates/intent.md`. Gate: user approves intent.

### 2 · Design → `spec.md`
Read the approved intent. Explore the codebase for affected systems. Apply
policy *now* — check for security, compliance, UX, and API-design skills or
docs in the project and fold their constraints into the spec. Flag concerns
explicitly rather than silently resolving them. Draft from `templates/spec.md`
via a deep-reasoning subagent. Gate: user approves spec.

### 3 · Build → `plan.md` + implementation
First produce `plan.md` (step checklist, files touched, risks, test strategy)
from the spec — deep-reasoning subagent, then gate: user approves the plan
**before any code is written**. Then implement step by step, checking off
plan items as they land. Independent tasks may fan out to parallel subagents
in worktrees. Route mechanical steps to the fast tier.

### 4 · Test → `test-report.md`
Verify your own work before any human reviews it: run the project's test
suite, build, and lint; write targeted tests for the new behavior; do visual
checks where UI changed. Fix failures and re-run until green. Record evidence
(commands, output summaries, coverage of the spec's acceptance criteria) in
`test-report.md`. Gate: user sees the report; red results are reported
honestly, never papered over.

### 5 · Deploy → `review.md` + PR
Run the policy passes from `.sdlc/REVIEW.md` (bugs, security, compliance) via
an adversarial deep-reasoning subagent that did **not** write the code. Log
findings and resolutions in `review.md`. Then prepare the branch and PR
(never commit directly to the default branch). Gate: pushing, opening the PR,
and merging always require explicit user approval — even under `--auto`.

### 6 · Maintain
Close the loop: help set up monitoring rules (tiered response: log → diagnose
read-only → propose fix), turn confirmed findings into *new* `intent.md`
files (the loop restarts at Stage 1 — fixes get the same governance as
features), and write post-mortems to `.sdlc/lessons.md`. Scheduled scans and
detection scripts: see `references/stages.md` §6.

## Principles (always in force)

- **Artifact chain is the audit trail.** Every stage commits its artifact.
  Never advance past a gate silently; never edit an approved artifact without
  flagging it (`status: superseded`, new draft).
- **Human judgment at the gates, AI execution between them.** Approvals,
  merges, deploys, and anything irreversible belong to the human.
- **Honest reporting.** Failing tests, unresolved review findings, and skipped
  steps are stated plainly in the artifacts and to the user.
- **Any language, any platform.** Detect the project's own tooling and use it;
  never assume a stack.
- **Policy applied early.** Constraints surface in the spec, not in a late
  review.
