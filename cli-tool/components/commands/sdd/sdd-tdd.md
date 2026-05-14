---
description: "Generate failing tests from spec and contracts — RED state must be proven before /sdd-implement"
argument-hint: "[optional: 'unit' | 'integration' | 'e2e' | 'all' (default: all)]"
allowed-tools: Bash(git:*), Bash(mkdir:*), Bash(npm:*), Bash(pip:*), Bash(python:*), Bash(node:*), Bash(dotnet:*), Bash(go:*), Bash(cargo:*), Read, Write, Edit
---

# SDD TDD

Generate failing tests from spec and contracts: $ARGUMENTS

## Instructions

Generate the full test suite BEFORE any implementation code exists. Tests must fail (RED state) before implementation begins. This command orchestrates expert analysis and test generation to ensure comprehensive coverage of all acceptance scenarios, functional requirements, and edge cases.

### Step 1: Detect Active Feature

```bash
BRANCH=$(git branch --show-current)
```

Verify `$BRANCH` matches `NNN-feature-name`. Load from `specs/$BRANCH/`:

- **Required**: `spec.md`, `plan.md`, `tasks.md`
- **Load if exists**: `data-model.md`, `contracts/`, `research.md`
- **Required**: `CONSTITUTION.md` from project root

If any required file is missing, STOP with clear instruction on which command to run first.

### Step 2: Validate Prerequisites

1. **Check spec.md exists and is populated:**
   - Must have at least one User Story with acceptance scenarios
   - Must have at least one Functional Requirement (FR-NNN)
   - All `[NEEDS CLARIFICATION]` markers must be resolved

2. **Check plan.md exists:**
   - Must specify testing framework (Jest, pytest, Go test, etc.)
   - Must specify project structure with `tests/` directory layout

3. **Check tasks.md exists:**
   - Must have tasks with `[TDD]` label (or label them now if missing)
   - Test tasks must come BEFORE corresponding implementation tasks
   - Extract all test file paths from task descriptions

**If prerequisites missing**, STOP with one of these messages:
- "Run `/sdd-specify` first — need spec with user stories and FRs"
- "Run `/sdd-plan` first — need plan.md with testing framework"
- "Run `/sdd-tasks` first — need tasks.md with task breakdown"
- "Resolve all [NEEDS CLARIFICATION] markers in spec.md first"

### Step 3: Mandatory Expert Analysis Phase

Before writing ANY test code, spawn two experts in parallel to validate test strategy:

**Expert 1 — test-engineer:**

Spawn Agent with this exact prompt:

```
You are a test engineer specializing in comprehensive test strategy.

Your task:
1. Read the COMPLETE spec.md file — extract EVERY user story, EVERY acceptance scenario, EVERY functional requirement (FR-NNN), EVERY edge case documented
2. Read the COMPLETE plan.md file — understand the tech stack, testing framework, architecture
3. Read COMPLETE data-model.md if it exists
4. Read ALL files in contracts/ directory if it exists
5. Read COMPLETE tasks.md to see test task structure

Now produce an exhaustive test strategy covering:
- Unit tests: for each model, service, or pure function
- Integration tests: for each user journey through multiple layers
- E2E tests: critical user workflows end-to-end
- Contract tests: if contracts/ directory exists, test each endpoint/interface

For EVERY acceptance scenario:
  - Happy path test
  - Error/negative path test  
  - At least one edge case test

Output format — list every test case with:
- Test file path (relative to project root)
- Test name (descriptive, no spaces, e.g., test_user_can_create_post_with_title)
- Category (unit/integration/e2e)
- Given/When/Then in 1 sentence each
- Which FR it covers
- Which acceptance scenario it covers

Minimum: 3 test cases per acceptance scenario.

Be exhaustive — if you list <20 total test cases, you've been too minimal.
```

**Expert 2 — qa-expert:**

Spawn Agent with this exact prompt:

```
You are a QA expert specializing in test coverage completeness.

Your task:
1. Read COMPLETE spec.md — all user stories, acceptance scenarios, functional requirements, edge cases
2. Review the test strategy produced by the test engineer (wait for their output if needed)

Verify:
- Every user story has at least one test
- Every functional requirement (FR-NNN) has at least one test
- Every documented edge case has a test
- Security test cases exist: authentication, authorization, injection (XSS, SQL), boundary conditions, data validation
- Performance test cases exist if spec mentions performance targets

Rate the test coverage as one of:
- COMPLETE: All areas covered, comprehensive edge cases
- INCOMPLETE: Missing coverage in [specific areas]

If INCOMPLETE, list exactly which areas are missing.

Output a simple table:
| Area | Covered? | Notes |
|------|----------|-------|
| User Story [N] | Yes/No | [which tests] |
| FR-[NNN] | Yes/No | [which tests] |
| Edge case [name] | Yes/No | [reason if no] |
| Security: Auth | Yes/No | ... |
| Security: Injection | Yes/No | ... |
| Boundary conditions | Yes/No | ... |

Final line: COVERAGE: COMPLETE or INCOMPLETE — [blockers if any]
```

**Wait for both agents to complete.** Collect their outputs.

### Step 4: Coverage Gate Check

Review the QA expert's output:

**If COVERAGE is INCOMPLETE:**

```
⛔ STOP — Test coverage is incomplete.

Missing coverage:
[List from QA expert report]

Action: Ask test engineer to expand test strategy before proceeding to test file generation.
Do NOT write test files yet.
```

Wait for test engineer to provide expanded strategy, then re-validate with QA expert.

**If COVERAGE is COMPLETE:**

```
✅ Test coverage validated as complete.
Proceeding to test file generation.
```

### Step 5: Write Test Files

Using the test engineer's exhaustive list:

1. **Create test directory structure** (from plan.md):
   ```bash
   mkdir -p tests/unit
   mkdir -p tests/integration
   mkdir -p tests/e2e          # if applicable
   mkdir -p tests/contract     # if API contracts exist
   ```

2. **For each test case in the strategy**, create the test file with:
   - Exact file path from test engineer output
   - Test name exactly as specified
   - Given/When/Then structure
   - **CRITICAL**: Test must import/require the NOT-YET-EXISTING implementation

   **Test structure template** (adapt to your testing framework):

   ```javascript
   // Example for Jest/JavaScript
   describe('[Feature]: [Module]', () => {
     describe('[Functionality]', () => {
       test('should [given condition] [when action] [then result]', () => {
         // Given
         const input = { ... };
         
         // When
         const result = serviceNotYetCreated.doSomething(input);
         
         // Then
         expect(result).toBe(expectedValue);
       });
     });
   });
   ```

   ```python
   # Example for pytest
   import pytest
   from src.services.user_service import UserService  # Not yet created
   
   class TestUserService:
       def test_should_create_user_with_valid_email(self):
           # Given
           service = UserService()
           email = "test@example.com"
           
           # When
           user = service.create_user(email)
           
           # Then
           assert user.email == email
   ```

3. **For each test file created:**
   - Write it to the exact path from test engineer output
   - Do NOT create implementation files or mock the non-existent code
   - Do NOT use soft_fail decorators or skip markers
   - Tests MUST be executable (syntax correct) even though imports will fail

### Step 6: Prove RED State

Run the entire test suite to confirm all tests FAIL:

```bash
# For JavaScript/Jest:
npm test 2>&1

# For Python/pytest:
python -m pytest tests/ -v 2>&1

# For Go:
go test ./... -v 2>&1

# For .NET:
dotnet test 2>&1
```

Capture output. Count:
- Total tests: [N]
- Tests failed: [N] ← must be equal to total
- Tests passed: [N] ← must be 0
- Tests skipped: [N] ← must be 0

**Red state verification:**

If any tests PASS before implementation:
```
⛔ ERROR: Tests passed before implementation.

This indicates:
- Test is testing implementation details (too tightly coupled)
- Test is importing a real implementation that shouldn't exist yet
- Test has a mocked/stubbed assertion

Action: Inspect failing tests and fix them to actually import/test the non-existent implementations.
Do NOT proceed until ALL tests are RED.
```

If all tests FAIL as expected:
```
✅ RED state confirmed.
[N] tests, all failing, ready for implementation.
```

Show test output excerpt (first 50 lines of failure stack traces, to prove they're real failures).

### Step 7: Create TDD Gate Marker

Mark that TDD phase was completed and RED state was proven:

```bash
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
COMMIT=$(git rev-parse --short HEAD)
echo "$TIMESTAMP RED $COMMIT" > specs/$BRANCH/.tdd-gate
```

This marker is required before `/sdd-implement` can proceed.

### Step 8: Update tasks.md

Mark all TDD test tasks as complete:

- Find all tasks with `[TDD]` label
- Change `- [ ]` to `- [x]` for each

Example:
```markdown
- [x] T010 [TDD] [US1] Contract test for login endpoint — tests/contract/test_login.ts
- [x] T011 [TDD] [US1] Unit tests for AuthService — tests/unit/test_auth_service.ts
```

### Step 9: Update .claude/sdd-context.md

Add TDD completion status:

```markdown
- **TDD**: specs/NNN-feature-name/.tdd-gate ✅ (RED state proven at [timestamp])
  - Test files created: [N]
  - Test coverage: [unit: N, integration: N, e2e: N, contract: N]
  - All tests failing: ✅
```

### Step 10: Report

Output comprehensive summary:

```
✅ TDD Phase Complete — RED State Proven

Test Files Generated:
  specs/$BRANCH/
  ├── tests/
  │   ├── unit/          [N] files
  │   ├── integration/   [N] files
  │   ├── e2e/          [N] files (if applicable)
  │   └── contract/     [N] files (if applicable)

Test Coverage by Category:
  Unit tests:           [N]
  Integration tests:    [N]
  E2E tests:           [N]
  Contract tests:      [N]
  ─────────────────────────
  Total:               [N]

RED State Verification:
  Tests run:           [N]
  Tests failed:        [N] ✅ (all RED)
  Tests passed:        0 ✅
  Tests skipped:       0 ✅

Test Coverage Completeness:
  User Stories:        [N]/[N] covered ✅
  Functional Reqs:     [N] FRs covered ✅
  Acceptance Scenarios: [N]/[N] covered ✅
  Edge Cases:          [N] tested ✅
  Security Tests:      ✅ auth, injection, boundary
  QA Report:           COMPLETE ✅

Git Marker: specs/$BRANCH/.tdd-gate ✅
  Created: [timestamp]
  Commit: [hash]

Next Step:
  /sdd-implement will use these tests to drive implementation RED → GREEN.

To verify RED state yourself:
  npm test                 (JavaScript)
  pytest tests/            (Python)
  go test ./...           (Go)
  dotnet test             (.NET)
```

## Key Rules

**NEVER write implementation code in this step** — only test files with failing imports/calls.

**RED state is not optional** — if tests can't be proven RED, diagnose and fix before proceeding.

**Test files must use the exact framework** from plan.md (Jest, pytest, etc.) — consistency matters.

**Every spec acceptance scenario must have at least one test** — use test-engineer's output to validate.

**Experts read FULL files** — not excerpts — so they produce exhaustive analysis.

**Expert agents must complete successfully** — if either agent fails, stop and diagnose before retrying.

**Tasks.md TDD tasks are marked complete** — so `/sdd-implement` knows which tasks are test-driven.

**No soft_fail, skip, or xtest decorators** — tests must be executable and prove they fail.
