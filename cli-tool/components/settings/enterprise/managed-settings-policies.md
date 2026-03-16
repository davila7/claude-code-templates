# Enterprise Setup: Managed Settings & Policies

Configure organization-wide settings delivered via Anthropic's server-managed settings (Teams/Enterprise plans).

These settings are applied automatically to all users in your organization.

---

## How It Works

1. Admins configure settings in the Anthropic Console
2. Settings are fetched by Claude Code at startup and polled hourly
3. Settings apply uniformly across all org members
4. Users cannot override managed settings (they have highest priority)

---

## Permission Policies

### Block dangerous operations

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force *)",
      "Bash(git reset --hard *)",
      "Bash(curl * | bash)",
      "Bash(wget * | bash)",
      "Bash(chmod 777 *)"
    ]
  }
}
```

### Protect sensitive files

```json
{
  "permissions": {
    "deny": [
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/secrets/**)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Read(**/*.p12)",
      "Read(**/credentials*)",
      "Edit(.env)",
      "Edit(.env.*)",
      "Write(.env)",
      "Write(.env.*)"
    ]
  }
}
```

### Restrict network access

> **Note**: In Claude Code permissions, deny rules take priority over allow rules.
> The specific curl allows below work because they are more specific than the broad
> deny pattern. However, verify that your version of Claude Code supports this
> precedence model, as behavior may vary.

```json
{
  "permissions": {
    "deny": [
      "Bash(curl *)",
      "Bash(wget *)",
      "Bash(ssh *)",
      "Bash(scp *)",
      "WebFetch"
    ],
    "allow": [
      "Bash(curl localhost*)",
      "Bash(curl https://api.internal.corp.com/*)"
    ]
  }
}
```

### Restrict MCP tool access

```json
{
  "permissions": {
    "deny": [
      "mcp__*__delete_*",
      "mcp__*__drop_*",
      "mcp__*__create_*"
    ],
    "allow": [
      "mcp__github__*",
      "mcp__*__read_*",
      "mcp__*__search_*",
      "mcp__*__list_*"
    ]
  }
}
```

---

## Mode Restrictions

### Disable bypass permissions mode

Prevent users from running `--dangerously-skip-permissions`:

```json
{
  "disableBypassPermissionsMode": "disable"
}
```

### Restrict available permission modes

```json
{
  "allowedPermissionModes": ["default", "plan", "acceptEdits"]
}
```

This prevents users from using `bypassPermissions` or `dontAsk` modes.

---

## Model Restrictions

### Limit available models

```json
{
  "availableModels": ["sonnet", "haiku"]
}
```

This prevents users from selecting models not on the list (e.g., opus).

### Pin model versions

```json
{
  "env": {
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5@20251001"
  }
}
```

### Force a specific model

```json
{
  "env": {
    "ANTHROPIC_MODEL": "claude-sonnet-4-6"
  }
}
```

---

## Organization-Wide CLAUDE.md

Deploy coding standards to all users:

```json
{
  "claudeMd": "## Organization Standards\n\n- All code must pass linting before commit\n- Use approved logging framework only\n- No direct database queries in controllers\n- All API endpoints require authentication\n- PII must not be logged\n- Follow OWASP secure coding practices"
}
```

For longer rules, use a managed CLAUDE.md file:

```json
{
  "claudeMdUrl": "https://internal.corp.example.com/claude-standards.md"
}
```

---

## Hook Policies

### Require audit logging for all users

> **Note**: The log path below requires write access. Ensure the directory exists
> and the user running Claude Code has write permissions. For non-root users,
> consider using `~/.claude/audit.jsonl` or a path under `/tmp/` instead.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -c '{ts: (now|todate), user: env.USER, cmd: .tool_input.command}' >> /var/log/claude-audit.jsonl"
          }
        ]
      }
    ]
  }
}
```

### Block specific operations with verification

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/opt/corp/claude-policy/validate-command.sh"
          }
        ]
      }
    ]
  }
}
```

---

## Analytics & Monitoring

### Enable usage analytics

```json
{
  "analytics": {
    "enabled": true,
    "endpoint": "https://analytics.corp.example.com/claude"
  }
}
```

---

## Complete Example: Conservative Enterprise Policy

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force *)",
      "Bash(git reset --hard *)",
      "Bash(curl * | bash)",
      "Bash(wget * | bash)",
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/secrets/**)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Edit(.env*)",
      "Write(.env*)"
    ]
  },
  "disableBypassPermissionsMode": "disable",
  "allowedPermissionModes": ["default", "plan", "acceptEdits"],
  "availableModels": ["sonnet", "haiku"],
  "env": {
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5@20251001"
  },
  "claudeMd": "## Corporate Policy\n- All code changes require tests\n- No PII in logs\n- Follow OWASP secure coding practices\n- Use approved dependencies only",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -c '{ts: (now|todate), user: env.USER, cmd: .tool_input.command}' >> /var/log/claude-audit.jsonl"
          }
        ]
      }
    ]
  }
}
```

---

## Complete Example: Permissive Enterprise Policy

For teams that need more autonomy with basic guardrails:

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf /)",
      "Bash(curl * | bash)",
      "Read(.env)",
      "Read(**/secrets/**)"
    ]
  },
  "disableBypassPermissionsMode": "disable",
  "claudeMd": "## Team Guidelines\n- Run tests before committing\n- Follow existing code patterns"
}
```

---

## Settings Priority

From highest to lowest:

1. **Managed settings** (this template) - admins control, users cannot override
2. **Project settings** (`.claude/settings.json`) - team-shared
3. **User settings** (`~/.claude/settings.json`) - personal
4. **Local settings** (`.claude/settings.local.json`) - machine-specific

---

## Tips

- Start with a minimal policy and add restrictions as needed
- Test policies with a small group before rolling out org-wide
- Security-sensitive hooks (shell commands, env vars) require user approval on first use
- Settings are cached locally so Claude Code works during brief API outages
- Use `claude --debug` to see which managed settings are applied
- Changes to managed settings propagate within 1 hour (polled hourly)
