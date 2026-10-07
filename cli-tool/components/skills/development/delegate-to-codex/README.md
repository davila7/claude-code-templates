# delegate-to-codex

Claude leads; Codex writes the code. Claude settles requirements and scope, writes one task file, and reviews and accepts the result. Bounded Codex CLI workers, running on your ChatGPT subscription, implement in their own Git worktrees and sandboxes.

The point is to spend Claude's tokens on judgment instead of typing:

- **Compact reports.** Claude reads a short report with a per-file diff summary, not transcripts or whole diffs. After a correction, only that round's changes are shown.
- **Independent validation.** The bridge runs your test command itself, outside the worker's sandbox, and checks that only the allowed files changed. That command runs worker-written code as your user, like CI would; see [safety](references/safety.md).
- **Reviewed patch only.** `accept` applies the patch Claude reviewed (it can be pinned by tree id and checksum) to your checkout and removes the worker's worktree and branch. It never commits. `revise` sends findings back to the same Codex session.
- **Parallel workers.** Independent tasks with non-overlapping files can run at the same time; the lead decides how many.
- **Subscription only.** API-key billing is refused.
- **Auto-review is your choice.** Codex can route a worker's sandbox-boundary approval requests to a reviewer model ("Approve for me") instead of refusing them. The bridge asks once and never turns it on by itself; it does not widen the sandbox. See [safety](references/safety.md#auto-review).

## Requirements

Windows 10/11 with Claude Code, Python 3.11+, Git, and the Codex CLI signed in with a ChatGPT plan. No pip packages are needed. `PLATFORMS.md` lists what a macOS port needs.

## Getting started

Install the skill, then ask Claude Code to use the delegate-to-codex skill and run its first-use setup. To run the checks yourself, set `SKILL` to the skill's folder (for example `~/.claude/skills/delegate-to-codex`):

```bash
python -B "$SKILL/scripts/setup.py" self-test
python -B "$SKILL/scripts/setup.py" doctor --offline
python -B "$SKILL/scripts/setup.py" doctor
```

The first two work without Codex. `doctor` then checks the Codex sign-in and capacity without generating model work. `setup_required` means a check failed or capacity is exhausted; the output names what to do. The other statuses are `passed`, `installation_ready` and `codex_ready`.

The first launch also needs a one-time auto-review choice from you. The bridge never prompts: until it is recorded, a launch answers `settings_required` (exit 4) with the question and the command that records it, and Claude (or the standalone repository's installer) asks you. For example `python -B "$SKILL/scripts/codex_bridge.py" settings set auto-review off`. `settings show` prints the current choice.

## Documentation

- `SKILL.md`: the workflow Claude follows (assign, run, review, capacity) and the exit codes.
- `references/setup.md`: setup, environment variables, doctor statuses, user settings, runtime state.
- `references/task-file.md`: every task field, default and limit; the four modes.
- `references/example.md`: one small change from task file to accepted patch.
- `references/results.md`: exit codes, statuses, the `settings_required` result, the lifecycle and the report and record fields.
- `references/codex-workflow.md`: what to do in each state, extensions, capacity, killed runs.
- `references/safety.md`: validation as your user, environment scrubbing, auto-review, what the bridge guards.
- `references/routing-policy.md`: when to delegate and how deeply to review.

Runtime state lives outside every Git repository, in `~/.claude/delegate-to-codex-state/` by default. No accounts, credentials or sessions are included.

## License

MIT, see `LICENSE.txt`.
