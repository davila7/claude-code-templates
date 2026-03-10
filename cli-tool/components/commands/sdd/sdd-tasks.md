---
description: "Generate dependency-ordered tasks.md from spec and plan — with parallel markers and user story grouping"
argument-hint: "[optional: TDD mode or specific focus]"
allowed-tools: Bash(git:*), Read, Write
---

# SDD Tasks

Generate task breakdown for current feature: $ARGUMENTS

## Instructions

Create an actionable `tasks.md` from the design artifacts. Every task must be specific enough for an LLM to execute without additional context.

### Step 1: Detect Active Feature

```bash
BRANCH=$(git branch --show-current)
```

Verify `$BRANCH` matches `NNN-feature-name`. Load from `specs/$BRANCH/`:

- **Required**: `plan.md` (tech stack, structure), `spec.md` (user stories + priorities)
- **Optional**: `data-model.md` (entities), `contracts/` (interfaces), `research.md` (decisions)

If `plan.md` is missing, STOP and instruct user to run `/sdd-plan` first.

### Step 2: Extract Key Information

From `spec.md`:
- User stories in priority order (P1, P2, P3...)
- Functional requirements (FR-NNN)
- Edge cases and acceptance scenarios

From `plan.md`:
- Tech stack and exact versions
- Project structure (directory layout)
- Architecture layers (models, services, handlers...)
- Testing framework (if TDD requested)

From `data-model.md` (if exists):
- Entities → map to user stories that need them
- Relationships → service layer dependencies

From `contracts/` (if exists):
- API endpoints → map to user stories

### Step 3: Generate tasks.md

Write `specs/$BRANCH/tasks.md` following this exact structure:

---

```markdown
# Tasks: [FEATURE NAME]

**Branch**: NNN-feature-name
**Generated**: YYYY-MM-DD
**Prerequisites**: plan.md ✅ | spec.md ✅

## Task Format: `[ID] [P?] [Story?] Description — file/path`

- **[P]**: Parallelizable (different files, no blocking dependency)
- **[US1]**: Maps to User Story 1 (P1 priority)
- Task IDs are sequential in execution order (T001, T002...)

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

## Phase 3: User Story 1 — [Title] (Priority: P1) 🎯 MVP

**Goal**: [What this story delivers]
**Independent Test**: [How to verify this works alone]

[IF TDD REQUESTED:]
### Tests (write first — must FAIL before implementation)
- [ ] T010 [P] [US1] Contract test for [endpoint/interface] — tests/contract/test_[name].[ext]
- [ ] T011 [P] [US1] Integration test for [user journey] — tests/integration/test_[name].[ext]

### Implementation
- [ ] T012 [P] [US1] Create [Entity] model — src/models/[entity].[ext]
- [ ] T013 [P] [US1] Create [Entity2] model — src/models/[entity2].[ext]
- [ ] T014 [US1] Implement [Service] — src/services/[service].[ext] (depends: T012, T013)
- [ ] T015 [US1] Implement [handler/endpoint/command] — src/[layer]/[file].[ext]
- [ ] T016 [US1] Add validation and error handling — src/[layer]/[file].[ext]

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 — [Title] (Priority: P2)

**Goal**: [What this story delivers]
**Independent Test**: [How to verify this works alone]

### Implementation
- [ ] T017 [P] [US2] Create [Entity] model — src/models/[entity].[ext]
- [ ] T018 [US2] Implement [Service] — src/services/[service].[ext]
- [ ] T019 [US2] Implement [handler/endpoint] — src/[layer]/[file].[ext]

**Checkpoint**: User Stories 1 and 2 independently functional.

---

[Continue phases for P3, P4... following same pattern]

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
- Phase 3+ (User Stories): Require Phase 2 complete; can run in parallel
- Final Phase: Requires all desired stories complete

### Within Each Story
- Tests (if included) BEFORE implementation
- Models BEFORE services
- Services BEFORE handlers/endpoints
- Core logic BEFORE integration

### Parallel Opportunities
- All `[P]`-marked tasks within same phase can run simultaneously
- Multiple user story phases can run in parallel (if team size allows)
- All models within a story can be created in parallel

---

## Implementation Strategy

### MVP (Story 1 Only)
1. Phase 1 → Phase 2 → Phase 3 (US1)
2. STOP and validate independently
3. Deploy/demo if ready

### Incremental
1. Foundation → US1 → validate → US2 → validate → US3...
2. Each story adds value without breaking previous
```

---

### Step 4: Task Generation Rules (CRITICAL)

**Format** — every task MUST follow:
```
- [ ] T001 [P]? [USN]? Description — exact/file/path.ext
```

- Start with `- [ ]` (checkbox)
- Sequential ID (T001, T002...) in execution order
- `[P]` ONLY if: affects different files from parallel tasks AND has no incomplete dependencies
- `[USN]` REQUIRED for tasks in user story phases (not for Setup/Foundation/Polish)
- Description: clear action verb + exact file path
- Tests flagged as TDD ONLY if explicitly requested in spec or `$ARGUMENTS`

**Story mapping**:
- Map each FR-NNN and entity to the user story (P1, P2...) that needs it
- If entity serves multiple stories, put in Foundation (Phase 2) or earliest story
- Each story phase must be completable and independently testable

### Step 5: Update SDD Context

Update `.claude/sdd-context.md`:
```
- **Tasks**: specs/NNN-feature-name/tasks.md ✅ ([N] tasks across [N] phases)
```

### Step 6: Report

```
✅ Task breakdown generated!

File: specs/NNN-feature-name/tasks.md

Summary:
  Total tasks: N
  User story phases: N (P1 → P[N])
  Parallel opportunities: N tasks marked [P]
  TDD tasks: N (or: not included)

MVP scope: Phase 1 + Phase 2 + Phase 3 (US1 only)

Next steps:
  1. Review tasks.md — adjust file paths to match your project layout
  2. Run /sdd-analyze to verify cross-artifact consistency
  3. Run /sdd-implement to start execution
```
