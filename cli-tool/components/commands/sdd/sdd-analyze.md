---
description: "Cross-artifact consistency analysis — verify spec, plan, and tasks align before implementation (read-only)"
argument-hint: "[optional: focus area or specific concern]"
allowed-tools: Bash(git:*), Read
---

# SDD Analyze

Cross-artifact consistency analysis: $ARGUMENTS

## Instructions

Read-only analysis of `spec.md`, `plan.md`, and `tasks.md` (if available). Find inconsistencies, gaps, and constitution violations before any code is written. Does NOT modify any files.

### Step 1: Detect Active Feature

```bash
BRANCH=$(git branch --show-current)
```

Verify `$BRANCH` matches `NNN-feature-name`. Load from `specs/$BRANCH/`:

- **Required**: `spec.md`, `plan.md`
- **Required if exists**: `tasks.md`, `data-model.md`, `research.md`
- **Required**: `CONSTITUTION.md`

If `spec.md` or `plan.md` are missing, abort with instruction to run the missing command first.

### Step 2: Build Semantic Models

Internally construct (do not output):

1. **Requirements inventory**: Each FR-NNN from spec.md with a derived slug
2. **User story inventory**: Each user story with its acceptance criteria
3. **Task coverage map**: If tasks.md exists, map each task to requirements/stories
4. **Constitution rule set**: Extract all MUST/SHOULD statements from CONSTITUTION.md

### Step 3: Run Detection Passes

#### A. Duplication Detection
- Near-duplicate functional requirements
- User stories with identical acceptance criteria
- Overlapping tasks (if tasks.md exists)

#### B. Ambiguity Detection
- Vague adjectives without measurable criteria: "fast", "scalable", "secure", "intuitive", "robust"
- Unresolved placeholders: `[NEEDS CLARIFICATION]`, TODO, TKTK, `<placeholder>`
- Requirements without testable outcomes

#### C. Underspecification
- FRs with verb but no measurable object
- User stories missing acceptance criteria
- Plan references technologies not in research.md
- Tasks referencing files/components not in spec or plan

#### D. Constitution Alignment
- Plan decisions that conflict with MUST principles
- Missing mandatory sections from constitution
- Tech choices violating stated constraints

#### E. Coverage Gaps
- FRs with zero corresponding tasks (if tasks.md exists)
- Tasks with no mapped requirement or user story
- Non-functional requirements (performance, security) not reflected in plan or tasks
- User stories not covered by at least one task phase

#### F. Inconsistency
- Same concept named differently across files (terminology drift)
- Entities in plan/data-model missing from spec (or vice versa)
- Spec says X, plan implements Y (contradictions)
- Task ordering issues (integration before foundation)

**Focus if `$ARGUMENTS` provided**: prioritize that specific area in analysis.

### Step 4: Assign Severity

- **CRITICAL**: Constitution MUST violation, missing core artifact, zero-coverage requirement blocking baseline
- **HIGH**: Duplicate/conflicting requirement, ambiguous security/performance criterion, untestable acceptance
- **MEDIUM**: Terminology drift, missing NFR task coverage, underspecified edge case
- **LOW**: Wording improvements, minor redundancy, style issues

### Step 5: Output Analysis Report

```markdown
## Specification Analysis Report
**Feature**: NNN-feature-name
**Analyzed**: YYYY-MM-DD
**Artifacts**: spec.md ✅ | plan.md ✅ | tasks.md [✅/—] | constitution.md ✅

### Findings

| ID | Category | Severity | Location | Summary | Recommendation |
|----|----------|----------|----------|---------|----------------|
| D1 | Duplication | HIGH | spec.md FR-002, FR-007 | Similar requirements ... | Merge, keep clearer phrasing |
| A1 | Ambiguity | MEDIUM | spec.md SC-001 | "fast" without metric | Add: "under 2 seconds" |
| C1 | Constitution | CRITICAL | plan.md | Uses MySQL, constitution requires PostgreSQL | Switch to PostgreSQL |

*(Max 50 findings; summarize overflow)*

### Coverage Summary

| Requirement | Covered by Tasks | Task IDs | Notes |
|-------------|-----------------|----------|-------|
| FR-001 | ✅ | T003, T004 | |
| FR-002 | ❌ | — | No task maps to this requirement |

### Constitution Alignment

[List any violations, or: "✅ All principles satisfied"]

### Metrics

- Total Requirements: N
- Total User Stories: N
- Total Tasks: N (if tasks.md exists)
- Coverage: N% (requirements with ≥1 task)
- Critical Issues: N
- High Issues: N
- Medium/Low Issues: N
```

### Step 6: Next Actions

Based on findings:

**If CRITICAL issues exist:**
```
⛔ CRITICAL issues found — resolve before /sdd.implement

Critical items:
  [C1] [summary] → [action]

Recommended commands:
  - /sdd.specify to refine [area]
  - /sdd.plan to adjust [decision]
  - Edit tasks.md manually to add coverage for [requirement]
```

**If only MEDIUM/LOW:**
```
✅ No blockers found. You may proceed to /sdd.implement.

Suggestions (optional improvements):
  [list]
```

**If zero issues:**
```
✅ Perfect consistency — all artifacts aligned.
Proceed with: /sdd.implement
```

### Step 7: Offer Remediation

Ask: "Would you like concrete remediation suggestions for the top N issues?"

Do NOT apply changes automatically — analysis is strictly read-only.
