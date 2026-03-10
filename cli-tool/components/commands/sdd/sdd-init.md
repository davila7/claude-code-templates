---
description: "Initialize Spec-Driven Development structure in the current project"
argument-hint: "[optional: project description or principles focus]"
allowed-tools: Bash(git:*), Bash(mkdir:*), Bash(ls:*), Bash(test:*), Write, Read
---

# SDD Init

Initialize Spec-Driven Development (SDD) in this project: $ARGUMENTS

## Instructions

Set up the SDD directory structure and foundational files for Spec-Driven Development. This only needs to run once per project.

### Step 1: Validate Environment

1. Check this is a git repository: `git rev-parse --is-inside-work-tree`
   - If not a git repo, warn the user and offer to continue without git
2. Get the project root: `git rev-parse --show-toplevel` (or use current directory)
3. Check if SDD is already initialized by looking for `specs/` directory
   - If `specs/` already exists, inform the user and ask if they want to reinitialize

### Step 2: Create Directory Structure

Create the following structure at the project root:

```
specs/
└── .gitkeep

CONSTITUTION.md      (from template below)
```

Run:
```bash
mkdir -p specs
touch specs/.gitkeep
```

### Step 3: Create CONSTITUTION.md

If `CONSTITUTION.md` does not already exist, create it using this template:

```markdown
# [PROJECT_NAME] Constitution

> Governing principles for AI-assisted development. All specs, plans, and implementations must comply.

## Core Principles

### I. Spec Before Code
Features MUST have a completed spec.md before any implementation begins. No vibe coding.

### II. Intent Over Implementation
Specifications describe WHAT and WHY, never HOW. Tech stack is defined in plan.md, not spec.md.

### III. Iterative Refinement
Every spec goes through: specify → clarify → plan → analyze → tasks → implement. No skipping steps.

### IV. Human In The Loop
The agent proposes; the human approves. Constitution, specs, and plans require human review before implementation.

### V. Testable Requirements
Every functional requirement must be testable. If it cannot be tested, it is not a requirement.

### VI. Simplicity First
Minimum viable complexity. No over-engineering. YAGNI principles apply.

## Quality Gates

- **Before /sdd-plan**: spec.md must pass quality checklist (no [NEEDS CLARIFICATION] markers)
- **Before /sdd-implement**: tasks.md must exist and /sdd-analyze must show no CRITICAL issues
- **After implementation**: all tasks marked [x], feature works independently

## Governance

This constitution supersedes all other practices. To amend: document the change, justify the need, update this file with a new version.

**Version**: 1.0.0 | **Ratified**: [DATE] | **Last Amended**: [DATE]
```

Replace `[PROJECT_NAME]` with the actual project name (from `git remote get-url origin` or the directory name).
Replace `[DATE]` with today's date in YYYY-MM-DD format.

If `$ARGUMENTS` contains specific principles or focus areas, incorporate them into the constitution content before creating the file.

### Step 4: Create SDD Context File

Create `.claude/sdd-context.md` with the following content (creates `.claude/` directory if needed):

```markdown
# SDD Context

This project uses Spec-Driven Development. Reference this file for workflow context.

## Active Feature

> Updated by /sdd-specify and /sdd-plan

- **Branch**: (none — run /sdd-specify to start a feature)
- **Spec**: (pending)
- **Plan**: (pending)
- **Tasks**: (pending)

## SDD Command Reference

| Command | When to use |
|---------|-------------|
| `/sdd-constitution` | Update project governing principles |
| `/sdd-specify` | Start a new feature — creates branch + spec.md |
| `/sdd-clarify` | Resolve spec ambiguities (run before /sdd-plan) |
| `/sdd-plan` | Generate technical plan from spec |
| `/sdd-analyze` | Cross-check spec + plan + tasks for consistency |
| `/sdd-tasks` | Generate dependency-ordered task breakdown |
| `/sdd-implement` | Execute implementation from tasks.md |

## Workflow Sequence

```
/sdd-specify → /sdd-clarify → /sdd-plan → /sdd-analyze → /sdd-tasks → /sdd-implement
```

## Specs Directory

All feature specs live in `specs/NNN-feature-name/`:
- `spec.md` — Functional specification (what + why)
- `plan.md` — Technical plan (how + stack)
- `research.md` — Tech decisions and rationale
- `data-model.md` — Entities and relationships
- `tasks.md` — Ordered task breakdown
- `contracts/` — API/integration contracts
```

### Step 5: Output Summary

Display:

```
✅ SDD initialized successfully!

Created:
  specs/              — Feature specs directory
  CONSTITUTION.md     — Project governing principles
  .claude/sdd-context.md — SDD workflow context

Next steps:
  1. Review and customize CONSTITUTION.md with your project's specific principles
  2. Run /sdd-constitution [principles] to refine the constitution
  3. Start your first feature with: /sdd-specify [feature description]

SDD Workflow:
  /sdd-specify → /sdd-clarify → /sdd-plan → /sdd-analyze → /sdd-tasks → /sdd-implement
```
