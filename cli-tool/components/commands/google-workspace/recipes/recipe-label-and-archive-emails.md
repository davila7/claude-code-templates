---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-parameters]
description: Apply Gmail labels to matching messages and archive them to keep your inbox clean.
---

# Label And Archive Emails

Execute Google Workspace workflow: $ARGUMENTS

# Label and Archive Gmail Threads

> **PREREQUISITE:** Load the following skills to execute this recipe: `gws-gmail`

Apply Gmail labels to matching messages and archive them to keep your inbox clean.

## Steps

1. Search for matching emails: `gws gmail users messages list --params '{"userId": "me", "q": "from:notifications@service.com"}' --format table`
2. Apply a label: `gws gmail users messages modify --params '{"userId": "me", "id": "MESSAGE_ID"}' --json '{"addLabelIds": ["LABEL_ID"]}'`
3. Archive (remove from inbox): `gws gmail users messages modify --params '{"userId": "me", "id": "MESSAGE_ID"}' --json '{"removeLabelIds": ["INBOX"]}'`

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
**Original Skill**: `recipe-label-and-archive-emails`
