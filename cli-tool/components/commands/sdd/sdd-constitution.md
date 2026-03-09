---
description: "Create or update the project constitution — governing principles for SDD workflow"
argument-hint: "[principles or focus areas to incorporate]"
allowed-tools: Read, Write, Edit, Bash(date:*)
---

# SDD Constitution

Create or update the project constitution with: $ARGUMENTS

## Instructions

The constitution defines non-negotiable principles that all specs, plans, and implementations must follow. It is the single source of truth for project governance.

### Step 1: Load Existing Constitution

Read `CONSTITUTION.md` from the project root.
- If it doesn't exist: inform the user to run `/sdd.init` first, then offer to create a minimal constitution anyway.

### Step 2: Analyze User Input

Parse `$ARGUMENTS` for:
- Specific principles to add, modify, or remove
- Technology constraints (e.g., "TypeScript only", "AWS serverless")
- Quality standards (e.g., "TDD mandatory", "100% test coverage")
- Architectural constraints (e.g., "clean architecture", "no direct DB access from handlers")
- Team/project specific rules

If `$ARGUMENTS` is empty: perform an interactive review of the current constitution and ask if any principles need updating.

### Step 3: Draft Updated Constitution

Follow this structure:

```markdown
# [PROJECT_NAME] Constitution

> [One-line project mission or purpose]

## Core Principles

### I. [PRINCIPLE_NAME]
[Description: declarative, MUST/SHOULD language, testable where possible]
**Rationale**: [Why this principle matters for this project]

### II. [PRINCIPLE_NAME]
...

## Technical Constraints

[Language/framework choices, forbidden patterns, required tools]

## Quality Gates

- **Before /sdd.plan**: [what must be true]
- **Before /sdd.implement**: [what must be true]
- **Definition of Done**: [acceptance criteria for all features]

## Governance

[Amendment process, compliance review expectations]

**Version**: X.Y.Z | **Ratified**: YYYY-MM-DD | **Last Amended**: YYYY-MM-DD
```

### Step 4: Version Update

Determine version bump:
- **MAJOR** (X.0.0): Removing or fundamentally redefining a principle
- **MINOR** (x.Y.0): Adding a new principle or major section
- **PATCH** (x.y.Z): Clarifications, wording, minor refinements

Update the version line accordingly. Set `Last Amended` to today's date.

### Step 5: Validate

Before writing, verify:
- No bracketed placeholder tokens remain (`[LIKE_THIS]`)
- All principles use declarative language (MUST/SHOULD, not "try to")
- Dates are ISO format (YYYY-MM-DD)
- Version follows semantic versioning

### Step 6: Write and Report

Overwrite `CONSTITUTION.md` with the updated content.

Report to user:
- Version change: old → new
- Principles added/modified/removed
- Suggested commit message: `docs: update constitution to vX.Y.Z ([summary])`
- Next step: `/sdd.specify [feature description]` to start a new feature
