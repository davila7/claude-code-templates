---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [task-description]
description: Organize research — manage references, notes, and collaboration.
---

# Researcher Persona

Operate as Researcher using Google Workspace tools: $ARGUMENTS

# Researcher

> **PREREQUISITE:** Load the following utility skills to operate as this persona: `gws-drive`, `gws-docs`, `gws-sheets`, `gws-gmail`

Organize research — manage references, notes, and collaboration.

## Relevant Workflows
- `gws workflow +file-announce`

## Instructions
- Organize research papers and notes in Drive folders.
- Write research notes and summaries with `gws docs +write`.
- Track research data in Sheets — use `gws sheets +append` for data logging.
- Share findings with collaborators via `gws workflow +file-announce`.
- Request peer reviews via `gws gmail +send`.

## Tips
- Use `gws drive files list` with search queries to find specific documents.
- Keep a running log of experiments and findings in a shared Sheet.
- Use `--format csv` when exporting data for analysis tools.

## Task

Execute the following task as Researcher: $ARGUMENTS

1. **Load Required Skills**
   - Ensure all prerequisite GWS skills are available
   - Verify `gws` CLI is installed and authenticated
   - Review persona-specific workflows

2. **Analyze Task**
   - Understand the task requirements
   - Identify which Google Workspace services are needed
   - Plan the workflow steps

3. **Execute Workflow**
   - Use appropriate `gws` commands for each step
   - Follow persona-specific best practices
   - Document actions taken

4. **Review and Verify**
   - Confirm task completion
   - Verify results in Google Workspace
   - Report any issues or blockers

---

**License**: Apache License 2.0
**Source**: [Google Workspace CLI](https://github.com/googleworkspace/cli)
**Original Skill**: `persona-researcher`
