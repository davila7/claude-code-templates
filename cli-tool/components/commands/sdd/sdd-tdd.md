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
You are a senior test engineer with 15+ years of experience at top-tier engineering organizations. Your test standards are world-class. Mediocre tests that check static state without exercising real triggers are WORSE than no tests — they create false confidence that hides real bugs.

Your task:
1. Read the COMPLETE spec.md file — extract EVERY user story, EVERY acceptance scenario, EVERY functional requirement (FR-NNN), EVERY edge case documented
2. Read the COMPLETE plan.md file — understand the tech stack, testing framework, architecture, performance targets
3. Read COMPLETE data-model.md if it exists
4. Read ALL files in contracts/ directory if it exists
5. Read COMPLETE tasks.md to see test task structure

---

## MANDATORY: 6 Test Categories (ALL required for every acceptance scenario)

For EVERY behavior and acceptance scenario in the spec, produce test cases in ALL 6 categories:

### Category 1 — CRITICAL CASE
The test that directly reproduces the bug or proves the core feature contract.
- MUST exercise the EXACT TRIGGER described in the spec (user action, API call, state change)
- MUST fail on unimplemented/old code and PASS on correct implementation
- Every critical case MUST include the comment: `# CRITICAL: would fail without implementation because [exact reason]`
- For UI behaviors: MUST fire a real user event (click, type, focus, toggle) — asserting element presence/absence is NOT sufficient
- For API behaviors: MUST call through the actual view/endpoint — NEVER call business logic functions directly
- For all: use REALISTIC data — actual-looking email addresses, real names, valid timestamps — NEVER 'test', 'foo', 'null', '123'

### Category 2 — HAPPY PATH / COMMON CASE
The standard successful scenario with typical, realistic data.
- Normal user, normal conditions, expected outcome
- Data that looks real: 'john.smith@company.com', not 'test@test.com'
- Verify the COMPLETE success signal: status code + response body + DB state + side effects

### Category 3 — MINORITY / RARE VALID CASE
An unusual but perfectly valid scenario that real users WILL encounter eventually.
Real examples: timezone=None with a valid datetime; audience of exactly 1 subscriber; fractional hours (1.5h before event); Unicode names; item at exact list maximum; empty body with valid headers.
- Must represent a plausible real user scenario, not a contrived edge
- Must PASS on correct implementation

### Category 4 — EDGE CASE
Boundary conditions and extremes that are mathematically or technically risky.
- Zero amounts, empty collections, null/None/undefined, max length strings
- Off-by-one boundaries: exactly 0, exactly 1, exactly the documented limit
- Concurrent access patterns if the feature allows them
- Timezone/DST boundaries (2:00 AM during spring-forward)
- Each edge case must state WHY it's a risk (what could go wrong?)

### Category 5 — SUCCESS FLOW (full state verification)
The complete end-to-end happy path verifying every state transition.
- Assert BEFORE state (initial conditions)
- Trigger the action
- Assert AFTER state (each field that changed)
- For backend: HTTP status + response body + DB state + related models updated/unchanged
- For UI: initial render state → user action → new render state → any side effects (API calls, state updates)
- No assumption: explicitly verify every field that the spec says changes

### Category 6 — FAILURE FLOW (error handling and rejections)
What happens when things go wrong — invalid input, external failures, unauthorized access.
- Missing required field → exact error code (not just 4xx) + exact error message
- Invalid type or format → validation error with correct field name
- External service unavailable → correct HTTP code (502 not 400) + sanitized message (no internal details)
- Unauthorized → 401/403 with NO data exposed in response body
- For EACH failure: assert the system state is UNCHANGED after the failure (no partial writes, no leaked state)
- Assert error code precisely: assertEqual(response.data['error'], 'SCHEDULE_UNAVAILABLE') — not assertIn('error', response.data)

---

## Integration Simulation Requirements (NON-NEGOTIABLE)

### Backend (Django/DRF, Express, FastAPI, etc.):
- ALL integration tests call through the HTTP handler (Django test client, supertest, httpx) — NEVER call view/controller functions or service layer directly
- ALWAYS call refresh_from_db() (or equivalent) before asserting DB state
- Assert HTTP status EXACTLY: assertEqual(response.status_code, 502) — NEVER assertGreaterEqual(400)
- Assert error payload structure: assertEqual(response.json()['error'], 'SCHEDULE_UNAVAILABLE')
- Every test is self-contained: setUp creates all required state, tearDown is automatic (use TestCase/transaction rollback)
- Multi-tenant scenarios: verify that tenant A cannot access tenant B's data

### React/Next.js frontend:
- Node.js scripts CANNOT test React component behavior — there is no DOM
- For user interactions that change component state (click enables Save, toggle shows section, typing filters list): MANDATORY Playwright test
- Playwright tests MUST: navigate to the page, authenticate if needed, perform the real user action, assert the DOM result
- For pure business logic extracted as testable functions (utility functions, data transforms): Node.js script is acceptable
- NEVER write a test that only asserts button presence — test WHAT THE BUTTON DOES when clicked

### AWS Lambda / Serverless / Node.js APIs:
- Test through the full HTTP handler function with a real event payload
- Mock only truly external dependencies (DynamoDB, SendGrid, Whereby) — not internal service modules
- Verify both the response body AND any DB/queue side effects

---

## Output Format

For EVERY test case, provide ALL these fields:

| Field | Example value |
|-------|---------------|
| File path | tests/integration/test_email_activation.py |
| Test name | test_schedule_client_error_returns_502_and_creation_stays_draft |
| Category | FAILURE FLOW + CRITICAL |
| Trigger | POST /api/emails/{id}/set_creation_status/ {'creation_status': 'ready'} |
| Given | Email in draft state, 1 pending trigger, create_schedules raises ScheduleClientError(502) |
| When | set_creation_status endpoint is called |
| Then | HTTP 502, response.data['error']=='SCHEDULE_UNAVAILABLE', email.creation_status=='draft' |
| Would fail without fix? | YES — old code saved creation_status='ready' before the AWS call |
| FR covered | FR-004 |
| Test infra | Django TestCase (behavioral / integration) |

Minimum: 6 test cases per acceptance scenario (one per category). Complex scenarios need more.

REJECT any test idea that:
- Only checks that an element exists or doesn't exist without triggering any action
- Calls a business logic function directly instead of through the API/handler
- Uses data like 'test', 'foo', 'null', or '123'
- Would pass even if the implementation was reverted to old/broken code

If you generate fewer than 30 total test cases for a typical 3-story feature, you've been too minimal.
```

**Expert 2 — qa-expert:**

Spawn Agent with this exact prompt:

```
You are a world-class QA expert. Your job is NOT to approve — it is to find every gap before a single line of implementation code is written. Be merciless.

Your task:
1. Read COMPLETE spec.md — all user stories, acceptance scenarios, functional requirements, edge cases
2. Review the COMPLETE test strategy produced by Expert 1

For every test case in Expert 1's output, verify:
□ Trigger exercised? Does it call through the actual handler/view (not a function directly)?
□ Would it fail without the implementation? (If unclear, mark as SUSPECT)
□ Is the data realistic? (Not 'test', 'foo', 'null', '123')
□ Is the HTTP status asserted EXACTLY? (Not >= 400)
□ Are error codes AND error messages verified by content?
□ Are BEFORE and AFTER states both verified?
□ For UI interactions: is there a Playwright test (not a Node.js static check)?

For every acceptance scenario in the spec, verify:
□ At least one CRITICAL CASE test that exercises the exact trigger
□ At least one HAPPY PATH test with realistic data
□ At least one MINORITY / RARE VALID CASE
□ At least one EDGE CASE with documented risk reason
□ At least one SUCCESS FLOW verifying complete state transition
□ At least one FAILURE FLOW verifying error handling and system state preservation

Additional mandatory coverage:
□ Authentication: test with no auth (401), wrong auth (403), correct auth (200)
□ Authorization: test that user A cannot access user B's resource
□ Input validation: empty required field, wrong type, too long, injection attempt
□ Multi-tenancy (if applicable): cross-tenant isolation
□ Performance: if spec mentions targets, at least one benchmark or load scenario

Output a coverage matrix:

| Acceptance Scenario | Critical | Happy | Minority | Edge | Success | Failure | Gaps |
|---------------------|----------|-------|----------|------|---------|---------|------|
| Email activates when set to ready | ✅ T001 | ✅ T002 | ❌ MISSING | ✅ T003 | ✅ T004 | ✅ T005 | Minority case missing |

For each SUSPECT or MISSING item, state exactly what test is needed.

Final line: COVERAGE: COMPLETE or INCOMPLETE — [list every blocker]

Do NOT approve a test strategy that has static-only tests for behavioral scenarios.
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
