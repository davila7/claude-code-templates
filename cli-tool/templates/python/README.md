# Python Template

See [CLAUDE.md](CLAUDE.md) for the Python development guidance.

## Permissions and command logging

Review [`.claude/settings.json`](.claude/settings.json) before using this template.
It does not grant blanket `Bash` approval. The existing command-prefix rules
(for example, `Bash(python:*)` and `Bash(pip:*)`) still pre-approve those tools;
they can run arbitrary project scripts or code. Narrow or remove rules you do
not trust. Other commands follow Claude Code's effective permissions and mode,
including any user or managed settings. These rules are not a sandbox; see
[Claude Code's permission documentation](https://code.claude.com/docs/en/permissions).

The template includes a **PreToolUse** Bash hook configured to append command
text and descriptions to `~/.claude/bash-command-log.txt` using `jq`. When
enabled, it runs before the tool call, so the log is not proof of successful
execution. Commands may contain secrets; the log is plain text, shared across
projects, and has no template-configured rotation. To disable future logging,
remove the `hooks.PreToolUse` entry whose command contains
`bash-command-log.txt`. Disabling the hook does not remove existing log data.

Existing projects are not migrated automatically: remove bare `"Bash"` from
their `.claude/settings.json` allow list and review `/permissions` for broader
approvals in other settings files.
