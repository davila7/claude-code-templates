# Recovery workflow

[SKILL.md](../SKILL.md) owns assignment, launch, review and acceptance. [Results](results.md) lists exit codes, statuses and report fields. This file says what to do in each lifecycle state, and how to recover. Use the bundled bridge for every Codex operation; `$SKILL` is this skill's directory.

## Lifecycle and next action

| Lifecycle | Action |
| --- | --- |
| `RUNNING` | A run is in progress or was killed. `active --task-id ID` shows the owner process. While it runs, wait for its completion notice; if its launcher is gone, see [killed runs](#killed-runs-and-stale-locks). |
| `REVIEW_PENDING` / `IMPLEMENTED` | Review, then accept, revise or clean up. Completion never publishes or commits anything. |
| `EXTENSION_REQUESTED` | Inspect the completed work, the exact remainder, the reason and capacity, then `continue` with no more turns than requested. |
| `BLOCKED` | Read `failures`. Preserve the evidence and diagnose: scope, a moved HEAD, forbidden tools, worker blockers, files hidden from the patch, changed repository configuration, or a bridge error (`phase` and the error are recorded). A failure caused only by the independent validation can be revised. |
| `CHECKPOINT_FORMAT_FAILED` | The read-only checkpoint failed (invalid report, timeout, interruption, worktree change or session mismatch). Inspect the recorded failure in `failures` and `result.json`, preserve the evidence, and decide from that. Never rerun just for formatting. |
| `ACCEPTED` | Done. If `cleanup_pending` or `cleanup_error` is set, run `accept` or `cleanup` again to remove the worktree and branch. A repeated `accept` never applies the patch twice. |
| `REJECTED` | Done. The worktree and branch are gone and the artifact is kept. |

## Continue

```bash
python -B "$SKILL/scripts/codex_bridge.py" continue --task T --artifact A --grant-turns N
```

`continue` needs an `EXTENSION_REQUESTED` artifact. N is 1 up to the worker's requested turns. It resumes the same session, worktree, model and effort; do not repeat completed work. Auto-review is decided afresh: a session that began with auto-review off never gains it, and one that began on follows the user's current setting (and the task's `auto_review: false`), so it can be turned off. A further extension without measurable progress blocks. `max_turns` is a step budget, not a Codex turn cap; `timeout_seconds` bounds one segment. A segment that returns no valid structured report gets one read-only structured checkpoint, but only when Codex reported a session id, the run was not interrupted, and the process either exited 0 or hit the time cap. After any other nonzero exit, or with no session id, no checkpoint is requested and the segment fails without a report.

`auto_continue` (task field, 0-3) lets the bridge grant the requested turns itself after a segment that changed the worktree, up to that many times (and no more than `max_extensions`, when set). Each grant needs a fresh capacity check and is recorded in `auto_continuations`. Without progress or capacity the result stays `EXTENSION_REQUESTED` for you.

## Revise and revalidate

`revise` resumes the same session and worktree with your findings; duplicate feedback and a revision that changes nothing block. It accepts only `REVIEW_PENDING`/`IMPLEMENTED` results and failures caused solely by the independent validation.

`revalidate` reruns the validation command on the preserved worktree and refreshes the record, snapshot and patch: review the patch again afterwards. It is refused for `ACCEPTED`, `REJECTED` and `RUNNING` artifacts. It preserves other recorded failures and checks scope, the primary checkout and the primary repository's code-running settings (before and after the validation) before restoring readiness. It prints `status` `passed`, `failed`, or `not_run` when the task has no validation command.

Do not edit a worktree by hand. A worktree that no longer matches its record is refused by every command except `cleanup`, apart from the interrupted-segment case below. A warning that validation created files means those files are in the snapshot and patch; if they do not belong, send a `revise` finding to remove them.

## Worker checks and scope

`CODEX_BRIDGE_WORKER_CHECKS` is `auto` (default), `run` or `skip`. `auto` lets the worker run checks unless the sandbox cannot start the validation program (a Windows profile executable without `CodexSandboxUsers` access, or no command). `run` requires worker checks; `skip` makes the worker read the code and report its checks as `not_run`. Independent bridge validation governs either way. Missing context evidence only warns. Environment-only blockers with changes, and policy refusals with progress, warn and defer to validation; any other blocker blocks.

Scope rules ([safety](safety.md) has the reasons):

- Changes to the primary checkout inside the task's allowed paths block the result; changes outside them only warn. Renames count both paths. Identical status entries can hide edits, and `primary_checkout_unchanged=false` may accompany an outside-scope warning.
- A read-only task that changes the primary checkout fails. In every mode, a change to the primary repository's hooks or to a setting that makes Git run code (see [safety](safety.md#git-and-the-primary-checkout)) fails the result and names the hook or `config:<key>`; the same check runs after validation and again in `accept`. If you made the change, `revalidate --accept-repo-config-change` accepts it (both hashes are recorded); otherwise find out what changed it.
- A worker that creates git-ignored files the patch cannot carry (other than ordinary build or cache output) fails.

`error_kind` in a failed result helps diagnosis: `rate_limit` and `authentication` come from the worker's own error text, `sandbox_policy_rejected` means Codex refused at least one worker command as "blocked by policy" and no other error kind applied; with worker progress the result only warns. Only when no command ran and nothing changed does it fail the result, and only then point at the Windows sandbox setup (see [setup](setup.md)), `bridge_error` is an internal failure, `codex_error` is anything else. None of them is capacity exhaustion.

## Capacity

The bridge reads plan usage from `codex app-server` and gates every launch (`run`, `continue`, `revise` and each automatic continuation):

| Gate | Meaning | Result |
| --- | --- | --- |
| `available` | The governing windows have capacity. | The launch proceeds. |
| `exhausted` | A governing window is at 0% or reported `rate_limit_reached`. The reason names the window and its reset time. | Exit 3 `capacity_paused`. Wait for the reset or ask the user. |
| `blocked` | The account reports an explicit block (credits depleted, ordinary usage not allowed). Waiting for a reset will not help. | Exit 3. Tell the user. |
| `unknown` | No usage window was reported, or usage could not be read. | Exit 3. Retry; check `doctor`. |

Usage windows are classified by length: up to 12 hours is the five-hour window, six days or more is weekly. A plan with no five-hour window is normal; the weekly window then governs. Work while capacity remains and shorten segments near exhaustion. `usage` caches 60 seconds; `usage --refresh` reads live. Claude and Codex are separate meters.

## Killed runs and stale locks

Each task holds one lock while a command works on it. A second command for the same task is refused with "already has an active run". If the launcher was killed (closed terminal, restart, crash), recover in this order:

1. `active --task-id ID`: `process_running: false` means the owner is gone. Only then continue.
2. `clear-stale-lock --task-id ID` archives the lock (`STALE_LOCK_ARCHIVED`; `NOT_RUNNING` when there was none). It refuses while the owner process runs, and it archives an unreadable lock only once it is 30 seconds old. The lock stores when its owner process started, so a process id that Windows has since given to another program does not count as the owner. As a last resort, when `active` still reports a running owner that you have confirmed is not a bridge command, delete the lock file named in its `lock_path` by hand.
3. `cleanup --task T --artifact A` removes the worktree and branch recorded at creation and marks the artifact `REJECTED`. `latest` finds the newest artifact. If the run never recorded a Codex session, cleanup is the only way forward; then start the task again.

A killed read-only run has no worktree: clear its lock and run the task again (cleanup applies to `implement` and `test` tasks only).

A `continue`, `revise` or automatic segment that was killed leaves `segment_in_progress` in the record and a worktree that moved on. For that case `continue`, `revise` and `revalidate` adopt the worktree (review its patch before accepting), `accept` refuses, and `cleanup` discards it. The report shows `interrupted_segment`.
