---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [resource] [method] [flags]
description: Manage Google Groups settings.
---

# Google Workspace Groupssettings

Execute Google Workspace Groupssettings operations: $ARGUMENTS

## Prerequisites

- Google Workspace CLI (`gws`) must be installed
- Authentication configured: Run `gws auth status` to verify
- Review `gws groupssettings --help` for all available commands

## Available Resources and Methods

# groupssettings (v1)

> **PREREQUISITE:** Read `../gws-shared/SKILL.md` for auth, global flags, and security rules. If missing, run `gws generate-skills` to create it.

```bash
gws groupssettings <resource> <method> [flags]
```

## API Resources

### groups

  - `get` — Gets one resource by id.
  - `patch` — Updates an existing resource. This method supports patch semantics.
  - `update` — Updates an existing resource.

## Discovering Commands

Before calling any API method, inspect it:

```bash
# Browse resources and methods
gws groupssettings --help

# Inspect a method's required params, types, and defaults
gws schema groupssettings.<resource>.<method>
```

Use `gws schema` output to build your `--params` and `--json` flags.

## Usage

```bash
# List available resources and methods
gws groupssettings --help

# Inspect method schema before calling
gws schema groupssettings.<resource>.<method>

# Execute command with arguments
gws groupssettings $ARGUMENTS
```

## Task

Execute the requested Groupssettings operation: $ARGUMENTS

1. **Verify Prerequisites**
   - Check `gws` is installed: `gws --version`
   - Verify authentication: `gws auth status`
   - Review available commands: `gws groupssettings --help`

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
**Original Skill**: `gws-groupssettings`
