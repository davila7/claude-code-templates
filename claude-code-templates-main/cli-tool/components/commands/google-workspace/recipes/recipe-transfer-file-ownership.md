---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-parameters]
description: Transfer ownership of Google Drive files from one user to another.
---

# Transfer File Ownership

Execute Google Workspace workflow: $ARGUMENTS

# Transfer File Ownership

> **PREREQUISITE:** Load the following skills to execute this recipe: `gws-drive`

Transfer ownership of Google Drive files from one user to another.

> [!CAUTION]
> Transferring ownership is irreversible without the new owner's cooperation.

## Steps

1. List files owned by the user: `gws drive files list --params '{"q": "'\''user@company.com'\'' in owners"}'`
2. Transfer ownership: `gws drive permissions create --params '{"fileId": "FILE_ID", "transferOwnership": true}' --json '{"role": "owner", "type": "user", "emailAddress": "newowner@company.com"}'`

## Task

Execute this workflow with the following parameters: $ARGUMENTS

1. **Prerequisites Check**
   - Verify `gws` CLI is installed: `gws --version`
   - Confirm authentication: `gws auth status`
   - Load required GWS skills (check PREREQUISITE section above)

2. **Parameter Preparation**
   - Parse task parameters from $ARGUMENTS
   - Validate required inputs
   - Prepare JSON payloads and flags

3. **Execute Workflow Steps**
   - Follow the steps outlined above
   - Replace placeholder IDs with actual values
   - Handle errors and retries
   - Log progress and results

4. **Verify Results**
   - Confirm each step completed successfully
   - Verify changes in Google Workspace
   - Report final status and any issues

## Tips

- Use `--dry-run` flag when available to preview changes
- Always inspect API schemas before calling: `gws schema <service>.<resource>.<method>`
- Check command help for all flags: `gws <service> <resource> <method> --help`

---

**License**: Apache License 2.0
**Source**: [Google Workspace CLI](https://github.com/googleworkspace/cli)
**Original Skill**: `recipe-transfer-file-ownership`
