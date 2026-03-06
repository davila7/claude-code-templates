---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-parameters]
description: Read content from a Google Doc and use it as the body of a Gmail message.
---

# Draft Email From Doc

Execute Google Workspace workflow: $ARGUMENTS

# Draft a Gmail Message from a Google Doc

> **PREREQUISITE:** Load the following skills to execute this recipe: `gws-docs`, `gws-gmail`

Read content from a Google Doc and use it as the body of a Gmail message.

## Steps

1. Get the document content: `gws docs documents get --params '{"documentId": "DOC_ID"}'`
2. Copy the text from the body content
3. Send the email: `gws gmail +send --to recipient@example.com --subject 'Newsletter Update' --body 'CONTENT_FROM_DOC'`

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
**Original Skill**: `recipe-draft-email-from-doc`
