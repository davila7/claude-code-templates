---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [resource] [method] [flags]
description: Google Sheets: Read values from a spreadsheet.
---

# Google Workspace Sheets Read

Execute Google Workspace Sheets Read operations: $ARGUMENTS

## Prerequisites

- Google Workspace CLI (`gws`) must be installed
- Authentication configured: Run `gws auth status` to verify
- Review `gws sheets-read --help` for all available commands

## Available Resources and Methods

# sheets +read

> **PREREQUISITE:** Read `../gws-shared/SKILL.md` for auth, global flags, and security rules. If missing, run `gws generate-skills` to create it.

Read values from a spreadsheet

## Usage

```bash
gws sheets +read --spreadsheet <ID> --range <RANGE>
```

## Flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--spreadsheet` | ✓ | — | Spreadsheet ID |
| `--range` | ✓ | — | Range to read (e.g. 'Sheet1!A1:B2') |

## Examples

```bash
gws sheets +read --spreadsheet ID --range 'Sheet1!A1:D10'
gws sheets +read --spreadsheet ID --range Sheet1
```

## Tips

- Read-only — never modifies the spreadsheet.
- For advanced options, use the raw values.get API.

## See Also

- [gws-shared](../gws-shared/SKILL.md) — Global flags and auth
- [gws-sheets](../gws-sheets/SKILL.md) — All read and write spreadsheets commands

## Usage

```bash
# List available resources and methods
gws sheets-read --help

# Inspect method schema before calling
gws schema sheets-read.<resource>.<method>

# Execute command with arguments
gws sheets-read $ARGUMENTS
```

## Task

Execute the requested Sheets Read operation: $ARGUMENTS

1. **Verify Prerequisites**
   - Check `gws` is installed: `gws --version`
   - Verify authentication: `gws auth status`
   - Review available commands: `gws sheets-read --help`

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
**Original Skill**: `gws-sheets-read`
