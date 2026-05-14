---
description: "Generate dependency-ordered tasks.md from spec and plan — TDD tasks MANDATORY, parallel markers, user story grouping"
argument-hint: "[optional: specific focus or analysis mode]"
allowed-tools: Bash(git:*), Read, Write
---

# SDD Tasks

Generate task breakdown for current feature: $ARGUMENTS

## Instructions

Create an actionable `tasks.md` from the design artifacts. TDD tasks are MANDATORY and must come before implementation tasks for every user story. Every task must be specific enough for an LLM to execute without additional context. Every task must include file path and FR/acceptance scenario reference.

### Step 1: Detect Active Feature

```bash
BRANCH=$(git branch --show-current)
```

Verify `$BRANCH` matches `NNN-feature-name`. Load from `specs/$BRANCH/`:

- **Required**: `plan.md` (tech stack, structure), `spec.md` (user stories + priorities)
- **Optional**: `data-model.md` (entities), `contracts/` (interfaces), `research.md` (decisions)
- **Required**: `CONSTITUTION.md` from project root

If `plan.md` is missing, STOP and instruct user to run `/sdd-plan` first.

### Step 2: Mandatory Expert Analysis Phase

Before generating tasks.md, spawn two experts in sequence:

**Expert 1 — task-decomposition-expert:**

Spawn Agent with this exact prompt:

```
You are a task decomposition specialist.

Your task:

1. Read COMPLETE spec.md — all user stories, all FRs, all acceptance scenarios, all edge cases
2. Read COMPLETE plan.md — tech stack, architecture, project structure
3. Read COMPLETE data-model.md if it exists
4. Read ALL files in contracts/ if directory exists

Produce optimal task decomposition:

For EACH functional requirement (FR-NNN):
  - Which user story owns it?
  - What models/services need to be created?
  - What tests should validate it?
  - What endpoints/handlers are needed?

For EACH user story:
  - What FRs must be complete before it's done?
  - What models, services, handlers, tests are needed?
  - What dependencies exist between tasks?
  - What can run in parallel?

Output a dependency graph in this format:

USER STORY 1: [Title] (P[N])
  FRs covered: FR-001, FR-002
  Models needed: User, Post
  Services needed: UserService, PostService
  Tests needed (TDD):
    - test_user_can_create_account
    - test_user_cannot_create_duplicate_account
    - test_post_requires_user_id
  Implementation tasks:
    - Create User model
    - Create Post model
    - Create UserService
    - Create PostService
    - Create /users POST endpoint
    - Create /posts POST endpoint
  
  Dependencies: None (can start immediately if Phase 1 foundation complete)
  Parallel opportunities: User model and Post model can be created simultaneously
  
  FR Traceability:
    FR-001 → test_user_can_create_account + Create User model + Create UserService
    FR-002 → test_post_requires_user_id + Create Post model + Create PostService

[Continue for all user stories]

OUTPUT FORMAT: A task decomposition showing:
1. Every FR maps to at least one task (FR-NNN → Task[ID])
2. Every user story has TDD tasks BEFORE implementation tasks
3. Dependencies clearly marked
4. Parallel opportunities identified
```

**Expert 2 — qa-expert:**

Spawn Agent with this exact prompt:

```
You are a QA expert specializing in task completeness.

Your task:

1. Review the task decomposition from Expert 1
2. Read COMPLETE spec.md
3. Verify test coverage completeness

Check:
- Every user story has unit tests in task list? ✅/❌
- Every user story has integration tests in task list? ✅/❌
- Every FR has at least one corresponding test task? ✅/❌
- Every acceptance scenario has at least one test? ✅/❌
- Are test tasks scheduled BEFORE implementation tasks? ✅/❌
- Are security/edge case tests included? ✅/❌

Output:

Test Coverage Assessment:
  User Stories with TDD tasks: [N]/[N] ✅
  FRs with test coverage: [N]/[N] ✅
  Edge cases tested: [N] identified ✅
  Security tests included: ✅
  
Overall: COMPLETE or INCOMPLETE — [reason if incomplete]

If INCOMPLETE: "Task list missing test coverage for [areas]. Recommend adding [N] additional test tasks."
```

**Wait for both agents.** If Expert 2 says INCOMPLETE, ask Expert 1 to add missing test tasks, then re-validate.

### Step 3: Extract Key Information

From `spec.md`:
- User stories in priority order (P1, P2, P3...)
- Functional requirements (FR-NNN)
- Edge cases and acceptance scenarios

From `plan.md`:
- Tech stack and exact versions
- Project structure (directory layout)
- Architecture layers (models, services, handlers...)
- Testing framework (MANDATORY)

From `data-model.md` (if exists):
- Entities → map to user stories that need them
- Relationships → service layer dependencies

From `contracts/` (if exists):
- API endpoints → map to user stories

### Step 4: Generate tasks.md

Write `specs/$BRANCH/tasks.md` following this exact structure. TDD tasks are MANDATORY:

---

```markdown
# Tasks: [FEATURE NAME]

**Branch**: NNN-feature-name
**Generated**: YYYY-MM-DD
**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md [✅/—] | contracts/ [✅/—]

## Task Format: `[ID] [P?] [TDD?] [Story?] Description — file/path`

- **[P]**: Parallelizable (different files, no blocking dependency)
- **[TDD]**: Test task (must precede corresponding implementation task, must prove RED before GREEN)
- **[USN]**: Maps to User Story N (P[N] priority)
- Task IDs are sequential in execution order (T001, T002...)
- Every task MUST include exact file path and FR-NNN reference

---

## Phase 1: Setup

**Purpose**: Project initialization and base structure

- [ ] T001 Initialize project structure per plan.md layout
- [ ] T002 Install dependencies ([framework] [version], [lib] [version]...)
- [ ] T003 [P] Configure linting/formatting (.eslintrc / .prettierrc / pyproject.toml)
- [ ] T004 [P] Setup environment configuration (.env.example, config loading)
- [ ] T005 Configure test runner ([jest.config.js / pytest.ini / ...])

---

## Phase 2: Foundation

**Purpose**: Blocking infrastructure all user stories depend on

⚠️ No user story work begins until this phase is complete.

- [ ] T006 Setup database schema/migrations framework
- [ ] T007 [P] Implement error handling and logging infrastructure
- [ ] T008 [P] Setup [auth/middleware/routing] base infrastructure
- [ ] T009 Create shared types/interfaces used across all stories

**Checkpoint**: Foundation complete — user story phases can now run in parallel.

---

## Phase 3a: User Story 1 — [Title] (Priority: P1) 🎯 MVP — Tests (TDD)

**Goal**: [What this story delivers]
**Acceptance Scenarios**: [List 2-3 key scenarios]
**FRs Covered**: FR-001, FR-002, ...

⚠️ Tests MUST be proven RED before Phase 3b implementation begins.

### Tests (write first, must FAIL before implementation)

- [ ] T010 [P] [TDD] [US1] [FR-001] Unit test for [Model/Service] — tests/unit/test_[name].[ext]
- [ ] T011 [P] [TDD] [US1] [FR-002] Integration test for [user journey scenario A] — tests/integration/test_[name].[ext]
- [ ] T012 [TDD] [US1] [FR-001] Edge case test for [boundary/negative case] — tests/integration/test_[name].[ext]
- [ ] T013 [TDD] [US1] [FR-003] Contract test for [endpoint/interface] — tests/contract/test_[name].[ext]

**Execution gate**: Run `/sdd-tdd` to generate these test files and prove RED state.
Do NOT proceed to Phase 3b until all tests in Phase 3a are marked [x] AND .tdd-gate exists.

---

## Phase 3b: User Story 1 — [Title] — Implementation

**Prerequisite**: Phase 3a tests proven RED (verify .tdd-gate exists)

### Models
- [ ] T014 [P] [US1] [FR-001] Create [Entity] model — src/models/[entity].[ext]
- [ ] T015 [P] [US1] [FR-002] Create [Entity2] model — src/models/[entity2].[ext]

### Services
- [ ] T016 [US1] [FR-001] Implement [Service] business logic — src/services/[service].[ext] (depends: T014, T015)
- [ ] T017 [US1] [FR-002] Add validation and error handling — src/services/[service].[ext]

### API/Handlers
- [ ] T018 [US1] [FR-001] Implement [handler/endpoint] — src/api/[file].[ext]
- [ ] T019 [US1] [FR-003] Add [feature] integration — src/[layer]/[file].[ext]

**Checkpoint**: User Story 1 fully functional, all Phase 3a tests RED→GREEN, independently testable.

---

## Phase 4a: User Story 2 — [Title] (Priority: P2) — Tests (TDD)

**Goal**: [What this story delivers]
**Acceptance Scenarios**: [List scenarios]
**FRs Covered**: FR-004, FR-005, ...

- [ ] T020 [P] [TDD] [US2] [FR-004] Unit test for [Module] — tests/unit/test_[name].[ext]
- [ ] T021 [TDD] [US2] [FR-005] Integration test for [user journey] — tests/integration/test_[name].[ext]
- [ ] T022 [TDD] [US2] [FR-004] Edge case test for [scenario] — tests/integration/test_[name].[ext]

**Execution gate**: Run `/sdd-tdd` for Phase 4a tests (or grouped with Phase 3a).

---

## Phase 4b: User Story 2 — [Title] — Implementation

**Prerequisite**: Phase 4a tests proven RED

- [ ] T023 [P] [US2] [FR-004] Create [Entity] model — src/models/[entity].[ext]
- [ ] T024 [US2] [FR-004] Implement [Service] — src/services/[service].[ext]
- [ ] T025 [US2] [FR-005] Implement [handler/endpoint] — src/api/[file].[ext]

**Checkpoint**: User Stories 1 and 2 independently functional, all tests GREEN.

---

[Continue phases for P3, P4... following same pattern — TDD phase BEFORE each implementation phase]

---

## Phase N: Polish & Cross-Cutting

- [ ] TXXX [P] Update README and documentation
- [ ] TXXX Performance optimization if targets not met
- [ ] TXXX [P] Security hardening review
- [ ] TXXX Final integration validation against spec acceptance scenarios

---

## Dependency Map

### Phase Order
- Phase 1 (Setup): No dependencies
- Phase 2 (Foundation): Requires Phase 1 complete — BLOCKS all stories
- Phase 3a (US1 Tests): Requires Phase 2 complete
- Phase 3b (US1 Implementation): Requires Phase 3a complete AND RED state proven
- Phase 4a+ (US2+ Tests): Can start after Phase 2, parallel to Phase 3b
- Phase 4b+ (US2+ Implementation): Requires corresponding TDD phase complete
- Final Phase: Requires all desired stories complete

### Within Each User Story
- Tests (Phase Xa) BEFORE implementation (Phase Xb) — MANDATORY
- Tests MUST be proven RED before implementation begins
- Models BEFORE services
- Services BEFORE handlers/endpoints
- Core logic BEFORE integration

### Parallel Opportunities
- All `[P]`-marked tasks within same phase can run simultaneously
- Multiple user story TDD phases can be run together (all Phase 3a + Phase 4a + Phase 5a)
- Multiple user story implementation phases can run in parallel (Phase 3b, Phase 4b)
- All models within a story can be created in parallel

---

## Test Execution Timeline

1. After generating tasks.md, user runs `/sdd-tdd`
2. `/sdd-tdd` creates all test files for all TDD phases (3a, 4a, 5a, etc.) at once
3. `/sdd-tdd` proves RED state and creates .tdd-gate marker
4. User marks all TDD tasks [x] in tasks.md
5. User runs `/sdd-implement` which executes Phase 1 → Phase 2 → Phase 3a → Phase 3b → Phase 4a → Phase 4b, etc.
6. During Phase 3b implementation, tests transition RED→GREEN
7. Same for Phase 4b, 5b, etc.

---

## Implementation Strategy

### MVP (Story 1 Only)
1. Phase 1 → Phase 2 → Phase 3a (tests) → Run /sdd-tdd → Phase 3b (implement) → Verify tests GREEN
2. STOP and validate independently
3. Deploy/demo if ready

### Incremental
1. Phase 1 → Phase 2 → Phase 3a + Phase 4a (all TDD) → Run /sdd-tdd → Phase 3b + Phase 4b (implement in parallel if team size allows) → validate → Phase 5a + Phase 5b...
2. Each story adds value without breaking previous
```

---

### Step 5: Task Generation Rules (CRITICAL)

**Format** — every task MUST follow:
```
- [ ] T001 [P]? [TDD]? [USN]? [FR-NNN] Description — exact/file/path.ext
```

- Start with `- [ ]` (checkbox)
- Sequential ID (T001, T002...) in execution order
- `[P]` ONLY if: affects different files from parallel tasks AND has no incomplete dependencies
- `[TDD]` REQUIRED for all test tasks (MANDATORY, not optional)
- `[USN]` REQUIRED for all tasks in user story phases (not for Setup/Foundation/Polish)
- `[FR-NNN]` REQUIRED for every task (maps to functional requirement)
- Description: clear action verb + exact file path
- Exact file path at end: `— src/models/user.ts` or `— tests/unit/test_user.ts`

**Story mapping**:
- Map each FR-NNN to the user story (P1, P2...) that needs it
- If entity serves multiple stories, put in Foundation (Phase 2) or earliest story
- Each story phase must be completable and independently testable
- TDD tasks ALWAYS precede implementation tasks for that story

### Step 6: Update SDD Context

Update `.claude/sdd-context.md`:
```
- **Tasks**: specs/NNN-feature-name/tasks.md ✅ ([N] tasks across [N] phases, TDD mandatory)
  - TDD phases: Phase 3a, Phase 4a, Phase 5a, ... (test-first)
  - Implementation phases: Phase 3b, Phase 4b, Phase 5b, ... (RED→GREEN)
```

### Step 7: Report

```
✅ Task breakdown generated with TDD phases!

File: specs/NNN-feature-name/tasks.md

Summary:
  Total tasks: N
  User story phases: N (P1 → P[N])
  Parallel opportunities: N tasks marked [P]
  TDD tasks: N (MANDATORY, each user story phase has tests BEFORE implementation)
  
Phase structure:
  Phase 1 (Setup): N tasks
  Phase 2 (Foundation): N tasks
  Phase 3a (US1 Tests TDD): N tasks
  Phase 3b (US1 Implementation): N tasks (blocked until 3a complete)
  Phase 4a (US2 Tests TDD): N tasks
  Phase 4b (US2 Implementation): N tasks (blocked until 4a complete)
  [etc.]

MVP scope: Phase 1 + Phase 2 + Phase 3a (tests) + Phase 3b (implementation)

Key gates:
  - Phase 3a must complete and be proven RED before Phase 3b starts
  - .tdd-gate marker created by /sdd-tdd signals tests are RED
  - All TDD tasks marked [x] after /sdd-tdd succeeds
  - /sdd-implement will run tests RED→GREEN during implementation phases

Next steps:
  1. Review tasks.md — adjust file paths to match your project layout
  2. Run /sdd-analyze to verify cross-artifact consistency
  3. Run /sdd-tdd to generate all test files and prove RED state
  4. Run /sdd-implement to start execution (phases in order)
```
