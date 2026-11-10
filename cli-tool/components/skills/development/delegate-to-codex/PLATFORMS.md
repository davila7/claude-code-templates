# Platforms: Windows and macOS

This skill is built and tested on native Windows 10/11. On macOS (or Linux), port a copy before relying on it.

## Porting to macOS

1. Work on a copy of the skill (for example a `macos/` folder next to it) and leave the Windows files
   unchanged, so both versions can be compared and kept in step.
2. Windows-specific parts to replace or check:
   - Codex discovery: `find_codex` in `src/claude_codex_bridge/codexcli.py` already accepts a plain `codex`
     on PATH and the native binary behind an npm `codex.cmd` shim; only the
     `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe` lookup (the Codex desktop app) is Windows-specific.
   - Sandbox: the bridge passes `windows.sandbox="elevated"`. The `CodexSandboxUsers` group, the
     `icacls` fix and `sandbox_can_run` in `bridge.py` are Windows-only.
   - Worker checks: `CODEX_BRIDGE_WORKER_CHECKS=auto` runs worker tests off Windows. Confirm that the
     Codex sandbox can start the Python used in `validation_command`.
   - Process control: `src/claude_codex_bridge/process.py` kills a Windows worker with a
     kill-on-close job object (and `taskkill` as a fallback); the POSIX branch signals the process group.
     Test the POSIX branch before relying on it.
   - Lock staleness: `process_start_token` in `gitops.py` reads the process creation time on Windows and `/proc/<pid>/stat` on Linux, and returns nothing on macOS. There `pid_is_running` trusts the process id alone, so a recycled id can make a stale task lock look active. Add a macOS start token (for example from `ps -o lstart=`) when porting.
   - Links and permissions: junction and reparse-point detection (`revision.py`) and the state-folder
     permission report (`state.py`, which reads ACLs with `icacls`) are written for Windows; POSIX uses
     symlink checks and mode bits.
   - Environment scrubbing: the allow list in `bridge.py` (`ENV_ALLOW`) holds Windows variable names; add
     the POSIX ones your toolchain needs, or the validation command will not find its tools.
   - Paths and shells: PowerShell examples and `\` paths in the docs.
   - Platform gate: `doctor` in `scripts/setup.py` marks every platform except Windows `setup_required`
     (the `platform` check, and its Windows-only Git install hint). Update that check once the port is
     verified, or `doctor` will never report ready on macOS or Linux.
   - Python 3.11+ and Git must be installed.
3. Run `scripts/setup.py self-test` and `doctor` from the ported copy (and the unit tests, if your copy
   includes a `tests` folder), plus one small live task, before relying on it.
4. Install the ported copy as `~/.claude/skills/delegate-to-codex`.
