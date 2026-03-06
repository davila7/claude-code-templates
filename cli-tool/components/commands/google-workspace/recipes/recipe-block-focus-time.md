---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-parameters]
description: Create recurring focus time blocks on Google Calendar to protect deep work hours.
---

# Block Focus Time

Execute Google Workspace workflow: $ARGUMENTS

# Block Focus Time on Google Calendar

> **PREREQUISITE:** Load the following skills to execute this recipe: `gws-calendar`

Create recurring focus time blocks on Google Calendar to protect deep work hours.

## Steps

1. Create recurring focus block: `gws calendar events insert --params '{"calendarId": "primary"}' --json '{"summary": "Focus Time", "description": "Protected deep work block", "start": {"dateTime": "2025-01-20T09:00:00", "timeZone": "America/New_York"}, "end": {"dateTime": "2025-01-20T11:00:00", "timeZone": "America/New_York"}, "recurrence": ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"], "transparency": "opaque"}'`
2. Verify it shows as busy: `gws calendar +agenda`

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
**Original Skill**: `recipe-block-focus-time`
