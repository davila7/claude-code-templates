---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-parameters]
description: Find Gmail messages matching a query and export them for review.
---

# Search And Export Emails

Execute Google Workspace workflow: $ARGUMENTS

# Search and Export Emails

> **PREREQUISITE:** Load the following skills to execute this recipe: `gws-gmail`

Find Gmail messages matching a query and export them for review.

## Steps

1. Search for emails: `gws gmail users messages list --params '{"userId": "me", "q": "from:client@example.com after:2024/01/01"}'`
2. Get full message: `gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID"}'`
3. Export results: `gws gmail users messages list --params '{"userId": "me", "q": "label:project-x"}' --format json > project-emails.json`

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
**Original Skill**: `recipe-search-and-export-emails`
