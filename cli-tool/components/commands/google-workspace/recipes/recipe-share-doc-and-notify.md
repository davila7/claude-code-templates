---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-parameters]
description: Share a Google Docs document with edit access and email collaborators the link.
---

# Share Doc And Notify

Execute Google Workspace workflow: $ARGUMENTS

# Share a Google Doc and Notify Collaborators

> **PREREQUISITE:** Load the following skills to execute this recipe: `gws-drive`, `gws-docs`, `gws-gmail`

Share a Google Docs document with edit access and email collaborators the link.

## Steps

1. Find the doc: `gws drive files list --params '{"q": "name contains '\''Project Brief'\'' and mimeType = '\''application/vnd.google-apps.document'\''"}'`
2. Share with editor access: `gws drive permissions create --params '{"fileId": "DOC_ID"}' --json '{"role": "writer", "type": "user", "emailAddress": "reviewer@company.com"}'`
3. Email the link: `gws gmail +send --to reviewer@company.com --subject 'Please review: Project Brief' --body 'I have shared the project brief with you: https://docs.google.com/document/d/DOC_ID'`

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
**Original Skill**: `recipe-share-doc-and-notify`
