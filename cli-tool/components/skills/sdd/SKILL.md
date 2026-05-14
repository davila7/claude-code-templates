---
name: sdd
description: "Spec-Driven Development methodology guide — structured specifications drive AI-assisted implementation with mandatory TDD and review gates"
---

# Spec-Driven Development (SDD) — Methodology Guide

> **Inspired by**: [GitHub/spec-kit](https://github.com/github/spec-kit) and ThoughtWorks research on SDD
> **Philosophy**: "Specs become executable" — structured specifications drive AI-assisted implementation with RED-first testing and mandatory peer review

---

## What is Spec-Driven Development?

SDD is a development paradigm where **well-crafted specifications serve as the primary artifact** that drives code generation via AI coding agents. Instead of describing vague requirements and hoping the AI figures it out, SDD separates:

1. **What + Why** (spec.md) — functional requirements, user stories, acceptance criteria
2. **How** (plan.md) — tech stack, architecture, data model, contracts
3. **Execution** (tasks.md) — dependency-ordered tasks with parallel markers
4. **Testing** (TDD phase) — RED failing tests before implementation
5. **Review** (review phase) — mandatory 5-agent review before PR

This is NOT a return to waterfall. It provides **shorter, more effective feedback loops** than vibe coding by putting structured thinking before implementation — and the AI does the heavy lifting of translating specs into plans and plans into code, with built-in quality gates.

---

## Why SDD with AI Agents?

| Vibe Coding | Spec-Driven Development |
|-------------|------------------------|
| One-shot prompt → messy code | Structured spec → validated plan → failing tests → clean code |
| Agent hallucinates features | Spec defines exact behavior boundaries |
| Context gets lost in long sessions | Specs compress context — agent always has ground truth |
| Rework when requirements were wrong | Clarify phase catches gaps before a line is written |
| No traceability | Every task maps to a requirement |
| Tests written after (if at all) | Tests written first (RED), then implementation (GREEN) |
| No formal review | 5-agent mandatory review before PR |

---

## The 10-Step Pipeline

```
/sdd-init (once per project)
     ↓
/sdd-constitution (once per project, update as needed)
     ↓
/sdd-specify → /sdd-clarify → /sdd-plan → /sdd-analyze → /sdd-tasks → /sdd-tdd → /sdd-implement → /sdd-review
                                                                                           ↓
                                                                                      [tests RED]
                                                                                           ↓
                                                                                    [implement code]
                                                                                           ↓
                                                                                    [tests GREEN]
                                                                                           ↓
                                                                                    [5-agent review]
```

### Step 0: Initialize (once per project)
```
/sdd-init
```
Creates `specs/` directory, `CONSTITUTION.md`, and `.claude/sdd-context.md`.

### Step 1: Constitution (once per project)
```
/sdd-constitution TypeScript-first, AWS serverless, TDD mandatory, clean architecture
```
Defines non-negotiable principles. Everything else must comply.

### Step 2: Specify (once per feature)
```
/sdd-specify Build a user authentication system with email/password and OAuth2 support
```
Creates git branch `NNN-feature-name` and `specs/NNN-feature-name/spec.md` with user stories, FRs, success criteria.
**Focus: WHAT and WHY only. No tech stack.**

### Step 3: Clarify (before planning)
```
/sdd-clarify
```
Up to 5 targeted questions that resolve the highest-impact ambiguities. Reduces planning rework significantly.
Answers are integrated back into spec.md.

### Step 4: Plan (with tech stack)
```
/sdd-plan TypeScript, NestJS, PostgreSQL, AWS Lambda via CDK
```
Generates `plan.md`, `research.md`, `data-model.md`, `contracts/`.
**Focus: HOW — tech stack, architecture, file structure, contracts.**
Includes mandatory expert architecture review.

### Step 5: Analyze (optional but recommended)
```
/sdd-analyze
```
Read-only cross-artifact check. Finds inconsistencies between spec ↔ plan ↔ tasks.
CRITICAL issues must be fixed before implementing.

### Step 6: Tasks
```
/sdd-tasks
```
Generates `tasks.md` with:
- Phases: Setup → Foundation → [User Story phases] → Polish
- Task IDs: T001, T002...
- Parallel markers: `[P]`
- Story labels: `[US1]`, `[US2]`...
- Exact file paths for each task
- **TDD tasks BEFORE implementation tasks for each story phase**

### Step 7: TDD (Test-Driven Development)
```
/sdd-tdd
```
Generates failing test files (RED state) from spec acceptance scenarios. Tests must fail before implementation.
- Creates test files for each story phase
- Verifies RED state (tests are failing)
- Creates `.tdd-gate` marker file when confirmed RED
- Spawns `test-engineer` and `qa-expert` agents

**This is a mandatory gate** — implementation cannot proceed without `.tdd-gate` marker.

### Step 8: Implement
```
/sdd-implement
```
Executes tasks.md phase by phase, completing implementation tasks. Tests progress from RED → GREEN.
Marks tasks `[x]` as they complete. Stops at checkpoints for validation.

**Implementation cannot proceed without `.tdd-gate` marker.**

### Step 9: Review
```
/sdd-review
```
Mandatory 5-agent review of completed implementation:
- `security-engineer` — Security audit, authentication, authorization, injection handling
- `code-reviewer` — Code quality, naming, structure, maintainability
- `architect-reviewer` — Architecture compliance, design patterns, system integrity
- `qa-expert` — Test coverage, edge cases, integration testing
- `se-security-reviewer` — Security hardening, data protection, compliance

Creates `~/.claude/.review-gate` marker (2-hour TTL) only if all agents PASS.

**Pipeline cannot move to PR without valid `.review-gate` marker.**

---

## Test-Driven Development (TDD) Phase Details

### Red-Green-Refactor Cycle

The TDD phase implements the classic cycle:

1. **RED**: Write tests that fail (testing behavior that doesn't exist yet)
2. **GREEN**: Implement minimal code to make tests pass
3. **REFACTOR**: Improve code while keeping tests green

### What Makes a Good Failing Test

- **Tests behavior, not implementation** — `test_user_password_is_hashed()` not `test_password_uses_bcrypt()`
- **Tests are specific** — "when password is blank, return 400" not "when input is invalid, handle it"
- **Test setup is correct** — fixtures, mocks, and database state mirror production
- **Assertions are clear** — tests fail with specific, readable error messages
- **Edge cases included** — boundary conditions, error scenarios, type mismatches

### RED State Verification

Before implementation begins, the test-engineer MUST verify:
- ⛔ Every test file created by `/sdd-tdd` actually runs and **FAILS**
- ⛔ No accidental GREEN tests (tests that pass before implementation is written)
- ⛔ Test failure messages are clear and actionable
- ⛔ All test files are referenced in tasks.md TDD section

**Why RED is non-negotiable:**
If tests pass before implementation, the tests are either trivial or not testing the right thing. The gate prevents accidental "passing tests with no code" which creates a false sense of completion.

### Test File Structure per Tech Stack

**TypeScript/Node.js (Jest):**
```
src/
├── auth/
│   ├── authenticate.ts
│   └── __tests__/
│       └── authenticate.test.ts
tests/
├── integration/
│   └── auth.integration.test.ts
```

**Python (pytest):**
```
src/
├── auth.py
tests/
├── unit/
│   └── test_auth.py
├── integration/
│   └── test_auth_integration.py
```

**Go (testing):**
```
auth.go
auth_test.go
integration_test.go
```

---

## Artifact Structure (per feature)

```
specs/
└── 001-user-auth/
    ├── spec.md              ← /sdd-specify output
    ├── plan.md              ← /sdd-plan output
    ├── research.md          ← /sdd-plan output
    ├── data-model.md        ← /sdd-plan output
    ├── tasks.md             ← /sdd-tasks output
    ├── .tdd-gate            ← /sdd-tdd output (RED state marker)
    └── contracts/
        └── api-spec.md      ← /sdd-plan output

CONSTITUTION.md              ← /sdd-constitution output (project root)
.claude/sdd-context.md       ← auto-updated context file

~/.claude/.review-gate       ← /sdd-review output (PR gate, 2h TTL)
```

**File Purposes:**
- `.tdd-gate` — Created by `/sdd-tdd` when RED state is proven. Contains timestamp and test execution summary. Blocks `/sdd-implement` start.
- `~/.claude/.review-gate` — Created by `/sdd-review` when all 5 agents PASS. Contains agent signatures and completion timestamp. 2-hour validity window. Blocks PR without valid marker.

---

## What Makes a Good Spec?

From ThoughtWorks research (Liu Shangqi, APAC Tech Director):

> "A specification should explicitly define the external behavior of the target software — input/output mappings, preconditions/postconditions, invariants, constraints, interface types, integration contracts, and sequential logic/state machines."

**Spec quality checklist:**
- [ ] Uses domain language (ubiquitous language), not tech jargon
- [ ] Given/When/Then acceptance scenarios for every story
- [ ] Every FR is testable — if you can't test it, it's not a requirement
- [ ] Success criteria are measurable and technology-agnostic
- [ ] No `[NEEDS CLARIFICATION]` markers remaining
- [ ] Edge cases identified
- [ ] Out of scope explicitly declared

**Good success criteria:**
- ✅ "Users complete checkout in under 3 seconds"
- ✅ "System handles 10,000 concurrent users"
- ❌ "API response time under 200ms" (implementation-focused)
- ❌ "React components render efficiently" (framework-specific)

---

## What Makes a Good Tasks.md?

- Every task has: checkbox + ID + optional `[P]` + optional `[USN]` + description + file path
- Tasks are grouped by user story (each story independently testable)
- **TDD tasks come BEFORE implementation tasks for each story phase**
- Each user story phase has a checkpoint for validation
- `[P]` marks tasks that genuinely have no inter-dependencies

**Task ordering principle:**
```
[Test Setup/Config] (T001-T005)
  ↓
[US1 Tests] (T006-T008)  ← Write failing tests
  ↓
[US1 Implementation] (T009-T012)  ← Write code to pass tests
  ↓
[US1 Integration Tests] (T013)
  ↓
[US2 Tests] (T014-T015)  ← Write failing tests for next story
  ↓
[US2 Implementation] (T016-T018)
  ↓
... repeat for each story ...
```

---

## Expert Agents in the Pipeline

Each SDD step spawns specific expert agents with exigent requirements:

| Step | Agents | Role | Spawn Method |
|------|--------|------|--------------|
| `/sdd-plan` | architect-reviewer, backend/frontend-developer | Architecture validation, tech stack review, project structure design | Parallel after Step 3 |
| `/sdd-analyze` | architect-reviewer, code-reviewer | Spec-plan alignment, architecture consistency, interface design | Parallel in Step 1a |
| `/sdd-tasks` | task-decomposition-expert, qa-expert | Task ordering, dependency analysis, test coverage planning | Sequential after `/sdd-analyze` |
| `/sdd-tdd` | test-engineer, qa-expert | RED test generation, RED state verification, edge case coverage | Primary role, with verification |
| `/sdd-implement` | backend-developer / frontend-developer, debugger (on failure) | Code generation, build management, error resolution | Sequential phase execution |
| `/sdd-review` | security-engineer, code-reviewer, architect-reviewer, qa-expert, se-security-reviewer | Security audit, code quality, architecture review, test coverage, security hardening | Parallel review, all must PASS |

---

## Integration with Existing Workflow

SDD commands complement our existing workflow:

| Existing command | SDD equivalent | Relationship |
|-----------------|----------------|--------------|
| `/git-feature` | `/sdd-specify` | sdd-specify creates branch + spec in one step |
| `/create-prd` | `/sdd-specify` + `/sdd-clarify` | SDD produces richer, more structured output |
| `/new-feature` | Full SDD pipeline | SDD is the structured version of this workflow |
| CLAUDE.md global | `CONSTITUTION.md` per-project | Constitution is project-specific principles |

Use SDD for any feature that is:
- Non-trivial (more than a few hours of work)
- Has unclear or complex requirements
- Involves multiple user stories or components
- Requires careful architecture decisions
- Needs strict quality standards

---

## Key Principles

1. **Spec before code** — No implementation until spec is approved
2. **Intent over implementation** — Spec never mentions tech stack
3. **Iterative refinement** — Every step has a human review point
4. **Context engineering** — Specs compress context for the AI agent
5. **Testable by default** — If it's not testable, it's not a requirement
6. **RED before GREEN** — Tests must fail before implementation starts (mandatory gate)
7. **Review before PR** — 5-agent review must pass before PR is created (mandatory gate)
8. **Fail fast on specs** — Catch gaps in spec, not in code review

---

## Quality Gates

The SDD pipeline enforces three critical quality gates:

### Gate 1: Tasks → TDD
**BLOCKING**: Cannot start `/sdd-tdd` without:
- ✅ All tasks in tasks.md have IDs and file paths
- ✅ Testing framework specified in plan.md
- ✅ Every user story phase includes TDD task(s)

### Gate 2: TDD → Implement
**BLOCKING**: Cannot start `/sdd-implement` without:
- ✅ `.tdd-gate` file exists in `specs/NNN-feature-name/`
- ✅ RED state verified (all test files execute and fail)
- ✅ No accidental GREEN tests (no passing tests before code)

### Gate 3: Implement → Review
**BLOCKING**: Cannot start `/sdd-review` without:
- ✅ All task checkboxes marked `[x]`
- ✅ Test suite runs and passes (GREEN)
- ✅ No failing tests

### Gate 4: Review → PR
**BLOCKING**: Cannot merge without:
- ✅ `~/.claude/.review-gate` exists and is newer than 2 hours
- ✅ `.review-gate` was created AFTER the last commit (not stale)
- ✅ All 5 review agents returned PASS status

---

## Troubleshooting

**Agent generates code that doesn't match the spec**
→ Run `/sdd-analyze` — there's likely a spec-plan inconsistency

**Spec has too many `[NEEDS CLARIFICATION]`**
→ Max 3 allowed. For the rest, make reasonable defaults and document in Assumptions

**Tasks are too vague**
→ Each task must include an exact file path. If missing, the task needs splitting

**Constitution violations in plan**
→ Either adjust plan to comply, or document the justified exception in Complexity Tracking

**Feature scope keeps growing during planning**
→ Return to spec.md and add to Out of Scope section. Plan only what's in spec.

**Tests are passing before I write code**
→ Tests are not testing the right thing. Rewrite to test actual behavior. RED is non-negotiable.

**Uncertainty about which agent can handle a task**
→ Read the agent's documentation. Human tasks include: code review, UI/UX aesthetic decisions, undocumented legacy knowledge.

---

## Quick Reference Card

```
# Start a new project
/sdd-init
/sdd-constitution [principles]

# Start a new feature
/sdd-specify [what you want to build and why]
/sdd-clarify
/sdd-plan [tech stack]
/sdd-analyze
/sdd-tasks
/sdd-tdd                  ← RED tests generated
/sdd-implement            ← Code written, tests GREEN
/sdd-review               ← 5-agent review
[Create PR]               ← After review-gate passes

# Update constitution
/sdd-constitution [what changed and why]

# Check pipeline state anytime
/sdd-orchestrator         ← Shows current state and next step
```

---

## Common Patterns

### Starting a Fresh Feature
```bash
git checkout -b 042-payment-processing
/sdd-specify Add payment processing with Stripe integration
/sdd-clarify
/sdd-plan TypeScript, Express, PostgreSQL, Stripe SDK
/sdd-analyze
/sdd-tasks
/sdd-tdd
/sdd-implement
/sdd-review
git push origin 042-payment-processing  # After review passes
```

### Resuming a Feature
```bash
git checkout 042-payment-processing
/sdd-orchestrator          # Shows current state
# Follow recommendation (e.g., /sdd-implement if at TDD state)
```

### Fixing Review Issues
```bash
# Fix code issues flagged in /sdd-review
# Re-run tests to ensure GREEN
/sdd-review               # Must re-run with fresh code
# New .review-gate marker created if all agents pass
```
