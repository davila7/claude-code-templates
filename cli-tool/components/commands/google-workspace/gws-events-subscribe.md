---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [resource] [method] [flags]
description: Google Workspace Events: Subscribe to Workspace events and stream them as NDJSON.
---

# Google Workspace Events Subscribe

Execute Google Workspace Events Subscribe operations: $ARGUMENTS

## Prerequisites

- Google Workspace CLI (`gws`) must be installed
- Authentication configured: Run `gws auth status` to verify
- Review `gws events-subscribe --help` for all available commands

## Available Resources and Methods

# events +subscribe

> **PREREQUISITE:** Read `../gws-shared/SKILL.md` for auth, global flags, and security rules. If missing, run `gws generate-skills` to create it.

Subscribe to Workspace events and stream them as NDJSON

## Usage

```bash
gws events +subscribe
```

## Flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--target` | — | — | Workspace resource URI (e.g., //chat.googleapis.com/spaces/SPACE_ID) |
| `--event-types` | — | — | Comma-separated CloudEvents types to subscribe to |
| `--project` | — | — | GCP project ID for Pub/Sub resources |
| `--subscription` | — | — | Existing Pub/Sub subscription name (skip setup) |
| `--max-messages` | — | 10 | Max messages per pull batch (default: 10) |
| `--poll-interval` | — | 5 | Seconds between pulls (default: 5) |
| `--once` | — | — | Pull once and exit |
| `--cleanup` | — | — | Delete created Pub/Sub resources on exit |
| `--no-ack` | — | — | Don't auto-acknowledge messages |
| `--output-dir` | — | — | Write each event to a separate JSON file in this directory |

## Examples

```bash
gws events +subscribe --target '//chat.googleapis.com/spaces/SPACE' --event-types 'google.workspace.chat.message.v1.created' --project my-project
gws events +subscribe --subscription projects/p/subscriptions/my-sub --once
gws events +subscribe ... --cleanup --output-dir ./events
```

## Tips

- Without --cleanup, Pub/Sub resources persist for reconnection.
- Press Ctrl-C to stop gracefully.

> [!CAUTION]
> This is a **write** command — confirm with the user before executing.

## See Also

- [gws-shared](../gws-shared/SKILL.md) — Global flags and auth
- [gws-events](../gws-events/SKILL.md) — All subscribe to google workspace events commands

## Usage

```bash
# List available resources and methods
gws events-subscribe --help

# Inspect method schema before calling
gws schema events-subscribe.<resource>.<method>

# Execute command with arguments
gws events-subscribe $ARGUMENTS
```

## Task

Execute the requested Events Subscribe operation: $ARGUMENTS

1. **Verify Prerequisites**
   - Check `gws` is installed: `gws --version`
   - Verify authentication: `gws auth status`
   - Review available commands: `gws events-subscribe --help`

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
**Original Skill**: `gws-events-subscribe`
