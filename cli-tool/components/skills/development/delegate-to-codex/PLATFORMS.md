# Platforms: Windows and macOS

This skill is built and tested on native Windows. On macOS (or Linux), port a copy before relying on it.

## Porting to macOS

1. Work on a copy of the skill (for example a `macos/` folder next to it) and leave the Windows files
   unchanged, so both versions can be compared and kept in step.
2. Windows-specific parts to replace or check:
   - Codex discovery: `find_codex` in `src/claude_codex_bridge/codexcli.py` looks for `codex.exe`
     (PATH, npm shim, `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\`).
   - Sandbox: the bridge passes `windows.sandbox="elevated"`. The `CodexSandboxUsers` group, the
     `icacls` fix and `sandbox_can_run` in `bridge.py` are Windows-only.
   - Worker checks: `CODEX_BRIDGE_WORKER_CHECKS=auto` runs worker tests off Windows. Confirm that the
     Codex sandbox can start the Python used in `validation_command`.
   - Paths and shells: PowerShell examples and `\` paths in the docs.
   - Python 3.11+ and Git must be installed.
3. Run the tests, `scripts/setup.py self-test` and `doctor` from the ported copy, plus one small live
   task, before relying on it.
4. Install the ported copy as `~/.claude/skills/delegate-to-codex`.
