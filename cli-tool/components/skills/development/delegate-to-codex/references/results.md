# Exit codes, statuses and reports

## Exit codes

Every bridge subcommand prints one JSON document (`show-diff` prints the raw patch instead).

| Exit | Output | When |
| --- | --- | --- |
| 0 | stdout | The command ran and its status is not `failed` or `checkpoint_failed`. This includes `complete`, `extension_requested`, `accepted` (also with `cleanup_pending`), `rejected`, `passed` and `not_run` (a `revalidate` result), `ready` and `ok`. |
| 1 | stdout | The status is `failed` or `checkpoint_failed`: a worker run that failed, an `accept` whose apply check failed (`error`, `conflicting_files`), or a `revalidate` whose validation failed or that found the primary repository's settings changed (`failures`). |
| 2 | stderr, `{"status":"failed","error":...}` | The bridge refused or could not continue: invalid task or arguments, Codex or Git missing, billing overrides set, a lock held, a record that cannot be read. An error that starts `unexpected error:` is an internal failure or a damaged record; the run's record and worktree are kept and named in the error text. |
| 3 | stdout, `{"status":"capacity_paused","error":...,"usage":...}` | `run`, `continue` or `revise` refused to launch because the capacity gate is `exhausted`, `unknown` or `blocked` (`usage.gate`). Nothing was started and nothing was changed; repeat the same command later. |
| 4 | stdout, `{"status":"settings_required",...}` | `run`, `continue` or `revise` refused to launch because the user has not chosen a setting the bridge needs ([below](#settings-required)). Nothing was started, no worktree or record was created; record the answer, then repeat the command. |

`preflight` and `usage` report the gate without failing: they exit 0 even when it is `exhausted`. `check-task` and `settings` never exit 4: `check-task` reports an unset choice under `auto_review` and exits 0.

## Settings required

The user's settings live in `settings.json` in the bridge's state folder ([setup](setup.md#user-settings)). The only one so far is `auto_review`. While it is unset, a launch refuses before anything is created:

```json
{"status":"settings_required","setting":"auto_review","nothing_started":true,"error":"...",
 "question":"Do you want Codex auto-review (Approve for me) enabled or disabled?","options":["enabled","disabled"],
 "record_with":{"enabled":"python -B \"<skill>/scripts/codex_bridge.py\" settings set auto-review on",
                "disabled":"python -B \"<skill>/scripts/codex_bridge.py\" settings set auto-review off"},
 "then":"repeat the command that returned this result"}
```

Ask the user `question` once, run the `record_with` command that matches the answer, and repeat the launch. `settings show` prints `settings` (`true`, `false` or `null` when unset), `state` (`on`, `off`, `unset`), `unset`, `settings_file` and `ignored_keys` (keys in the file this version does not know; they are kept). `settings set auto-review on|off` (also `true`, `false`, `enabled`, `disabled`) records a choice and `settings unset auto-review` clears it. An unknown setting or value, or a damaged or newer settings file, is an exit 2 error naming the problem.

`scripts/setup.py` uses its own statuses and exits 0 for `passed`, `installation_ready` and `codex_ready`, otherwise 2 (see [setup](setup.md#doctor-statuses)).

## Lifecycle

`lifecycle_status` in `result.json` (and in the report) with its `status`:

| `lifecycle_status` | `status` | Meaning |
| --- | --- | --- |
| `RUNNING` | `running` | A run has started. `phase` is `creating_worktree`, `starting`, `preparing_worktree`, `worker_running` or `finishing`, and `pid` is the launcher. Normally replaced when the run finishes; if it stays after the launcher died, see [killed runs](codex-workflow.md#killed-runs-and-stale-locks). |
| `REVIEW_PENDING` | `complete` | Finished, validation passed, awaiting your review (`review_required` true). |
| `IMPLEMENTED` | `complete` | The same with `review_required` false. |
| `EXTENSION_REQUESTED` | `extension_requested` | The worker stopped at a safe point and asked for more steps. |
| `BLOCKED` | `failed` | The run failed (see `failures`). A bridge error during the run also lands here, with `phase` and the error. |
| `CHECKPOINT_FORMAT_FAILED` | `checkpoint_failed` | The worker's structured report could not be obtained. |
| `ACCEPTED` | `accepted` | `accept` applied the patch. `cleaned_at` is set once the worktree and branch are gone; `cleanup_error` says why not. |
| `REJECTED` | `rejected` | `cleanup` discarded the work. |

Which action fits each state: [recovery workflow](codex-workflow.md#lifecycle-and-next-action).

## Compact report

`run`, `continue` and `revise` print a compact report; `--full` prints `result.json`. The report holds:

- `notice`: the reminder that worker text is untrusted. `status`, `lifecycle_status`, `task_id`, `artifact`.
- `failures`, `warnings`, `changed_paths` (at most 200 names), and when present `unauthorized_changed_paths`, `ignored_files_created`, `error_kind`, `cleanup_error`, `interrupted_segment`.
- `worker` (`untrusted: true`, `status`, `summary`, `findings`, `blockers`, `checks`): the worker's own claims. Like the file names, `extension_request` and `auto_continuations`, they are stripped of control, invisible and direction-changing characters and length-capped.
- `extension_request`, `auto_continuations` when they apply.
- `validation`: `status`, and for a failure `output_tail`, at most 20 lines and 2,000 characters.
- `diffstat` and `diffstat_base` (`previous_segment` after a revision or continuation, else `base_commit`), `patch` (path of the full patch file).
- `review_binding`: `snapshot_tree` and `patch_sha256`, to pass to `accept --expect-tree` and `--expect-patch-sha256`.
- `tokens_last_segment`, `usage` (`gate`, `five_hour`, `weekly`, plus `source`, `age_seconds` and `measured_at`), `run` (`model`, `effort`, `auto_review` as `on` or `off`, and `auto_review_source`: `user setting`, `task override` or `run record`), `worker_environment_dropped` and `validation_environment_dropped` (counts of dropped variables).
- `approvals` (untrusted), present while auto-review is on or when Codex declined a command: `declined_commands`, up to 10 `declined` entries (`command`, `output`), `turns_ended_early` and `limits`. Codex's exec stream does not carry approval requests, reviewer verdicts or reasons, so only declined commands are visible: see [safety](safety.md#auto-review).

`usage.source` says where the after-run number came from: `launch_gate_snapshot` (taken before the run, so it may predate the whole run), `live`, or `failed`.

## Result record

`result.json` in the artifact directory also holds the fields below. The artifact directory is under the bridge's state folder ([setup](setup.md#runtime-state)).

- Identity: `branch`, `pin` (the git directory recorded when the worktree was created), `starting_commit`, `worktree`, `session_id`, `started_at`.
- Patch: `snapshot_tree` (the Git tree of the worktree after validation), `patch_sha256` (of `diff.patch`), `diff_path`, `changed_paths`, `diffstat`.
- Validation: `validation` with `status`, `requested`, `executable`, `process`, `byproduct_paths` (files the validation created in the worktree) and `environment`. Each `process` record has `output_truncated`: worker and validation output keep their first 1,000,000 and last 3,000,000 characters, with a marker line between them, and the report warns when that happened.
- Environment: `segments[].environment` and `validation.environment`, each `{"kept": count, "dropped": [names], "passthrough": [names]}` (names only, never values); `environment_evidence`, the bridge-side facts that back a worker's "my environment blocked me" claim (without it such a blocker stays a failure).
- Ignored files: `ignored_files_created` and `ignored_build_output_files` (the names, at most 50 each), and in `validation` the Python bytecode removed before it ran (`removed_bytecode_files`, `removed_bytecode_without_source`). See [safety](safety.md#files-hidden-from-the-patch).
- Auto-review: `auto_review` (`on` or `off`) and `auto_review_source`, repeated in `run_settings` together with `auto_review_note` (set when a task's `auto_review: true` was ignored because the user setting is off); `approvals` for the whole run and `segments[].approvals` per segment (`declined_commands`, `declined`, `turn_ended_early`).
- Usage: `usage_before`, and `usage_after` with `after_run_check` (`launch_gate_snapshot`, `live` or `failed`) and `measured_at`.
- Interrupted work: `segment_in_progress` (`label`, `operation`, `pid`, `started_at`, `from_lifecycle_status`, and `error` and `ended_at` once the bridge saw it end abnormally) is written before every continue, revise or automatic segment and removed by a clean finish.
- Acceptance: `accept_started_at` (while `accept` is applying), `applied_at`, `applied_manually`, `cleaned_at`, `cleanup_error`.
- Repository settings: `primary-guard.before.json` in the artifact folder holds the hashes the run started from; `repo_config_changes_accepted` lists each `revalidate --accept-repo-config-change` (time, and per changed name the hash before and after).
- A failed `accept` may carry a `hint`: after an earlier `accept` was killed while applying, it suggests repeating with `--already-applied` if the checkout already holds the patch.
- Other: `segments[]`, `revisions[]`, `auto_continuations[]`, `copy_ignored`, `preflight`, `warnings`, `failures`, `primary_checkout_unchanged`, `codex_claim`, `context_evidence`.

The keys `provider_checks` and `"provider": "codex"` are fixed names kept so that parsers of the output stay stable; they always describe Codex. `revalidate` prints `status` (`passed`, `failed` or `not_run` when no validation command exists), `validation`, `lifecycle_status`, `artifact`, `snapshot_tree`, `patch_sha256` and, when it blocks the result, `failures`.
