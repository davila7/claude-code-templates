---
name: delegate-to-codex
description: Claude leads scope, review and acceptance; bounded Codex subscription workers implement in isolated worktrees. Grok is fallback after confirmed Codex exhaustion. Use for code changes with Codex workers or conserving Claude usage; advice and read-only review stay in Claude.
license: MIT (see LICENSE.txt)
permissions: [env, file_read, file_write, shell]
---

# Delegate to Codex

Claude owns requirements, design, assignments, review and acceptance; Codex writes code and tests. `SKILL` is this directory (normally `~/.claude/skills/delegate-to-codex`), `python` is 3.11+; PowerShell uses `$SKILL`/`$Python`. Run [setup](references/setup.md) once per machine/provider; bridge checks sign-in/capacity. Use the bundled bridge for provider operations, never the Codex CLI directly. Verified on native Windows; see [PLATFORMS.md](PLATFORMS.md) to port it to macOS.

## Assign

Bound scope/design investigation; workers explore named files without pre-written code. Batch related changes; split at verifiable boundaries. Save one canonical external task file (private state or shadow workspace), using [the template](assets/task.template.json):

- Required: `mode` (`implement`/`test`), `objective`, `allowed_changed_paths` (exact paths or `dir/**`, including tests), observable `acceptance_criteria`.
- Inferred unless explicit: `task_id` from the valid file stem, `repo_root` from the current directory's Git top-level, `base_commit` from that checkout's HEAD, `context_paths` from allowed paths. Uncommitted primary changes are excluded; never stash/reset/clean/commit the primary checkout to prepare a base. Explicit context paths should name the few files to read first.
- Supply a focused `validation_command` argument array. Optional: `locked_decisions`, `stop_conditions`, `forbidden_context`, `risk` (medium), `max_turns` (6 steps), `timeout_seconds` (900), `validation_timeout_seconds` (600, maximum 1800; allow real runtime plus margin or the test is killed and can have an empty tail), `copy_ignored` (repo-relative ignored paths/globs to copy; 200 MB total), `auto_continue` (0-3 automatic continuation grants with measurable progress, default 0; capped by `max_extensions` when supplied).
- Leave the safety fields at their defaults: `allow_subagents=false`, `require_subscription_auth=true`, `model=null` are safe defaults. Give paths/decisions/criteria, never pasted files or history.

## Run

```bash
python -B "$SKILL/scripts/codex_bridge.py" run --task "<task.json>" --model gpt-6.1-sol --effort medium
```

`run` validates tasks. Choose the lowest listed model/effort that fits: Sol low/medium ordinarily, higher effort/Astra for hard reasoning. Lead chooses worker count; parallel tasks need separate ids/files and non-overlapping paths. Launch each once with Bash `run_in_background`, keep its own output, end the turn and read its completion notice. Never relaunch for silence, poll, monitor or redirect reports.

Compact JSON: failures/warnings, paths, worker summary/findings/checks, validation, round diffstat/additions/deletions, full `patch`, last-segment tokens and after-usage/gate. Passing validation omits output; failure tails are capped. Revisions/continuations show stats against the previous segment. `--pretty` indents; `--full` prints the preserved `result.json`. Open full records/transcripts only for contradictions, scope problems or unexplained failures.

## Review and decide

Review depth follows [routing policy](references/routing-policy.md). Every writing task needs lead acceptance. Inspect the required patch, selecting files or only the last round:

```bash
python -B "$SKILL/scripts/codex_bridge.py" show-diff --artifact "<artifact>" [--files a.py,b.py] [--since-last]
python -B "$SKILL/scripts/codex_bridge.py" accept --task "<task.json>" --artifact latest [--3way | --already-applied]
python -B "$SKILL/scripts/codex_bridge.py" revise --task "<task.json>" --artifact latest --finding "path::defect and scenario::expected correction"
python -B "$SKILL/scripts/codex_bridge.py" cleanup --task "<task.json>" --artifact latest
```

Accept only `REVIEW_PENDING`/`IMPLEMENTED`, passing bridge validation, allowed paths and a correct diff. When integration is authorized, `accept` checks then applies the normalized full patch to the primary checkout, records acceptance and removes the task worktree/branch; it never commits/pushes/merges. Use `accept --already-applied` to verify a manually integrated patch by reverse apply check, record acceptance and clean up without applying anything; it cannot be combined with `--3way`. Apply patches one at a time. A failed apply check reports conflicts and changes nothing: revise or rerun from the updated base, then review; never force it. `cleanup` rejects/disposes of work but keeps its artifact.

Corrections resume the same session/worktree. Repeat `--finding`, or use `--feedback` with `{"findings":[{"path":"p","issue":"defect and scenario","expected_behavior":"correction"}]}`; `--grant-turns` defaults to 4 (1-12). Findings stay in scope; duplicate feedback and revisions without progress block. Send clear test/compiler failures straight back, without re-diagnosing/pre-writing fixes unless design/scope is wrong. Reuse passing checks for identical code; broaden checks/review only for changed code, failures, missing evidence or concrete risk.

Bridge validation is acceptance evidence even when worker checks are `not_run`. Timeout: `revalidate --task T --artifact A --timeout N` (1-1800). Extensions/checkpoints/locks/handoffs: [recovery workflow](references/codex-workflow.md). `--artifact latest` needs `--task T`.

## Capacity and fallback

Work while governing windows have capacity; shorten segments near exhaustion. Usage unknown pauses (exit 3); a plan without a five-hour window is normal and weekly governs. `usage` caches 60 seconds; `usage --refresh` reads live. Only confirmed governing exhaustion (0% or `rate_limit_reached`), or explicit user selection, permits [Grok](references/grok-fallback.md). Unknown usage, transient 429s, login failures, timeouts, generic errors, credit/billing blocks and review defects never select fallback. Never switch to API-key billing.

Before switching, stop Codex writing, define only the remainder, export a verified handoff and seed Grok's separate worktree. Review the combined diff against the original base. Unverifiable integrity means preserve evidence and diagnose, never silently restart/discard partial work. Respect the user's Grok budget; check Codex at the next assignment boundary and prefer it after reset, letting running Grok finish.

Repository/shadow-workspace/identity rules and authorization govern integration/release. Report outcome/checks/blockers/artifact/measured tokens concisely; Claude and Codex are separate meters, so claim savings only from measurements.
