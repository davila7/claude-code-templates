# pre-push-review

A portable, versioned **Claude Code plugin** that fires an expert panel of code reviewers
before **every `git push`** and **blocks the push on critical findings** — in every repo,
automatically, with no per-machine hand-wiring.

## Why this exists

The multi-agent pre-push review used to be a hand-wired global hook: a script in
`~/.claude/hooks/` pointing at a harness in `~/.config/git-ai-review/`. That works, but it is:

- **Per-machine** — every new machine/clone must be set up by hand; nothing is versioned.
- **Invisible** — its output is surfaced as hook feedback, easy to miss.
- **Coverage-inconsistent** — it only runs when *Claude Code itself* runs the push, and it
  can silently no-op if the harness file is missing.

Packaging it as a plugin fixes all three: the gate and the panel ship **inside the plugin**
(resolved via `CLAUDE_PLUGIN_ROOT`), so installing the plugin is the whole setup, it is
version-controlled, and it behaves identically everywhere.

## What it does

On every Bash `git push` that Claude Code runs, the plugin's `PreToolUse` hook
(`scripts/prepush-gate.mjs`) runs the bundled panel (`scripts/ai-review-panel.mjs`) over the
**commits being pushed** and:

- **Exit 0** → push proceeds (a per-SHA pass-marker is written under `~/.cache/git-ai-review`
  so an in-repo husky gate can skip re-running the panel — no double work).
- **Exit 1 (critical issue found)** → the push is **blocked** and the panel report is fed back
  as the reason.

The panel is 6 independent specialist reviewers, each constrained to one branch of review:

| Agent | Focus |
|---|---|
| Security & Privacy | authz/authn, tenant isolation, injection, secret/PII leakage |
| Correctness & Logic | logic bugs, null hazards, bad state transitions, breaking changes |
| Error Handling & Reliability | swallowed errors, races, idempotency, resource leaks |
| Performance & Scale | N+1, unbounded loops/fetches, hot-path waste |
| Test Coverage & Quality | untested branches, weak assertions, flaky patterns |
| Maintainability & Design | boundaries, duplication, dead code, leaky abstractions |

Each reviewer ingests the repo's own guidance (`CLAUDE.md` / `.github/copilot-instructions.md`
/ `AGENTS.md` / `.cursorrules`), so the generic panel auto-adapts per project.

## Install

From the marketplace (this repo / fork):

```
/plugin marketplace add adrianflda/claude-code-templates
/plugin install pre-push-review
```

Or point at a local checkout:

```
/plugin marketplace add /path/to/claude-code-templates
/plugin install pre-push-review
```

The `PreToolUse` hook is active as soon as the plugin is enabled — no extra config.

## Coverage: Claude pushes vs. human pushes

The `PreToolUse` hook covers pushes that **Claude Code runs**. To also gate **human**
`git push` from a terminal, add a git-level hook that calls the same panel. With husky:

```sh
# .husky/pre-push
node "$(git rev-parse --show-toplevel)/.claude/plugins/pre-push-review/scripts/ai-review-panel.mjs" --branch
```

(or copy `scripts/ai-review-panel.mjs` into the repo). Both paths share the per-SHA
pass-marker, so a push reviewed by the Claude hook is not re-reviewed by husky.

## Run on demand

`/pre-push-review` — review without pushing (staged changes, `branch`, or `pr <n>`).

Or directly:

```
node scripts/ai-review-panel.mjs            # staged changes
node scripts/ai-review-panel.mjs --branch   # commits being pushed
node scripts/ai-review-panel.mjs --pr 123   # review a PR and post a rolling comment
```

## Configuration (env)

| Var | Default | Meaning |
|---|---|---|
| `AI_REVIEW_MODEL` | `sonnet` | model for the reviewer agents |
| `AI_REVIEW_BLOCK_ON` | `critical` | severity that blocks: `critical` or `high` |
| `AI_REVIEW_TIMEOUT_MS` | `240000` | per-agent timeout |
| `AI_REVIEW_REQUIRED` | `0` | `1` = block (exit 2) if the CLI is unavailable |
| `PREPUSH_REVIEW_SKIP` / `AI_REVIEW_SKIP` | — | `1` = bypass the review once |
| `CLAUDE_BIN` | auto | explicit path to the `claude` binary |

## Bypass once

`PREPUSH_REVIEW_SKIP=1 git push` (Claude hook), or `git push --no-verify` (husky path).
