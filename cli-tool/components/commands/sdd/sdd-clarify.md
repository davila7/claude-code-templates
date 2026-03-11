---
description: "Resolve spec ambiguities with up to 5 targeted questions before planning — reduces downstream rework"
argument-hint: "[optional: specific area to focus clarification on]"
allowed-tools: Bash(git:*), Read, Edit, Bash(date:*)
---

# SDD Clarify

Clarify the current feature specification: $ARGUMENTS

## Instructions

Identify and resolve the most impactful ambiguities in the spec before creating a technical plan. Run this BEFORE `/sdd-plan` — it significantly reduces rework.

### Step 1: Detect Active Feature

Get the current feature from git:
```bash
BRANCH=$(git branch --show-current)
```

Verify `$BRANCH` matches pattern `NNN-feature-name` (3 digits + hyphen + name).
- If not on a feature branch, instruct user to run `/sdd-specify` first.

Load `specs/$BRANCH/spec.md`. If missing, instruct user to run `/sdd-specify`.

Also load `CONSTITUTION.md` for project constraints.

### Step 2: Ambiguity Scan

Analyze the spec across these categories. For each, mark: **Clear** / **Partial** / **Missing**:

| Category | What to check |
|----------|---------------|
| Functional Scope | Core goals, explicit out-of-scope, user roles |
| Data & Entities | Attributes, identity rules, state transitions, scale |
| User Flows | Critical journeys, error/empty states, accessibility |
| Non-Functional | Performance targets, scalability, availability, security |
| Integration | External services, failure modes, data formats |
| Edge Cases | Negative scenarios, concurrency, conflict resolution |
| Constraints | Technical constraints, explicit tradeoffs |
| Acceptance | Testability of criteria, Definition of Done |

Build a prioritized queue of candidate questions from Partial/Missing categories.

**Focus if `$ARGUMENTS` provided**: prioritize that area first.

### Step 3: Question Queue (Max 5)

Select the top 5 highest-impact questions using: (Impact × Uncertainty) heuristic.

A question is worth asking only if the answer:
- Materially changes architecture, data modeling, or task decomposition
- Prevents misaligned acceptance tests
- Resolves a security, compliance, or scope ambiguity

**Do NOT ask about:**
- Minor style/UX preferences with obvious defaults
- Technical implementation details (belongs in /sdd-plan)
- Things already clearly answered in spec

### Step 4: Sequential Questioning (One at a Time)

Present EXACTLY ONE question at a time. Never reveal the queue.

**For choice-based questions:**

```
## Clarification [N/5]: [Topic]

**Why this matters**: [Impact on architecture/testing/scope]

**Recommended**: Option [X] — [1-2 sentence rationale based on best practices]

| Option | Description |
|--------|-------------|
| A | [Description] |
| B | [Description] |
| C | [Description] |

Reply with the option letter, "yes" to accept recommended, or a custom short answer (≤5 words).
```

**For open questions:**

```
## Clarification [N/5]: [Topic]

**Why this matters**: [Impact]

**Suggested**: [Your best-practice suggestion] — [brief reason]

Reply with "yes" to accept, or provide your answer (≤5 words).
```

After each answer:
- If user says "yes"/"recommended"/"suggested": use the recommended option
- Validate answer maps to an option or fits ≤5 words
- Record answer and proceed to next question
- Stop early if user says "done"/"proceed"/"no more"

### Step 5: Integrate Answers into Spec

After EACH accepted answer, immediately update `specs/$BRANCH/spec.md`:

1. Add/update a `## Clarifications` section (after Overview):
   ```markdown
   ## Clarifications

   ### Session YYYY-MM-DD
   - Q: [Question asked] → A: [Answer given]
   ```

2. Apply the clarification to the appropriate spec section:
   - Functional ambiguity → update/add to Functional Requirements
   - Actor/role distinction → update User Stories
   - Data shape → update Key Entities section
   - Non-functional constraint → add measurable criterion to Success Criteria
   - Edge case → add to Edge Cases section
   - Terminology → normalize across entire spec

3. Save spec after each integration (atomic overwrite)

**Rules:**
- Replace contradictory earlier text instead of duplicating
- Keep each insertion minimal and testable
- Preserve heading hierarchy and section order
- One canonical term per concept — no synonyms

### Step 6: Final Report

After questioning loop ends:

```
## Clarification Complete

Questions asked: [N]/5
Sections updated: [list]

Coverage Summary:
| Category | Status |
|----------|--------|
| Functional Scope | Resolved / Clear / Deferred |
| Data & Entities | ... |
| [etc.] | ... |

Deferred (low impact or plan-level): [list if any]

✅ Spec is ready for planning.
Next: /sdd-plan [your tech stack and architecture choices]
```

If no ambiguities found: "No critical ambiguities detected. Spec is clear — proceed with `/sdd-plan`."

## Rules

- Never modify sections other than those directly answered
- Never exceed 5 total questions
- If spec is missing, do not create it — instruct user to run `/sdd-specify`
- If user skips clarification explicitly, warn about downstream rework risk but proceed
