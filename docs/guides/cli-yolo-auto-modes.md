# AI CLI Auto/YOLO Mode Configuration Guide

Complete reference for configuring auto-approval (YOLO) mode across all major AI coding CLIs. Each CLI has its own mechanism for bypassing permission prompts to enable autonomous operation.

## Quick Reference

| CLI | YOLO Flag | Config Setting | Config File |
|---|---|---|---|
| **Claude Code** | `--dangerously-skip-permissions` | N/A (flag only) | `~/.claude/settings.json` |
| **Kimi** | `--yolo` / `-y` | `default_yolo = true` | `~/.kimi/config.toml` |
| **Codex (OpenAI)** | `--dangerously-bypass-approvals-and-sandbox` | `approval_policy = "never"` + `sandbox_mode = "danger-full-access"` | `~/.codex/config.toml` |
| **Vibe (Mistral)** | `--agent auto-approve` | `default_agent = "auto-approve"` | `~/.vibe/config.toml` |
| **Abacus AI** | `--permission-mode yolo` | Alias in shell | `~/.zshrc` or `~/.bashrc` |
| **OpenCode** | `--dangerously-skip-permissions` (run subcmd) | `"permission": "allow"` | `~/.config/opencode/opencode.json` |

---

## Claude Code

```bash
# One-shot YOLO mode
claude --dangerously-skip-permissions "task description"

# Or via settings.json allowlist
# ~/.claude/settings.json → add tool patterns to "allow" array
```

**Notes:**
- Flag only, no persistent config option for this flag
- Use `allowedTools` in settings.json for persistent granular permissions

---

## Kimi (Kimi Code / Moonshot)

### CLI Flags

```bash
# YOLO mode - auto-approve tools, AI can still ask questions
kimi --yolo
kimi -y
kimi --yes
kimi --auto-approve

# AFK mode - auto-approve tools AND auto-dismiss questions
kimi --afk

# Print mode - non-interactive, auto-approve everything
kimi --print

# Combine with prompt for one-shot
kimi --yolo --prompt "refactor all API handlers"
kimi --afk --prompt "run tests and fix failures"
```

### Persistent Config (`~/.kimi/config.toml`)

```toml
default_yolo = true
```

### Runtime Slash Commands

- `/yolo` - toggle YOLO on/off
- `/afk` - toggle AFK on/off

### Mode Hierarchy

| Mode | Tool Approvals | AskUserQuestion | Interactive |
|---|---|---|---|
| Normal | Required | Shown | Yes |
| YOLO (`-y`) | Auto-approved | Shown | Yes |
| AFK | Auto-approved | Auto-dismissed | Yes |
| Print | Auto-approved | Auto-dismissed | No |

---

## Codex (OpenAI)

### CLI Flags

```bash
# Interactive mode - set approval + sandbox
codex -a never -s danger-full-access "task"

# Non-interactive mode (exec)
codex exec --dangerously-bypass-approvals-and-sandbox "task"

# Using a profile
codex -p full-access-controlled "task"
```

### Persistent Config (`~/.codex/config.toml`)

```toml
# Full YOLO mode
approval_policy = "never"
sandbox_mode = "danger-full-access"

# Optional: trust specific project directories
[projects."/path/to/project"]
trust_level = "trusted"
```

### Approval Policy Values

| Value | Behavior |
|---|---|
| `suggest` | Ask for approval on every command |
| `auto-edit` | Auto-approve file edits, ask for shell commands |
| `on-request` | Model decides when to ask |
| `never` | Never ask for approval (YOLO) |

### Sandbox Mode Values

| Value | Behavior |
|---|---|
| `read-only` | Read-only filesystem access |
| `workspace-write` | Write only in project directory |
| `danger-full-access` | Full filesystem access (YOLO) |

### Profiles

```toml
[profiles.auto-workspace]
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[profiles.full-access-controlled]
approval_policy = "never"
sandbox_mode = "danger-full-access"
```

Use with: `codex -p full-access-controlled "task"`

---

## Vibe (Mistral)

### CLI Flags

```bash
# Programmatic mode - auto-approves everything by default
vibe -p "refactor the auth module"

# Interactive with auto-approve agent
vibe --agent auto-approve

# Trust working directory (non-interactive)
vibe --trust -p "run tests"
```

### Persistent Config (`~/.vibe/config.toml`)

```toml
# Set auto-approve as default agent
default_agent = "auto-approve"

# Or set bypass flag directly
bypass_tool_permissions = true
```

### Per-Tool Permissions

```toml
[tools.bash]
permission = "always"

[tools.write_file]
permission = "always"

[tools.search_replace]
permission = "always"

[tools.read_file]    # already "always" by default
[tools.grep]         # already "always" by default
```

### Built-in Agents

| Agent | Safety | Behavior |
|---|---|---|
| `default` | NEUTRAL | Requires approval for tools |
| `plan` | SAFE | Read-only, exploration/planning |
| `accept-edits` | DESTRUCTIVE | Auto-approves file edits only |
| `auto-approve` | YOLO | Auto-approves all tools |

### Environment Variable

```bash
VIBE_BYPASS_TOOL_PERMISSIONS=true vibe
```

---

## Abacus AI

### CLI Flags

```bash
# YOLO mode
abacusai --permission-mode yolo

# Skip all permission checks (equivalent)
abacusai --dangerously-skip-permissions

# Auto-accept edits only
abacusai --auto-accept-edits

# Plan mode
abacusai --plan-mode
```

### Shell Alias (Persistent)

Add to `~/.zshrc` or `~/.bashrc`:

```bash
alias abacus='abacusai --permission-mode yolo'
alias abacusai='abacusai --permission-mode yolo'
```

### Permission Mode Values

| Mode | Behavior |
|---|---|
| `normal` | Ask for all approvals |
| `accept-edits` | Auto-accept file edits |
| `yolo` | Auto-approve everything |
| `plan` | Read-only planning mode |

### Full Options

```bash
abacusai --help

Options:
  --auto-accept-edits             Automatically accept edits
  --dangerously-skip-permissions  Skip permission checks
  --plan-mode                     Enable plan mode
  --permission-mode <mode>        Permission mode: normal, accept-edits, yolo, plan
  --allowed-tools <pattern>       Auto-allow tool patterns (repeatable)
  --disallowed-tools <pattern>    Auto-deny tool patterns (repeatable)
  --add-dir <path>                Additional allowed directory (repeatable)
```

---

## OpenCode

### CLI Flags

```bash
# Non-interactive mode - auto-approves all permissions
opencode run --dangerously-skip-permissions "task description"

# Non-interactive with specific output
opencode -p "explain this code" -f json
```

### Persistent Config (`~/.config/opencode/opencode.json`)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": "allow"
}
```

Or granular per-tool:

```json
{
  "permission": {
    "bash": "allow",
    "edit": "allow",
    "write": "allow",
    "read": "allow"
  }
}
```

### Environment Variable

```bash
OPENCODE_PERMISSION='{"bash":"allow","edit":"allow","write":"allow"}' opencode
```

### Non-Interactive Mode

```bash
# All permissions auto-approved in non-interactive mode
opencode -p "your task"

# With JSON output
opencode -p "your task" -f json

# Quiet mode (no spinner)
opencode -p "your task" -q
```

**Note:** OpenCode's original GitHub repo (`opencode-ai/opencode`) has been archived and continued as **Crush** by the Charm team. The installed version from `opencode.ai` (by AnomalyCo) is the actively maintained fork.

---

## Security Considerations

All YOLO/auto modes disable safety prompts. Only use them when:

1. The environment is sandboxed (Docker, VM, CI)
2. You fully trust the project directory
3. You understand the tool can execute arbitrary commands

For production use, prefer granular permissions over full YOLO mode. Most CLIs support per-tool or per-pattern allowlists for safer autonomous operation.
