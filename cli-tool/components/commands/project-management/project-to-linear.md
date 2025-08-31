---
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [project-description] | --team-id | --create-new | --epic-name
description: Sync project structure and requirements to Linear workspace with comprehensive task breakdown
model: sonnet
---

# Project to Linear

Sync project structure and requirements to Linear workspace: **$ARGUMENTS**

## Linear Integration Status

- Linear MCP: Check if Linear MCP server is configured
- Workspace access: !`echo "Test Linear connection if MCP available"`
- Project context: @README.md or project documentation
- Requirements: Based on $ARGUMENTS analysis

## Task

Analyze project requirements and create comprehensive Linear task structure:

**Project Analysis Process**:
1. **Requirement Analysis** - Parse project description and identify major components
2. **Task Breakdown** - Create hierarchical task structure with epics and subtasks
3. **Dependency Mapping** - Identify task dependencies and critical path
4. **Linear Integration** - Create project, epics, and tasks in Linear workspace
5. **Validation** - Review created structure and provide project overview

**Task Organization**:
- Epic-level features and major components
- Parent tasks for feature areas
- Detailed subtasks with acceptance criteria
- Proper labeling (frontend, backend, testing, documentation)
- Priority and effort estimates
- Timeline and dependency relationships

**Output**: Complete Linear project structure with organized task hierarchy, clear descriptions, and actionable items.
