# Task file

One JSON file per task, saved outside the repository. Start from [assets/task.template.json](../assets/task.template.json) and write only task-specific fields. Unknown fields are refused. `python -B "$SKILL/scripts/codex_bridge.py" check-task --task T` validates the file, the repository, the base commit and the validation program without starting Codex.

[schemas/task.schema.json](../schemas/task.schema.json) describes the same contract for documentation and editors. The bridge does not read it: its own validator decides, and it is stricter about paths than the schema can say.

## Modes

| Mode | Runs in | Writes | `validation_command` | `allowed_changed_paths` |
| --- | --- | --- | --- | --- |
| `implement` | new worktree, Codex `workspace-write` sandbox | yes | required | at least one |
| `test` | same | yes | required | may be empty (then any change is out of scope) |
| `analyze` | the primary checkout, Codex `read-only` sandbox | no | optional | must be `[]` |
| `review` | same | no | optional | must be `[]` |

`analyze` and `review` behave identically in the bridge; the mode is only the label the worker sees. Both are read-only: the result is the report (`worker.summary` and `worker.findings`), there is no patch, and they cannot be accepted, revised or cleaned up. A read-only task fails if the primary checkout changes while it runs, whoever changes it (your own edits count). `context_paths` defaults to the allowed paths, which are empty here, so name the files to read. The routing policy keeps advice and read-only review in Claude unless the user wants Codex to do them.

## Fields

| Field | Default | Rules |
| --- | --- | --- |
| `task_id` | file stem | `^[a-z0-9][a-z0-9._-]{0,63}$`, no `..`, not a Windows device name (`con`, `nul`, `com1`, ...), and it must make a valid Git branch name. |
| `repo_root` | Git top-level of the current directory | Absolute; must be the repository's top-level directory. |
| `base_commit` | HEAD of `repo_root` | Full 40-character commit id. Uncommitted tracked changes are not included (a warning says so). |
| `mode` | required | See above. |
| `objective` | required | Non-empty, at most 10,000 characters. |
| `context_paths` | `allowed_changed_paths` | The few files to read first. Same path rules as below. |
| `forbidden_context` | none | Paths or topics the worker must not read. |
| `allowed_changed_paths` | required | Exact repo-relative paths or a trailing `/**` directory. No other wildcards. Rejected: absolute paths, `..` components, any `:` (drive letter or NTFS stream) and any `.git` component. |
| `acceptance_criteria` | required | At least one observable criterion. |
| `locked_decisions`, `stop_conditions` | none | Decisions the worker must keep; conditions on which it must stop and report `blocked`. |
| `risk` | `medium` | `low`, `medium` or `high`. |
| `review_required` | `true` | `false` makes a completed result `IMPLEMENTED` instead of `REVIEW_PENDING`. |
| `plan_status` | `READY` | Only `READY` is accepted. |
| `model` | `null` | One identifier: no whitespace, not starting with `-`. `run --model` overrides it for that run. |
| `max_turns` | 6 | 1-12. A budget of work steps told to the worker for one segment, not a Codex turn cap. |
| `timeout_seconds` | 900 | 5-1800. Bounds one worker segment. |
| `max_total_turns` | none | Ignored. Still accepted so a task file written for 1.0.0 loads; use `max_turns`, `timeout_seconds` and `max_extensions`. |
| `max_extensions` | none | Caps automatic continuation grants when `auto_continue` is on. |
| `auto_continue` | 0 | 0-3 automatic continuation grants, each only after measurable progress. |
| `copy_ignored` | none | Repo-relative git-ignored files, folders or globs copied into the worktree before launch (200 MB total). Details in [setup](setup.md#local-inputs-copy_ignored). Same path rules as above, wildcards allowed. |
| `validation_command` | none | 1-24 non-empty strings. The program is resolved from PATH, an absolute path, or a repository path (in the base commit or under `allowed_changed_paths`). Python is run with `-B`. |
| `validation_timeout_seconds` | 600 | 1-1800. Allow the real runtime plus margin: a validation that times out is killed and can have an empty output tail. |
| `allow_subagents` | `false` | Only `false` is accepted. |
| `require_subscription_auth` | `true` | Only `true` is accepted. |
| `auto_review` | `null` | `null` follows the user's auto-review setting. `false` turns Codex auto-review off for this task. `true` cannot turn it on: while the user setting is off it is ignored and the result carries a warning, so one task file stays valid on every machine. [Safety](safety.md#auto-review). |

Give paths, decisions and criteria, not pasted files or history. Reasoning effort is not a task field: pass `--effort` to `run`.

## Revision feedback

`revise --finding "path::issue::expected"` (repeatable), or `--feedback file.json` holding `{"findings":[{"path":"p","issue":"defect and scenario","expected_behavior":"correction"}]}`. One to 50 findings; `path` is a repo-relative path inside `allowed_changed_paths`; `issue` and `expected_behavior` are 8-4000 characters each. A finding repeated in the same file, or feedback identical to an earlier revision, is refused.
