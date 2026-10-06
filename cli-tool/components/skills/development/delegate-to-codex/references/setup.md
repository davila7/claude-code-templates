# First-use setup

The lead (Claude Code) runs these checks and handles mechanical setup. The account owner completes their own browser sign-in; credentials are never part of the skill.

## Environment

Verified target: Claude Code on native Windows, Python 3.11+, Git, and the Codex CLI signed in with ChatGPT. Grok Build is optional (fallback). The Cowork app's Linux VM, WSL, macOS and cloud sandboxes are not claimed ready.

- `SKILL` = this skill's directory (normally `~/.claude/skills/delegate-to-codex`, an installed copy or a link to a checkout of this skill).
- `python` = a Python 3.11+ interpreter. No pip packages are needed.
- The bridge finds Codex as `codex.exe` on PATH, the native binary behind an npm `codex.cmd` shim, or the Codex desktop app's CLI under `%LOCALAPPDATA%\OpenAI\Codex\bin\` (the app keeps it in per-version folders, `bin\<hash>\codex.exe`; the newest is used). To pin one, set `CODEX_BRIDGE_COMMAND` to a JSON array whose first item is the absolute executable.
- The elevated Windows sandbox runs commands as separate local accounts (group `CodexSandboxUsers`), which cannot start programs installed in your user profile ("Access is denied"), such as a per-user Python. With the default `CODEX_BRIDGE_WORKER_CHECKS=auto` the bridge checks the `validation_command` program and lets the worker run tests only when the sandbox can start it. To let workers test with a per-user Python, grant the group read and run access to its folder once (reverse with `/remove CodexSandboxUsers`):

  ```powershell
  icacls "$env:LOCALAPPDATA\Programs\Python\Python312" /grant "CodexSandboxUsers:(OI)(CI)RX"
  ```

  The bridge always runs `validation_command` itself as well, outside the sandbox.

  Store-installed programs under `Program Files\WindowsApps` (for example, PowerShell `pwsh`) are also treated as unavailable to elevated sandbox workers, even if their folder ACL mentions the sandbox group. In `auto` mode workers skip checks that use these programs; the bridge's own validation outside the sandbox still runs them.

Codex only enforces its sandbox on Windows when `windows.sandbox` is configured. Workers run with `--ignore-user-config`, so the bridge always passes `windows.sandbox="elevated"` itself (override with `CODEX_BRIDGE_WINDOWS_SANDBOX=unelevated` or `mxc`). If the Windows sandbox has never been set up on the machine, every worker command is rejected as "blocked by policy" and the result shows `error_kind: sandbox_policy_rejected`; set the sandbox up once in Codex, or switch the mode, then rerun `doctor`. Never work around it by giving the worker full access.

Grok Build installed through npm cannot update itself on Windows (`grok update` fails with "program not found" because it cannot start `npm.cmd`); run the command it would run, `npm i -g @xai-official/grok`, then check `grok version`.

Install anything missing from official sources: [Git for Windows](https://git-scm.com/downloads/win), [Codex CLI](https://developers.openai.com/codex/cli), [Grok Build](https://docs.x.ai/build/overview).

## Verify the package (no provider contact)

```bash
python -B "$SKILL/scripts/setup.py" doctor --offline
python -B "$SKILL/scripts/setup.py" self-test
python -B -m unittest discover -s "$SKILL/tests"
```

## Sign in and verify

Sign in with `codex login` (ChatGPT, not an API key). For the fallback, `grok login`. Never ask for pasted tokens or read credential files.

```bash
python -B "$SKILL/scripts/setup.py" doctor          # Codex required, Grok reported
python -B "$SKILL/scripts/setup.py" doctor --require-grok
```

`doctor` checks: no API-key/base-URL overrides in the environment (`OPENAI_API_KEY`, `CODEX_API_KEY`, `OPENAI_BASE_URL`, ...), the Codex account type is `chatgpt`, and plan usage through `codex app-server`. It prints the plan type and usage percentages only, never emails, IDs or tokens. A plan with no five-hour window shows "five-hour not reported (trusted)" and is ready while the weekly window has capacity.

## Private runtime storage

Artifacts, worktrees, usage cache and handoff packages live in `~/.claude/delegate-to-codex-state/<installation-hash>/` (or `$CLAUDE_CONFIG_DIR/...`). A marker file prevents mixing installations. To follow a repository's shadow-workspace rule, set `DELEGATE_TO_CODEX_STATE_DIR` to a fresh absolute directory there (for example a folder in that repository's external workspace) and keep it set for every bridge command of that task. State inside any Git repository or inside the skill is refused.

New worktrees use `<state root>/wt/<10-character id>` to leave room for deep source trees under Windows path limits. The artifact records the path; preserved artifacts using the older `artifacts/codex/<task>-<stamp>/worktree` layout remain usable.

Never commit runtime state, provider directories, account configuration, session transcripts, logs or caches. Live worker output can contain private data even though no credentials ship with this skill.

Start assignments from `assets/task.template.json` (only task-specific fields; safety fields default correctly) and save the task outside the working repository.

Use optional `copy_ignored` to supply local inputs excluded from Git, such as `"copy_ignored": ["local.properties", "libs/", "private/*.json"]`. Paths and globs are relative to the primary repository checkout. All selected files and folders must be git-ignored; tracked paths, links/junctions, repository escapes, missing matches, overwrites in the worktree, and totals over 200 MB are refused. Copies are made before the worker starts and listed in the artifact. Ignore rules should also apply at the task's base commit so copied inputs stay outside the reviewed patch.

Optional `auto_continue` is an integer from 0 through 3 (default 0). It grants the worker's requested turns only after a segment changes the worktree fingerprint, up to that many automatic grants for the artifact. `max_extensions`, when present, further caps that count; manual grants retain their existing behavior. Each grant and outcome is recorded in `auto_continuations`. Without progress or available capacity, the result remains `EXTENSION_REQUESTED` for the lead.
