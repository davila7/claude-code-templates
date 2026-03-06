---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-parameters]
description: Send a team announcement via both Gmail and a Google Chat space.
---

# Send Team Announcement

Execute Google Workspace workflow: $ARGUMENTS

# Announce via Gmail and Google Chat

> **PREREQUISITE:** Load the following skills to execute this recipe: `gws-gmail`, `gws-chat`

Send a team announcement via both Gmail and a Google Chat space.

## Steps

1. Send email: `gws gmail +send --to team@company.com --subject 'Important Update' --body 'Please review the attached policy changes.'`
2. Post in Chat: `gws chat +send --space spaces/TEAM_SPACE --text '📢 Important Update: Please check your email for policy changes.'`

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
**Original Skill**: `recipe-send-team-announcement`
