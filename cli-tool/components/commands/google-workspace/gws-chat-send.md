---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [resource] [method] [flags]
description: Google Chat: Send a message to a space.
---

# Google Workspace Chat Send

Execute Google Workspace Chat Send operations: $ARGUMENTS

## Prerequisites

- Google Workspace CLI (`gws`) must be installed
- Authentication configured: Run `gws auth status` to verify
- Review `gws chat-send --help` for all available commands

## Available Resources and Methods

# chat +send

> **PREREQUISITE:** Read `../gws-shared/SKILL.md` for auth, global flags, and security rules. If missing, run `gws generate-skills` to create it.

Send a message to a space

## Usage

```bash
gws chat +send --space <NAME> --text <TEXT>
```

## Flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--space` | ✓ | — | Space name (e.g. spaces/AAAA...) |
| `--text` | ✓ | — | Message text (plain text) |

## Examples

```bash
gws chat +send --space spaces/AAAAxxxx --text 'Hello team!'
```

## Tips

- Use 'gws chat spaces list' to find space names.
- For cards or threaded replies, use the raw API instead.

> [!CAUTION]
> This is a **write** command — confirm with the user before executing.

## See Also

- [gws-shared](../gws-shared/SKILL.md) — Global flags and auth
- [gws-chat](../gws-chat/SKILL.md) — All manage chat spaces and messages commands

## Usage

```bash
# List available resources and methods
gws chat-send --help

# Inspect method schema before calling
gws schema chat-send.<resource>.<method>

# Execute command with arguments
gws chat-send $ARGUMENTS
```

## Task

Execute the requested Chat Send operation: $ARGUMENTS

1. **Verify Prerequisites**
   - Check `gws` is installed: `gws --version`
   - Verify authentication: `gws auth status`
   - Review available commands: `gws chat-send --help`

2. **Inspect Method Schema**
   - Before calling any method, inspect its parameters
   - Use `gws schema` to understand required fields
   - Review parameter types and constraints

3. **Execute Operation**
   - Build command with appropriate flags
   - Use `--params` for query/path parameters
   - Use `--json` for request body
   - Handle pagination with `--max-results` or `--page-token`

4. **Error Handling**
   - Check command output for errors
   - Review API quotas and rate limits
   - Handle authentication issues
   - Retry transient failures

---

**License**: Apache License 2.0
**Source**: [Google Workspace CLI](https://github.com/googleworkspace/cli)
**Original Skill**: `gws-chat-send`
