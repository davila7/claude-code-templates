---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-parameters]
description: Create a Google Form for feedback and share it via Gmail.
---

# Create Feedback Form

Execute Google Workspace workflow: $ARGUMENTS

# Create and Share a Google Form

> **PREREQUISITE:** Load the following skills to execute this recipe: `gws-forms`, `gws-gmail`

Create a Google Form for feedback and share it via Gmail.

## Steps

1. Create form: `gws forms forms create --json '{"info": {"title": "Event Feedback", "documentTitle": "Event Feedback Form"}}'`
2. Get the form URL from the response (responderUri field)
3. Email the form: `gws gmail +send --to attendees@company.com --subject 'Please share your feedback' --body 'Fill out the form: FORM_URL'`

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
**Original Skill**: `recipe-create-feedback-form`
