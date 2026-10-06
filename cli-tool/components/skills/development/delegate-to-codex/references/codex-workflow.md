# Recovery workflow

[SKILL.md](../SKILL.md) owns assignment, launch, review, acceptance, revisions, usage and fallback. Use its bridge commands for every provider operation.

| Lifecycle | Action |
| --- | --- |
| `REVIEW_PENDING` / `IMPLEMENTED` | Review then accept/revise. Completion never publishes automatically. |
| `EXTENSION_REQUESTED` | Inspect completed work, exact remainder, reason and capacity; grant no more than requested. |
| `BLOCKED` | Read failures; preserve evidence and diagnose scope, moved HEAD, forbidden tools or worker blockers. Validation-only failures can be revised. |
| `CHECKPOINT_FORMAT_FAILED` | Invalid report after read-only checkpoint: preserve evidence and stop; never rerun for formatting. |

## Continue

```bash
python -B "$SKILL/scripts/codex_bridge.py" continue --task T --artifact latest --grant-turns N
```

Same session/worktree/model/effort; do not repeat completed work. A further extension without measurable progress blocks. `max_turns` is a step budget, not a CLI turn cap; `timeout_seconds` bounds a segment. A time-capped resumable or unstructured completion gets one read-only structured checkpoint.

`CODEX_BRIDGE_WORKER_CHECKS=auto` runs checks unless the sandbox cannot start validation (Windows profile executable without `CodexSandboxUsers` access, or no command). `run` requires worker checks; `skip` requests reading/checks=`not_run`. Independent bridge validation still governs. Missing context evidence warns. Environment-only blockers with changes and policy refusals with progress warn/defer to validation; non-environment blockers block.

Primary-checkout changes in allowed paths block; outside-scope changes warn. Renames include both paths. Identical status entries can hide edits; `primary_checkout_unchanged=false` may accompany an outside-scope warning. Revalidation preserves other failures and checks scope/primary checkout before restoring readiness.

## Capacity diagnostics

Windows are classified by duration: up to 12 hours is five-hour, six days or more weekly. No five-hour window is normal; no windows/read failure is unknown (exit 3). Credit depletion/`ordinaryUsageAllowed=false` blocks without fallback. See the single [fallback rule](../SKILL.md#capacity-and-fallback).

## Handoff and stale locks

```bash
python -B "$SKILL/scripts/codex_bridge.py" export-handoff --task T --artifact latest --output "<new external directory>"
```

First delete the files that validation created (named in warnings); out-of-scope files prevent export. For a forcibly terminated launcher, inspect `active --task-id ID`; use `clear-stale-lock --task-id ID` only after proving the owner process dead.
