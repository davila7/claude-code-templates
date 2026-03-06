---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-parameters]
description: Find Gmail messages with attachments and save them to a Google Drive folder.
---

# Save Email Attachments

Execute Google Workspace workflow: $ARGUMENTS

# Save Gmail Attachments to Google Drive

> **PREREQUISITE:** Load the following skills to execute this recipe: `gws-gmail`, `gws-drive`

Find Gmail messages with attachments and save them to a Google Drive folder.

## Steps

1. Search for emails with attachments: `gws gmail users messages list --params '{"userId": "me", "q": "has:attachment from:client@example.com"}' --format table`
2. Get message details: `gws gmail users messages get --params '{"userId": "me", "id": "MESSAGE_ID"}'`
3. Download attachment: `gws gmail users messages attachments get --params '{"userId": "me", "messageId": "MESSAGE_ID", "id": "ATTACHMENT_ID"}'`
4. Upload to Drive folder: `gws drive +upload --file ./attachment.pdf --parent FOLDER_ID`

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
**Original Skill**: `recipe-save-email-attachments`
