# delegate-to-codex

Claude leads; Codex writes the code. Claude settles requirements and scope, writes one task file, and reviews and accepts the result. Bounded Codex CLI workers, running on your ChatGPT subscription, implement in their own Git worktrees and sandboxes. Grok Build can continue a task only after Codex's usage window is confirmed exhausted.

The point is to spend Claude's tokens on judgment instead of typing:

- **Compact reports.** Claude reads a short report with a per-file diff summary, not transcripts or whole diffs. After a correction, only that round's changes are shown.
- **Independent validation.** The bridge runs your test command itself, outside the worker's sandbox, and checks that only the allowed files changed.
- **One-command integration.** `accept` applies the reviewed patch to your checkout (it never commits) and removes the worker's worktree and branch. `revise` sends findings back to the same Codex session.
- **Parallel workers.** Independent tasks with non-overlapping files can run at the same time; the lead decides how many.
- **Subscription only.** API-key billing is refused.

## Requirements

Claude Code on native Windows (see `PLATFORMS.md` for macOS), Python 3.11+, Git, and the Codex CLI signed in with a ChatGPT plan. Grok Build is optional. No pip packages are needed.

## Getting started

Install the skill, then ask Claude Code to use the delegate-to-codex skill and run its first-use setup: `scripts/setup.py self-test` (offline) and `doctor` (checks Codex sign-in and capacity without generating model work). The workflow is in `SKILL.md`; setup details are in `references/setup.md`.

Runtime state lives outside every Git repository, in `~/.claude/delegate-to-codex-state/` by default. No accounts, credentials or sessions are included.

## License

MIT, see `LICENSE.txt`.
