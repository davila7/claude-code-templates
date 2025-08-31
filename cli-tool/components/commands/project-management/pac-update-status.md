---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [ticket-id] | --status | --assignee | --comment
description: Update PAC ticket status and track progress in Product as Code workflow
model: sonnet
---

# Update PAC Ticket Status

Update ticket status and track progress in Product as Code workflow: **$ARGUMENTS**

## PAC Environment Check

- PAC directory: !`ls -la .pac/ 2>/dev/null || echo "No .pac directory found"`
- Active tickets: !`find .pac/tickets/ -name "*.yaml" 2>/dev/null | wc -l`
- Recent updates: !`find .pac/tickets/ -name "*.yaml" -mtime -7 2>/dev/null | wc -l`

## Task

Update PAC ticket status and track development progress:

**Arguments**:
- --ticket <ticket-id>: Ticket ID to update (or select interactively)
- --status <status>: New status (backlog/in-progress/review/blocked/done/cancelled)
- --assignee <assignee>: Update assignee
- --comment <comment>: Add progress comment
- --epic <epic-id>: Filter tickets by epic for selection

**Status Update Process**:
1. Validate PAC environment and locate ticket
2. Load current ticket state and validate status transitions
3. Update ticket YAML with new status and timestamp
4. Handle status-specific actions (branch creation, PR suggestions)
5. Update parent epic with ticket progress
6. Generate status update summary with next actions

**Valid Status Transitions**: backlog→in-progress→review→done, with blocked/cancelled as intermediate states.

**Git Integration**: Suggests branch creation for in-progress, PR creation for review, and merge for done status.
