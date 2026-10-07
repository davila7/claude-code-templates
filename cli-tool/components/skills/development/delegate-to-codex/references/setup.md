# First-use setup

The lead (Claude Code) runs these checks and handles mechanical setup. The account owner completes their own browser sign-in; no credentials are part of the skill.

In these files `$SKILL` is this skill's own folder: an installed copy or a link to a checkout of it. SKILL.md writes it as `${CLAUDE_SKILL_DIR}`.

## Environment

Verified target: Claude Code on native Windows 10/11, Python 3.11+, Git, and the Codex CLI signed in with ChatGPT. The Cowork app's Linux VM, WSL, macOS and cloud sandboxes are not claimed ready ([PLATFORMS.md](../PLATFORMS.md) lists what a port needs). No pip packages are needed.

- The bridge finds Codex as `codex.exe` or `codex` on PATH, the native binary behind an npm `codex.cmd` shim, or the Codex desktop app's CLI under `%LOCALAPPDATA%\OpenAI\Codex\bin\` (the app keeps it in per-version folders, `bin\<hash>\codex.exe`; the newest is used). To pin one, set `CODEX_BRIDGE_COMMAND` to a JSON array whose first item is the absolute executable.
- The elevated Windows sandbox runs commands as separate local accounts (group `CodexSandboxUsers`), which cannot start programs installed in your user profile ("Access is denied"), such as a per-user Python. With the default `CODEX_BRIDGE_WORKER_CHECKS=auto` the bridge checks the `validation_command` program and lets the worker run tests only when the sandbox can start it. To let workers test with a per-user Python, grant the group read and run access to its folder once (reverse with `/remove CodexSandboxUsers`):

  ```powershell
  icacls "$env:LOCALAPPDATA\Programs\Python\Python312" /grant "CodexSandboxUsers:(OI)(CI)RX"
  ```

  The bridge always runs `validation_command` itself as well, outside the sandbox.

  Store-installed programs under `Program Files\WindowsApps` (for example, PowerShell `pwsh`) are also treated as unavailable to elevated sandbox workers, even if their folder ACL mentions the sandbox group. In `auto` mode workers skip checks that use these programs; the bridge's own validation outside the sandbox still runs them.

Codex only enforces its sandbox on Windows when `windows.sandbox` is configured. Workers run with `--ignore-user-config`, so the bridge always passes `windows.sandbox="elevated"` itself (override with `CODEX_BRIDGE_WINDOWS_SANDBOX=unelevated` or `mxc`). If the Windows sandbox has never been set up on the machine, every worker command is rejected as "blocked by policy" and the result shows `error_kind: sandbox_policy_rejected`; set the sandbox up once in Codex, or switch the mode, then rerun `doctor`. Never work around it by giving the worker full access.

Install anything missing from official sources: [Git for Windows](https://git-scm.com/downloads/win), [Codex CLI](https://developers.openai.com/codex/cli).

## Environment variables

| Variable | Values | Effect |
| --- | --- | --- |
| `DELEGATE_TO_CODEX_STATE_DIR` | absolute directory | Where the bridge keeps its state ([below](#runtime-state)). Keep it set for every command of a task. |
| `CLAUDE_CONFIG_DIR` | directory | Moves the default state folder with the rest of the Claude configuration (default `~/.claude`). |
| `CODEX_BRIDGE_COMMAND` | JSON array | The Codex executable to use: absolute path first, then fixed arguments. |
| `CODEX_BRIDGE_WORKER_CHECKS` | `auto` (default), `run`, `skip` | Whether the worker runs checks itself ([recovery workflow](codex-workflow.md#worker-checks-and-scope)). |
| `CODEX_BRIDGE_WINDOWS_SANDBOX` | `elevated` (default), `unelevated`, `mxc` | The Windows sandbox mode passed to Codex. |
| `CODEX_BRIDGE_VALIDATION_ENV` | names separated by commas, semicolons or spaces | Variables passed through to the validation command although the scrub would drop them ([safety](safety.md#environment-scrubbing)). |
| `CODEX_BRIDGE_WORKER_ENV` | same | The same for the Codex worker process. |

Billing variables (`OPENAI_API_KEY`, `CODEX_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_API_BASE`, `AZURE_OPENAI_API_KEY`) must not be set: the bridge refuses subscription-only routing while they are.

## Verify the package (no Codex contact)

```bash
python -B "$SKILL/scripts/setup.py" doctor --offline
python -B "$SKILL/scripts/setup.py" self-test
```

`self-test` is the check every install ships with: it builds a disposable Git fixture, runs the packaged launcher's `check-task`, builds the Codex command line and runs a validation, without starting Codex. A source checkout of the skill also has a `tests` folder; from the skill directory, `python -B -m unittest discover -s tests` runs it (the same command in bash, PowerShell and `cmd`; the tests find the source themselves). Installed copies may not include it.

## Sign in and verify

Sign in with `codex login` (ChatGPT, not an API key). Never ask for pasted tokens or read credential files.

```bash
python -B "$SKILL/scripts/setup.py" doctor
```

`doctor` checks: Python 3.11+, Windows, Git, the bundled runtime and state folder, no API-key or base-URL overrides in the environment, a Codex CLI that reports a `chatgpt` account, and plan usage through `codex app-server`. It prints the plan type and usage percentages only, never emails, IDs or tokens. A plan with no five-hour window shows "five-hour not reported (trusted)" and is ready while the weekly window has capacity.

### Doctor statuses

`doctor` and `self-test` print JSON. A check is `ready` or `setup_required`; the top-level `status` is:

| Status | Command | Meaning | Exit |
| --- | --- | --- | --- |
| `passed` | `self-test` | The offline fixture checks passed (`provider_called: false`). | 0 |
| `installation_ready` | `doctor --offline` | Python, platform, Git and the bundled files are fine; Codex was not contacted. | 0 |
| `codex_ready` | `doctor` | Every check passed, including sign-in and capacity. | 0 |
| `setup_required` | any | At least one check is not ready; each names its `next_action`. | 2 |

`setup_required` also covers the `codex_capacity` check when usage is exhausted, blocked or unknown. That is not a setup problem: its detail names the gate, and the fix is to wait for the reset (or tell the user about a block), not to reinstall anything.

`doctor` also prints `state_permissions`: `ok`, `warning` (accounts such as Everyone or Users can reach the state folder; the issues are listed) or `unknown`. It never changes the status.

It prints `settings` (`auto_review`: `on`, `off`, `unset` or `unreadable`) and `setup_items`. An unset choice is a setup item, not a failure: the status stays as it was and the item holds the `question` to ask the user once and the `record_with` commands. A settings file the bridge cannot read is a failed `settings_file` check.

## Runtime state

Artifacts, worktrees, locks and the usage cache live in one state folder outside every Git repository and outside the skill. By default it is `~/.claude/delegate-to-codex-state/default/` (under `$CLAUDE_CONFIG_DIR` when set). It does not depend on where the skill is installed, so moving or updating the skill leaves it in place. Version 1.0.0 keyed the state folder on the install path; when exactly one such folder exists it is adopted automatically, and when several exist `doctor` lists them (`state_directories`) so you can pick one with `DELEGATE_TO_CODEX_STATE_DIR`. A marker file stops it being mixed with an unrelated directory.

To keep state somewhere you choose, set `DELEGATE_TO_CODEX_STATE_DIR` to a fresh absolute directory (or an existing delegate-to-codex state folder) and keep it set for every bridge command. A directory inside any Git repository or inside the skill is refused (if your home folder is itself a Git repository, set `DELEGATE_TO_CODEX_STATE_DIR` to a folder outside it).

Layout: `artifacts/codex/<task>-<timestamp>/` (task copy, `result.json`, patches, transcripts, validation logs), `wt/<10-character id>/` (worktrees, kept short for Windows path limits), `cache/` (usage), and lock and bookkeeping folders. The artifact records its worktree path (an artifact that records none is looked up inside its own folder).

Never commit runtime state, account configuration, session transcripts, logs or caches. Live worker output can contain private data even though no credentials ship with this skill. Save task files outside the working repository too.

## User settings

Choices the user makes once for every task are kept in `settings.json` in the state folder (see above), as `{"schema_version": 1, "auto_review": true}`. A setting that is absent is unset. The file is written whole and atomically; keys this version does not know are kept when another setting is saved, and a file written by a newer schema version is refused instead of guessed at. Read and change it with the bridge, not by hand:

```bash
python -B "$SKILL/scripts/codex_bridge.py" settings show
python -B "$SKILL/scripts/codex_bridge.py" settings set auto-review on     # or off
python -B "$SKILL/scripts/codex_bridge.py" settings unset auto-review      # ask again
```

`auto_review` chooses whether Codex's auto-review (Approve for me) answers a worker's approval requests ([safety](safety.md#auto-review)). While it is unset, `run`, `continue` and `revise` refuse with status `settings_required` (exit 4, [results](results.md#settings-required)) before creating anything. The installer asks the question and records the answer (`install.py --auto-review on|off` skips the question). OpenAI states that automatic reviews do not count against plan usage (as of 2026-10-06); check Codex's current documentation.

## Local inputs (copy_ignored)

Use the task field `copy_ignored` to supply local inputs that Git ignores, such as `"copy_ignored": ["local.properties", "libs/", "private/*.json"]`. Paths and globs are relative to the primary checkout. Everything selected must be git-ignored; tracked paths, links and junctions, repository escapes, missing matches, overwrites in the worktree and totals over 200 MB are refused. Copies are made before the worker starts and listed in the artifact. Ignore rules should also apply at the task's base commit so the copied inputs stay out of the reviewed patch. The worker can read what you copy, and its transcript will show it.
