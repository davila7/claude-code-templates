---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [project-name] | --minimal | --epic-name | --owner
description: Initialize Product as Code (PAC) project structure with templates and configuration
model: sonnet
---

# Configure PAC Project

Initialize Product as Code (PAC) project structure: **$ARGUMENTS**

## Current Project State

- Git status: !`git status --porcelain | wc -l` uncommitted changes
- PAC structure: !`ls -la .pac/ 2>/dev/null | head -5 || echo "No PAC directory"`
- Existing epics: !`find .pac/epics/ -name "*.yaml" 2>/dev/null | wc -l`

## Task

Configure and initialize PAC project structure for version-controlled product management:

**Setup Process**:
1. **Project Analysis** - Validate git repository and analyze existing PAC structure
2. **Directory Creation** - Create `.pac/` structure with epics, tickets, and templates
3. **Configuration Files** - Generate `pac.config.yaml` with project metadata and defaults
4. **Template Creation** - Create epic and ticket templates following PAC v0.1.0 specification
5. **Initial Content** - Create first epic and ticket based on user input
6. **Integration Setup** - Configure git hooks and validation scripts

**Arguments**: Use --minimal for basic structure, --epic-name for initial epic, --owner for product owner.

**Next Steps**: Use `/project:pac-create-epic` and `/project:pac-create-ticket` to manage product development.
