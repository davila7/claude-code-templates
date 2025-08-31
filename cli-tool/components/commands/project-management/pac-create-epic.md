---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [epic-name] | --name | --description | --owner
description: Create new PAC epic following Product as Code specification
model: sonnet
---

# Create PAC Epic

Create a new epic following the Product as Code specification with guided workflow: **$ARGUMENTS**

## PAC Configuration Check

- PAC directory: !`ls -la .pac/ 2>/dev/null || echo "No .pac directory found"`
- PAC config: @.pac/pac.config.yaml (if exists)
- Existing epics: !`ls -la .pac/epics/ 2>/dev/null | head -10`

## Task

Create a new Product as Code epic:

**Arguments**: 
- Epic name (required if not using --name flag)
- --name <name>: Epic name
- --description <desc>: Epic description  
- --owner <owner>: Epic owner
- --scope <scope>: Scope definition

**Epic Creation Process**:
1. Validate PAC configuration exists (suggest `/project:pac-configure` if missing)
2. Generate epic ID from name (format: epic-[kebab-case-name])
3. Create epic YAML file following PAC v0.1.0 specification in `.pac/epics/[epic-id].yaml`
4. Include required metadata: id, name, created timestamp, owner
5. Add spec with description, scope, success criteria, constraints, dependencies
6. Create epic directory structure: `.pac/epics/[epic-id]/`
7. Update PAC index if `.pac/index.yaml` exists
8. Create git branch `pac/[epic-id]` if in git repository

If information is missing, prompt user interactively for epic details.

**Next Steps**: Use `/project:pac-create-ticket --epic [epic-id]` to add tickets to this epic.