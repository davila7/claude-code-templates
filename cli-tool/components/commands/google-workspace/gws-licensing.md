---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [resource] [method] [flags]
description: Google Workspace Enterprise License Manager: Manage product licenses.
---

# Google Workspace Licensing

Execute Google Workspace Licensing operations: $ARGUMENTS

## Prerequisites

- Google Workspace CLI (`gws`) must be installed
- Authentication configured: Run `gws auth status` to verify
- Review `gws licensing --help` for all available commands

## Available Resources and Methods

# licensing (v1)

> **PREREQUISITE:** Read `../gws-shared/SKILL.md` for auth, global flags, and security rules. If missing, run `gws generate-skills` to create it.

```bash
gws licensing <resource> <method> [flags]
```

## API Resources

### licenseAssignments

  - `delete` — Revoke a license.
  - `get` — Get a specific user's license by product SKU.
  - `insert` — Assign a license.
  - `listForProduct` — List all users assigned licenses for a specific product SKU.
  - `listForProductAndSku` — List all users assigned licenses for a specific product SKU.
  - `patch` — Reassign a user's product SKU with a different SKU in the same product. This method supports patch semantics.
  - `update` — Reassign a user's product SKU with a different SKU in the same product.

## Discovering Commands

Before calling any API method, inspect it:

```bash
# Browse resources and methods
gws licensing --help

# Inspect a method's required params, types, and defaults
gws schema licensing.<resource>.<method>
```

Use `gws schema` output to build your `--params` and `--json` flags.

## Usage

```bash
# List available resources and methods
gws licensing --help

# Inspect method schema before calling
gws schema licensing.<resource>.<method>

# Execute command with arguments
gws licensing $ARGUMENTS
```

## Task

Execute the requested Licensing operation: $ARGUMENTS

1. **Verify Prerequisites**
   - Check `gws` is installed: `gws --version`
   - Verify authentication: `gws auth status`
   - Review available commands: `gws licensing --help`

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
**Original Skill**: `gws-licensing`
