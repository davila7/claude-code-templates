---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [ticket-name] | --epic | --type | --assignee | --priority
description: Create new PAC ticket within an epic following Product as Code specification
model: sonnet
---

# Create PAC Ticket

Create a new ticket within an epic following Product as Code specification: **$ARGUMENTS**

## PAC Configuration Check

- PAC directory: !`ls -la .pac/ 2>/dev/null || echo "No .pac directory found"`
- PAC config: @.pac/pac.config.yaml (if exists)
- Available epics: !`ls -la .pac/epics/ 2>/dev/null | head -10`

## Task

Create a new Product as Code ticket within an existing epic:

**Arguments**:
- Ticket name (required if not using --name flag)
- --epic <epic-id>: Parent epic ID (required)
- --type <type>: Ticket type (feature/bug/task/spike)
- --assignee <assignee>: Assigned developer
- --priority <priority>: Priority level
- --create-branch: Automatically create git branch

**Ticket Creation Process**:
1. Validate PAC configuration exists (suggest `/project:pac-configure` if missing)
2. Select or validate parent epic
3. Generate unique ticket ID and sequence number
4. Create ticket YAML file following PAC v0.1.0 specification in `.pac/tickets/[ticket-id].yaml`
5. Include required metadata: id, name, epic, created timestamp, assignee
6. Add spec with description, type, status, priority, acceptance criteria, tasks
7. Link ticket to parent epic
8. Create git branch if requested

If information is missing, prompt user interactively for ticket details.

**Next Steps**: Use `/project:pac-update-status` to track ticket progress.
