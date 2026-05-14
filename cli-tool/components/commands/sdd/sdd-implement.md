---
description: "Execute implementation from tasks.md — phase by phase, marking tasks complete as they finish"
argument-hint: "[optional: 'phase 1' to run specific phase, or 'resume' to continue from last checkpoint]"
allowed-tools: Bash(git:*), Bash(mkdir:*), Bash(npm:*), Bash(pip:*), Bash(python:*), Bash(node:*), Bash(dotnet:*), Bash(go:*), Bash(cargo:*), Bash(mvn:*), Read, Write, Edit
---

# SDD Implement

Execute implementation plan: $ARGUMENTS

## Instructions

Execute the task plan defined in `tasks.md`. Process phases in order, respect dependencies, mark tasks complete as they finish.

### Step 1: Detect Active Feature

```bash
BRANCH=$(git branch --show-current)
```

Verify `$BRANCH` matches `NNN-feature-name`. Load from `specs/$BRANCH/`:

- **Required**: `tasks.md`, `plan.md`, `spec.md`
- **Load if exists**: `data-model.md`, `contracts/`, `research.md`
- **Required**: `CONSTITUTION.md` from project root — all implementation must comply

If `tasks.md` is missing, STOP: "Run `/sdd-tasks` first to generate the task breakdown."
If `spec.md` is missing, STOP: "Run `/sdd-specify` first — spec.md is the source of truth for acceptance criteria."

### Step 2: Pre-Implementation Checks

1. **Count incomplete items in tasks.md:**
   - `- [ ]` = incomplete
   - `- [x]` or `- [X]` = complete

2. **Check TDD gate (MANDATORY):**
   ```bash
   [ -f "specs/$BRANCH/.tdd-gate" ] || STOP
   ```
   
   If `.tdd-gate` does not exist:
   ```
   ⛔ STOP — TDD phase not completed.
   
   Tests must be proven RED before implementation begins.
   Run /sdd-tdd first to:
     1. Generate all test files
     2. Prove RED state (all tests failing)
     3. Create .tdd-gate marker
   
   TDD is not optional — it drives implementation RED→GREEN.
   ```
   
   If `.tdd-gate` exists, parse it:
   ```bash
   cat specs/$BRANCH/.tdd-gate
   # Expected format: 2025-05-14T10:30:45Z RED abc1234
   ```
   Report: "✅ TDD gate found — tests proven RED at [timestamp], commit [hash]"

3. **Check for previous progress:**
   If any tasks already marked complete, inform user:
   "Found N completed tasks. Resuming from last checkpoint."

4. **Parse `$ARGUMENTS`:**
   - `phase N` → run only Phase N
   - `resume` → skip to first incomplete task
   - `story N` → run only Phase for User Story N
   - Empty → run all phases sequentially

5. **Verify project setup** (from plan.md tech stack):
   - Ensure required ignore files exist (`.gitignore`, `.dockerignore` if Docker detected)
   - Create missing ignore files with appropriate patterns for the tech stack

6. **Read CONSTITUTION.md from project root** — verify approach before each phase.

### Step 3: Parse Task Structure

From `tasks.md`, extract:
- Phase list in order
- For each phase: tasks with IDs, [P] markers, [USN] labels, file paths
- Dependency relationships (sequential vs parallel)

### Step 4: Execute Phase by Phase

For each phase (in order):

1. **Constitution compliance check** (before phase start):
   - Re-read CONSTITUTION.md (or load from cache if recently read)
   - Verify the phase's technical approach complies with all MUST principles
   - If violation found: STOP and flag as blocker

   Report: "✅ Phase N complies with CONSTITUTION.md" or "⛔ Phase N violates [principle]"

2. **Announce phase start:**
   ```
   ## Phase N: [Phase Name]
   Goal: [Phase purpose]
   Tasks: [count] ([count P] parallelizable)
   ```

3. **For TDD phases (Xa: User Story Tests):**
   - Skip execution — already done by `/sdd-tdd`
   - These tasks should already be marked `[x]` from TDD phase output
   - If any TDD task is still `[ ]`, report: "Phase Xa not executed by /sdd-tdd — mark tasks [x] manually or re-run /sdd-tdd"

4. **For implementation phases (Xb: User Story Implementation):**
   
   a) **Verify prerequisite TDD phase completed:**
      - Check corresponding Phase Xa — all tests tasks must be `[x]`
      - Check .tdd-gate exists for this branch
      - If either missing, STOP: "Phase Xa must complete and be proven RED before Phase Xb begins"
      
   b) **Execute tasks:**
      - For `[P]`-marked tasks in same phase: execute conceptually in parallel
        (in practice: complete each, but note they have no inter-dependencies)
      - For sequential tasks: complete each fully before starting the next
   
   c) **For each implementation task:**
      - Spawn appropriate expert agent (backend-developer, frontend-developer per tech stack)
      - Agent reads: complete task description, complete spec.md, complete plan.md, relevant FR sections
      - Agent implements the exact task in the exact file path
      - On completion: mark task `[x]` in tasks.md
      - If task fails: spawn debugger agent with full error + context, do NOT mark complete until fixed
   
   d) **After implementation task: RED→GREEN verification** (for TDD tasks):
      - Find corresponding test task from Phase Xa
      - Run the test suite for the implemented module/file
      - Show test output — tests MUST transition from RED to GREEN
      - Report: `✅ T0XX implemented — tests RED→GREEN` or `❌ T0XX implemented — tests still RED [error details]`
      - If tests still RED after implementation: spawn debugger, do NOT mark task [x], diagnose and re-implement
   
   e) **After each task completes:**
      - Mark task as complete in `tasks.md`: change `- [ ]` to `- [x]`
      - Report: `✅ T0XX complete — [brief description]`
      - If task fails, STOP that task, report error clearly, suggest diagnosis

5. **Phase checkpoint:**
   After all tasks in a phase complete:
   ```
   ✅ Phase Xb complete. [N] tasks done, all tests GREEN.

   Checkpoint: [What should work now, per tasks.md]
   Verify independently before proceeding to Phase [X+1]a.
   ```

   For User Story implementation phases, explicitly validate:
   - All tests for this story are GREEN
   - Story works independently (run focused test suite for this story only)
   - Acceptance scenarios from spec.md are validated

### Step 5: Implementation Rules

**File creation:**
- Use exact paths from tasks.md
- Create parent directories if they don't exist
- Follow code structure from plan.md

**Code quality:**
- Follow tech stack conventions from plan.md
- Apply all MUST principles from CONSTITUTION.md
- Implement error handling for all operations
- No hardcoded secrets, connection strings, or environment-specific values

**For TDD implementation (MANDATORY):**
- Tests already written by `/sdd-tdd` and proven RED
- During implementation task execution: focus on making tests GREEN
- After implementing: run tests for that module to confirm GREEN
- Do NOT skip failed tests — if tests stay RED after implementation, fix implementation
- RED→GREEN transition PROVES correct implementation

**TDD workflow:**
```
Phase Xa: Tests (before implementation)
  - Test files created by /sdd-tdd
  - All tests RED
  - .tdd-gate marker created
  
Phase Xb: Implementation
  - T0YY: Implement feature to make T0XX tests pass
  - Run tests → should transition RED→GREEN
  - If still RED: diagnose, fix, re-run
  - Mark complete only after tests GREEN
```

**Progress tracking in tasks.md:**
```markdown
- [x] T001 Initialize project structure ← mark complete after doing
- [x] T002 Install dependencies
- [x] T010 [TDD] [US1] Unit tests for User model ← tests already written by /sdd-tdd
- [x] T011 [TDD] [US1] Integration tests for user creation
- [x] T012 [US1] Create User model ← implement to make T010, T011 GREEN
- [x] T013 [US1] Implement UserService ← implement to make tests GREEN
- [ ] T014 [P] [US1] Implement /users POST endpoint ← still pending
```

### Step 6: Error Handling

If a task fails:
1. Report clearly: "❌ T0XX failed: [error message]"
2. Show relevant output/error
3. Attempt diagnosis from context
4. Propose fix options
5. STOP and wait for user input before continuing
6. Do NOT skip failed tasks (unless user explicitly instructs)

For `[P]`-marked tasks: if one parallel task fails, continue others, collect all failures, report together.

### Step 7: Completion Validation

After all selected phases/tasks complete:

1. **Verify implementation matches spec acceptance scenarios:**
   - For each acceptance scenario in spec.md, verify there's a passing test
   - Run the full test suite: should show all tests GREEN

2. **Verify all tasks in selected scope are marked `[x]`:**
   - Count `- [ ]` remaining — should be 0
   - Count `- [x]` — should equal total tasks

3. **Run full test suite** (if available):
   ```bash
   npm test              # JavaScript
   pytest tests/         # Python
   go test ./...         # Go
   dotnet test          # .NET
   ```
   Report: `[N] tests passing, [N] tests failing`

4. **Check that plan.md technical targets are met:**
   - Performance targets achieved
   - Project structure matches plan.md
   - All layers implemented (models, services, handlers, etc.)
   - All tech stack components integrated

Report:
```
✅ Implementation complete!

Summary:
  Phases completed: Phase 1-N (all selected)
  Tasks completed: N/N [x]
  Tests: [N passing, 0 failing] ✅ (all GREEN)
  Code coverage: [N]% (if applicable)
  Performance targets: [met / needs optimization]

Test Summary:
  Unit tests: [N] passing
  Integration tests: [N] passing
  E2E tests: [N] passing (if applicable)
  Contract tests: [N] passing (if applicable)
  
Acceptance Scenarios Validated:
  [List all from spec.md with ✅ passing indicator]

Verify your feature works end-to-end:
  [Paste relevant quickstart/test commands from plan.md or spec.md]

Next steps:
  1. Test the feature manually against User Story acceptance scenarios
  2. Commit: git add [list changed files explicitly] && git commit -m "feat(NNN): implement [feature name]"
  3. Run /sdd-review for mandatory multi-agent gate review
  4. Address any review findings
  5. Push and open PR: git push -u origin NNN-feature-name
  6. After PR is merged, delete the feature branch
```

## Key Rules

- **TDD is mandatory** — never skip `/sdd-tdd` or the .tdd-gate check
- **RED→GREEN transition required** — implementation is not complete until tests pass
- **CONSTITUTION compliance checked per phase** — before phase execution
- **NEVER skip a failed task** without user approval
- **ALWAYS mark tasks complete** in tasks.md after finishing
- **ALWAYS stop at phase checkpoints** and confirm the increment works
- **NEVER deviate from plan.md** tech stack without flagging it
- **Expert agents used per task type** — backend-developer, frontend-developer, debugger
- **Commit after each phase** or logical group (not required — user preference)
- **Do NOT create PR in this command** — `/sdd-review` gate must run first
