---
description: "Create a feature specification from a natural language description — creates git branch and spec.md"
argument-hint: "[feature description: what you want to build and why]"
allowed-tools: Bash(git:*), Bash(mkdir:*), Bash(date:*), Bash(printf:*), Read, Write
---

# SDD Specify

Create a feature specification for: $ARGUMENTS

## Instructions

Transform the feature description into a structured specification and create the git branch. Focus exclusively on WHAT and WHY — never HOW.

### Step 1: Validate Prerequisites

1. Verify `CONSTITUTION.md` exists (run `/sdd.init` first if missing)
2. Verify working tree is clean: `git status --porcelain`
   - If dirty, warn the user but offer to continue
3. Ensure `specs/` directory exists

### Step 2: Generate Branch Name and Number

**Determine next feature number:**
```bash
# Get highest number from existing spec directories and branches
HIGHEST_SPEC=$(ls specs/ 2>/dev/null | grep -oE '^[0-9]+' | sort -n | tail -1 || echo "0")
HIGHEST_BRANCH=$(git branch -a 2>/dev/null | grep -oE '[0-9]{3}-' | grep -oE '[0-9]{3}' | sort -n | tail -1 || echo "0")
NEXT=$(($(echo -e "$HIGHEST_SPEC\n$HIGHEST_BRANCH" | sort -n | tail -1) + 1))
FEATURE_NUM=$(printf "%03d" $NEXT)
```

**Generate short name from feature description:**
- Extract 2-4 meaningful keywords from `$ARGUMENTS`
- Use action-noun format (e.g., `user-auth`, `payment-checkout`, `analytics-dashboard`)
- Lowercase, hyphens only, no stop words (a, an, the, to, for, with...)
- Examples:
  - "Add user authentication with OAuth2" → `user-auth-oauth2`
  - "Build analytics dashboard for admins" → `analytics-dashboard`
  - "Fix timeout in payment processing" → `fix-payment-timeout`

**Final branch name**: `NNN-short-name` (e.g., `001-user-auth`)

### Step 3: Create Branch and Directory

```bash
git checkout -b "$FEATURE_NUM-$SHORT_NAME"
mkdir -p "specs/$FEATURE_NUM-$SHORT_NAME"
```

### Step 4: Generate Specification

Analyze `$ARGUMENTS` and write `specs/NNN-feature-name/spec.md`:

```markdown
# Feature Specification: [FEATURE NAME]

**Branch**: `NNN-feature-name`
**Created**: YYYY-MM-DD
**Status**: Draft

## Overview

[2-3 sentence summary of what this feature does and the problem it solves]

## User Scenarios & Testing

<!-- Each user story must be independently testable and deliver standalone value -->

### User Story 1 — [Brief Title] (Priority: P1)

[Describe this user journey in plain language — who does what and why]

**Why P1**: [Business value and urgency]

**Independent Test**: [How to verify this story works without other stories]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [user action], **Then** [expected outcome]
2. **Given** [initial state], **When** [user action], **Then** [expected outcome]

---

### User Story 2 — [Brief Title] (Priority: P2)

[...]

**Acceptance Scenarios**:

1. **Given** [...], **When** [...], **Then** [...]

---

### Edge Cases

- What happens when [boundary condition]?
- How does the system handle [error scenario]?

## Functional Requirements

- **FR-001**: System MUST [specific, testable capability]
- **FR-002**: System MUST [specific, testable capability]
- **FR-003**: Users MUST be able to [key interaction]

## Key Entities *(include if feature involves data)*

- **[Entity]**: [What it represents, key attributes — no implementation details]

## Success Criteria

- **SC-001**: [Measurable user-facing metric, e.g., "Users complete checkout in under 3 minutes"]
- **SC-002**: [Measurable business metric]
- **SC-003**: [Quality metric, e.g., "95% task completion rate on first attempt"]

## Assumptions

- [Reasonable assumption made where the description was ambiguous]

## Out of Scope

- [Explicitly excluded features or behaviors]
```

**Rules for filling the template:**
- Focus on WHAT users need and WHY — never HOW to implement
- Write for non-technical stakeholders
- Every requirement must be testable
- Mark genuine ambiguities with `[NEEDS CLARIFICATION: specific question]` (max 3)
- Make reasonable defaults for minor gaps — document in Assumptions
- Success criteria must be technology-agnostic and measurable

### Step 5: Quality Validation

Review the written spec against this checklist:

- [ ] No implementation details (no languages, frameworks, APIs)
- [ ] All user stories have Given/When/Then acceptance scenarios
- [ ] All functional requirements are testable
- [ ] Success criteria are measurable and technology-agnostic
- [ ] Maximum 3 `[NEEDS CLARIFICATION]` markers
- [ ] Edge cases identified
- [ ] Out of scope explicitly declared

If `[NEEDS CLARIFICATION]` markers exist, present them to the user one at a time:

```
## Clarification Needed: [Topic]

**Context**: [Quote relevant part of spec]
**Question**: [Specific question]

Suggested options:
| Option | Answer | Implications |
|--------|--------|--------------|
| A | [First answer] | [What this means] |
| B | [Second answer] | [What this means] |
| Custom | Provide your own | — |
```

Wait for answer, update spec, then present next question.

### Step 6: Update SDD Context

Update `.claude/sdd-context.md` with the new active feature:
```
- **Branch**: NNN-feature-name
- **Spec**: specs/NNN-feature-name/spec.md ✅
- **Plan**: (pending — run /sdd.clarify then /sdd.plan)
- **Tasks**: (pending)
```

### Step 7: Report Completion

```
✅ Feature specification created!

Branch:  NNN-feature-name
Spec:    specs/NNN-feature-name/spec.md
Stories: [N] user stories (P1–PN)
FRs:     [N] functional requirements

Next steps:
  1. Review spec.md and verify it captures your intent
  2. Run /sdd.clarify to resolve any ambiguities before planning
  3. Then run /sdd.plan [tech stack] when ready
```

## Key Rules

- NEVER mention tech stack, frameworks, or implementation details in spec.md
- Write as if explaining to a non-technical product manager
- Every user story must be independently testable (MVP slice)
- Priorities: scope clarity > security/privacy > UX > technical details
