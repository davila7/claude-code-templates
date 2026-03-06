---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-parameters]
description: Review your Google Calendar week, identify gaps, and add events to fill them.
---

# Plan Weekly Schedule

Execute Google Workspace workflow: $ARGUMENTS

# Plan Your Weekly Google Calendar Schedule

> **PREREQUISITE:** Load the following skills to execute this recipe: `gws-calendar`

Review your Google Calendar week, identify gaps, and add events to fill them.

## Steps

1. Check this week's agenda: `gws calendar +agenda`
2. Check free/busy for the week: `gws calendar freebusy query --json '{"timeMin": "2025-01-20T00:00:00Z", "timeMax": "2025-01-25T00:00:00Z", "items": [{"id": "primary"}]}'`
3. Add a new event: `gws calendar +insert --summary 'Deep Work Block' --start '2025-01-21T14:00' --duration 120`
4. Review updated schedule: `gws calendar +agenda`

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
**Original Skill**: `recipe-plan-weekly-schedule`
