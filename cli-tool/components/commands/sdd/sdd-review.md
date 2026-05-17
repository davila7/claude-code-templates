---
description: "Mandatory multi-agent review gate — runs 6 expert agents and creates the PR gate marker"
argument-hint: "[optional: 'quick' for CRITICAL-only scan, default: full review]"
allowed-tools: Bash(git:*), Bash(touch:*), Read, Grep
---

# SDD Review

Mandatory multi-agent review gate: $ARGUMENTS

## Instructions

Post-implementation review gate orchestrated by 6 expert agents. This command runs BEFORE the PR can be created. All CRÍTICO and ALTO findings must be resolved. Agents verify: security, code quality, architecture alignment, test quality, enterprise security standards, and functionality completeness.

### Step 1: Detect Active Feature

```bash
BRANCH=$(git branch --show-current)
```

Verify `$BRANCH` matches `NNN-feature-name`. Confirm:

- **Required**: All spec artifacts exist in `specs/$BRANCH/`
- **Required**: `tasks.md` exists
- **Required**: `CONSTITUTION.md` exists in project root

### Step 2: Pre-Review Validation Gates

1. **Check tasks.md completion:**
   Count all tasks — extract complete `[x]` and incomplete `[ ]` tasks.
   
   ```bash
   grep -c "^\s*- \[x\]" specs/$BRANCH/tasks.md  # Count complete
   grep -c "^\s*- \[ \]" specs/$BRANCH/tasks.md  # Count incomplete
   ```

   If ANY incomplete tasks remain:
   ```
   ⛔ STOP — Implementation incomplete.
   
   Incomplete tasks in tasks.md:
   [List all remaining [ ] items]
   
   Complete these tasks before /sdd-review.
   Use /sdd-implement to continue.
   ```

2. **Check TDD gate exists:**
   ```bash
   [ -f "specs/$BRANCH/.tdd-gate" ] && echo "exists" || echo "missing"
   ```

   If missing:
   ```
   ⛔ STOP — TDD phase not completed.
   
   Run /sdd-tdd first to prove RED state with failing tests.
   All tests must be proven RED before implementation, and GREEN after.
   ```

3. **Check for code changes:**
   ```bash
   git diff $(git merge-base HEAD main)...HEAD --stat
   ```

   Count changed file lines. Report:
   ```
   Code changes detected:
     [N] files modified
     [+N/-N] lines changed
   ```

### Step 3: Calculate Full Diff

Get the complete diff from merge-base to HEAD:

```bash
DIFF=$(git diff $(git merge-base HEAD main)...HEAD)
```

Show file count:
```
Files in scope for review:
  [List with line counts per file]
```

### Step 4: Spawn 6 Review Agents (Sequential)

Each agent reads the COMPLETE diff and relevant spec artifacts. Agents run one-by-one; wait for each to complete before spawning the next.

---

#### Agent 1: security-engineer

Spawn Agent with this exact prompt:

```
You are a security engineer specializing in application security.

Your task:

1. Read the COMPLETE git diff showing all code changes for this feature (provided below)
2. Read COMPLETE spec.md from specs/$BRANCH/
3. Read COMPLETE plan.md from specs/$BRANCH/
4. Read COMPLETE CONSTITUTION.md from project root
5. Read COMPLETE source files for every modified file (request full content, not just diffs)

Security review checklist:

Authentication & Authorization:
  - Every endpoint/handler must explicitly specify authentication_classes or permission_classes
  - If public endpoint, document why public is acceptable
  - No hardcoded user IDs or role names
  - Authorization must be checked at data layer (not just endpoint layer)

OWASP Top 10 (2023) Check:
  [ ] A01 Broken Access Control — verify user can only access own data
  [ ] A02 Cryptographic Failures — no plaintext passwords, proper hashing (bcrypt/argon2)
  [ ] A03 Injection — all user inputs validated, parameterized queries only
  [ ] A04 Insecure Design — follows CONSTITUTION.md security principles
  [ ] A05 Security Misconfiguration — no debug mode in production, secrets from env
  [ ] A06 Vulnerable Components — no known CVEs in dependencies (check requirements.txt or package.json)
  [ ] A07 Authentication Failures — no plaintext tokens, no hardcoded tokens
  [ ] A08 Data Integrity Failures — proper signature/MAC usage if needed
  [ ] A09 Logging/Monitoring Failures — sensitive data not logged (PII, passwords, tokens)
  [ ] A10 SSRF — no unvalidated external service calls

Input Validation:
  - All fields at system boundary are validated
  - Type checking (not just presence checking)
  - Length limits enforced
  - Email/URL/phone format validation if applicable
  - SQL injection impossible (parameterized queries, ORM validation)
  - XSS impossible (output encoding, input sanitization)

Secrets Management:
  - No hardcoded API keys, passwords, connection strings, JWTs
  - All secrets loaded from environment variables
  - No secrets in error messages or logs
  - .env file excluded from git (.gitignore checked)

Data Protection:
  - PII handled carefully (never logged, encrypted at rest if needed)
  - Passwords hashed with strong algorithm (bcrypt minimum)
  - Sensitive endpoints require HTTPS (documented in plan)
  - Session tokens properly invalidated on logout
  - No sensitive data in URLs or query strings

Rate Limiting & Abuse Prevention:
  - Rate limits on authentication endpoints
  - No endpoints allowing unlimited resource creation
  - Batch operations have reasonable limits

Testing:
  - Security tests exist (auth, injection, boundary)
  - Happy path and negative path both tested

Output findings as a table:

| Finding | Severity | Location | Details | Recommendation |
|---------|----------|----------|---------|-----------------|
| Missing auth on endpoint X | CRÍTICO | src/api/handler.py line 45 | POST /resource has no permission_classes | Add permission_classes = [IsAuthenticated] |

Severity levels:
- CRÍTICO: Immediate security breach possible (broken auth, injection, hardcoded secrets)
- ALTO: Significant risk (weak crypto, missing validation, OWASP violation)
- MEDIO: Should be fixed (logging PII, weak rate limiting)
- BAJO: Nice to have (minor logging, documentation)

Report: Output in markdown table format. End with:
SEVERITY SUMMARY: [N] CRÍTICO, [N] ALTO, [N] MEDIO, [N] BAJO

If CRÍTICO or ALTO exists, mark as BLOCKING.
```

---

#### Agent 2: code-reviewer

Spawn Agent with this exact prompt:

```
You are a senior code reviewer specializing in maintainability and quality.

Your task:

1. Read the COMPLETE git diff showing all code changes
2. Read COMPLETE spec.md, plan.md, CONSTITUTION.md
3. Read COMPLETE source files for every modified file

Code quality review:

SOLID Principles:
  - Single Responsibility: each class/function has one reason to change
  - Open/Closed: open for extension, closed for modification
  - Liskov Substitution: subclasses don't break parent contracts
  - Interface Segregation: clients not forced to depend on unused methods
  - Dependency Inversion: depend on abstractions, not concretes

DRY (Don't Repeat Yourself):
  - No copy-paste code
  - Shared logic extracted to utils/services
  - Magic strings/numbers extracted to constants

Cyclomatic Complexity:
  - No function with >10 decision points (if/else, loops, switches)
  - If found, suggest refactoring to smaller functions
  
Code Style & Naming:
  - Variable names are descriptive (not i, x, temp)
  - Function names are verb+noun (createUser, validateEmail)
  - Consistent indentation (per .eslintrc or linting config)
  - No naming drift (User vs user vs usr in same file)

Error Handling:
  - All operations that can fail have try/catch or error checks
  - No silent failures (swallowing exceptions without logging)
  - Error messages are user-friendly (not stack traces)
  - Proper error propagation up the call stack

Dead Code & Unused Imports:
  - No unreachable code paths
  - All imports are used
  - No commented-out code blocks (delete or document why kept)

Testing & Mocking:
  - Tests are not overly mocked (should test real behavior, not implementation details)
  - soft_fail decorators do NOT exist
  - No trivial assertions (assertEqual(True, True))
  - Actual integration tests, not all mocks

Edge Cases:
  - Null/undefined checks (especially on list iteration)
  - Empty list/array handling
  - Boundary conditions tested
  - Off-by-one errors checked

Anti-patterns Found:
  - No tight coupling between layers
  - No God objects (class doing too much)
  - No feature envy (class accessing too many properties of another)
  - No primitive obsession (overuse of primitives vs domain objects)

Output findings as a table:

| Finding | Severity | Location | Details | Recommendation |
|---------|----------|----------|---------|-----------------|
| High cyclomatic complexity | ALTO | src/services/user_service.py line 34 | validateUser() has 12 decision points | Break into smaller functions |

Severity levels:
- CRÍTICO: Code will not work / major architectural flaw / security issue
- ALTO: Code quality significantly degraded / high maintenance cost
- MEDIO: Improvable but working / minor refactoring needed
- BAJO: Style/polish issue / nice to have

Report: End with:
SEVERITY SUMMARY: [N] CRÍTICO, [N] ALTO, [N] MEDIO, [N] BAJO
```

---

#### Agent 3: architect-reviewer

Spawn Agent with this exact prompt:

```
You are a solution architect specializing in system design and technical debt.

Your task:

1. Read COMPLETE spec.md, plan.md, tasks.md
2. Read COMPLETE diff and all modified source files
3. Read COMPLETE CONSTITUTION.md

Architecture review:

Plan Alignment:
  - Implementation matches plan.md architecture (layers, structure)?
  - No unplanned technology choices introduced?
  - Project structure from plan.md actually implemented?

Coupling & Dependencies:
  - No new coupling introduced between layers (models shouldn't import views, services shouldn't import handlers directly)
  - Dependency injection used where needed
  - No circular dependencies
  - External services decoupled via interfaces

Scalability:
  - No obvious bottlenecks introduced (N+1 queries, unbounded lists)?
  - Database queries efficient (indexes needed if added new queries)?
  - Caching strategy from plan respected?

Data Flow:
  - Data flows through architecture layers as planned
  - No shortcuts (handler directly modifying database)
  - Validation at boundaries (input) and persistence (output)

Technical Debt:
  - Code introduces debt or reduces debt?
  - Any shortcuts taken that should be documented?
  - Complexity tracking from plan.md — violations justified?

Constitution Alignment:
  - All MUST principles from CONSTITUTION.md respected?
  - All SHOULD principles attempted?
  - Any exceptions from plan.md explicitly documented?

Extensibility:
  - Adding future features would be easy or hard?
  - Would changes require touching existing tested code?
  - Are extension points clear (interfaces, abstract classes)?

Performance & Trade-offs:
  - Performance targets from plan.md achieved?
  - Any trade-offs explicitly documented and justified?
  - Caching, async patterns implemented as planned?

Testing Architecture:
  - Tests can run in parallel?
  - Tests don't depend on test execution order?
  - Unit/integration/e2e clearly separated?

Output findings as a table:

| Finding | Severity | Location | Details | Recommendation |
|---------|----------|----------|---------|-----------------|
| N+1 query problem | ALTO | src/services/user_service.py line 67 | Loop fetching users then querying orders per user | Use JOIN or eager load |

Severity levels:
- CRÍTICO: Architectural violation preventing future scaling / core principle violated
- ALTO: Significant coupling / debt introduced / refactoring needed soon
- MEDIO: Suboptimal but acceptable / document debt
- BAJO: Polish / nice to have

Report: End with:
SEVERITY SUMMARY: [N] CRÍTICO, [N] ALTO, [N] MEDIO, [N] BAJO
```

---

#### Agent 4: qa-expert

Spawn Agent with this exact prompt:

```
You are a QA specialist specializing in test completeness and quality.

Your task:

1. Read COMPLETE spec.md — all user stories, acceptance scenarios, FRs, edge cases
2. Read COMPLETE test files in specs/$BRANCH/tests/ (all unit, integration, e2e, contract tests)
3. Read COMPLETE plan.md (test framework, targets)
4. Verify .tdd-gate exists and RED→GREEN transition happened

Test Coverage Review:

Coverage Mapping:
  - Every user story: has at least one test? (unit/integration/e2e)
  - Every functional requirement (FR-NNN): has at least one test?
  - Every acceptance scenario: has at least one happy path + error path test?
  - Every documented edge case: tested?

Test Quality:
  - Tests are NOT overly mocked (test real behavior, not implementation details)
  - NO soft_fail decorators
  - NO skip/xtest/pending markers
  - NO trivial assertions (assertEqual(True, True))
  - Tests have proper Given/When/Then structure
  - Test names are descriptive (what is being tested)
  - Test data is reasonable (not hardcoded secrets, realistic values)

Test Independence:
  - Tests can run in any order?
  - Tests don't depend on shared mutable state?
  - Cleanup happens after each test (rollback, reset)?

Security Testing:
  - Authentication tests: verified correct user required
  - Authorization tests: verified only authorized users can access
  - Injection tests: SQL injection, XSS tested
  - Boundary tests: empty input, null, max size, negative numbers
  - PII: sensitive data not in error messages

Performance Testing:
  - If plan.md specifies performance targets, tests verify?
  - Slow endpoints identified and documented?

TDD Verification:
  - .tdd-gate file exists?
  - Tests were proven RED initially?
  - Tests transitioned to GREEN after implementation?
  - All implementation tests passing?

Count & Report:

| Requirement | Test Count | Coverage | Tests |
|-------------|-----------|----------|-------|
| FR-001 | 1 | ✅ | test_fr_001_happy_path |
| FR-002 | 0 | ❌ | MISSING |

Total coverage percentage: [N]% ([N] of [N] requirements tested)

Output findings:

| Finding | Severity | Location | Details | Recommendation |
|---------|----------|----------|---------|-----------------|
| Missing tests for FR-005 | ALTO | specs/$BRANCH/tests/ | Edge case not tested: empty list | Add test_fr_005_empty_list |

Severity levels:
- CRÍTICO: Core user story untested / acceptance scenario missing test
- ALTO: Major FR missing coverage / edge case untested
- MEDIO: Minor coverage gap / test data could be better
- BAJO: Nice to have / test names could be clearer

Report: End with:
TEST COVERAGE: [N]% ([N] of [N] requirements covered)
SEVERITY SUMMARY: [N] CRÍTICO, [N] ALTO, [N] MEDIO, [N] BAJO
RED→GREEN Transition: ✅ Confirmed (or: ❌ Unable to verify, check .tdd-gate)
```

---

#### Agent 5: se-security-reviewer

Spawn Agent with this exact prompt:

```
You are a security and enterprise compliance specialist.

Your task:

1. Read COMPLETE git diff and all modified source files
2. Read COMPLETE spec.md, plan.md, CONSTITUTION.md
3. Deep security review focusing on enterprise standards

Zero Trust Model:
  - Never trust, always verify (authentication on every call)
  - Principle of least privilege (minimal permissions per user/role)
  - Default deny (whitelist access, not blacklist)
  - Every boundary requires validation
  - Verify every resource operation (user owns resource?)

OWASP LLM Top 10 (if AI/LLM features present):
  [ ] LLM01 Prompt Injection — prompt inputs validated/sanitized
  [ ] LLM02 Insecure Output Handling — LLM outputs encoded before display
  [ ] LLM03 Training Data Poisoning — training data verified clean
  [ ] LLM04 Model Denial of Service — rate limits on LLM calls
  [ ] LLM05 Supply Chain Vulnerabilities — dependencies reviewed
  [ ] LLM06 Sensitive Information Disclosure — no PII in prompts/training
  [ ] LLM07 Insecure Plugin Design — plugins validate inputs
  [ ] LLM08 Model Theft — model access restricted
  [ ] LLM09 Unbounded Consumption — rate limits, cost caps
  [ ] LLM10 Security Misconfiguration — secure defaults

Enterprise Security Standards:
  - Multi-tenancy: if multi-tenant, data isolation verified
  - Audit logging: all user actions logged with timestamp, user, action, resource
  - PII Protection: identified all PII fields, encrypted/masked if needed
  - Compliance: GDPR (retention), HIPAA (if healthcare), SOC2 (if required)
  - Secret management: no secrets in code, logs, or error messages
  - Encryption: TLS for transit, encryption for sensitive data at rest
  - Key rotation: if cryptographic keys exist, rotation strategy documented

Data Layer Authorization:
  - Authorization checks at data layer (not just endpoint)
  - Queries scoped to current user (WHERE user_id = request.user.id)
  - No leaking data between users/tenants
  - Delete operations require owner check

Audit Logging:
  - Who: user identity captured
  - What: action type clear (CREATE, UPDATE, DELETE, READ sensitive data)
  - When: timestamp in UTC
  - Where: resource identifier
  - Why: reason if applicable (e.g., "admin override")
  - Logs not readable by regular users
  - Log retention policy enforced

PII Handling:
  - All PII fields identified (name, email, phone, SSN, IP address, location, etc.)
  - Encryption or masking applied where needed
  - PII never logged in error messages
  - PII not in URL parameters
  - Retention policy enforced (delete after X days if not needed)

Token/Session Security:
  - Tokens expire (TTL < 1 hour for sensitive operations)
  - Tokens secure by default (HttpOnly, Secure flags if cookies)
  - Token revocation on logout (blacklist or session invalidation)
  - No bearer tokens in logs or error messages
  - Token signature verified on every request

External Service Integration:
  - API keys never logged
  - API calls timeout (no hanging forever)
  - Failures handled gracefully (fallback or error without exposing details)
  - Rate limits respected

Output findings:

| Finding | Severity | Location | Details | Recommendation |
|---------|----------|----------|---------|-----------------|
| Missing audit logging | CRÍTICO | src/api/handlers.py | DELETE /user has no audit log | Add audit log: "User {user_id} deleted account" |

Severity levels:
- CRÍTICO: Regulatory violation / data breach risk / zero-trust principle broken
- ALTO: Significant compliance gap / missing encryption / audit gap
- MEDIO: Should document decision / nice to have hardening
- BAJO: Polish / optional improvements

Report: End with:
SEVERITY SUMMARY: [N] CRÍTICO, [N] ALTO, [N] MEDIO, [N] BAJO
```

---

#### Agent 6: functionality-completeness-reviewer

Spawn Agent with this exact prompt:

```
You are a functionality completeness specialist. Your ONLY job is to verify that every behavior described in the spec or issue is (a) implemented in code and (b) covered by a test that would actually fail if the implementation were removed. You do NOT review code quality, security, or architecture — other agents handle that.

Your task:

1. Read COMPLETE spec.md (or the issue body if no spec exists) — every sentence describing expected behavior, every acceptance scenario, every FR-NNN, every UI behavior, every API contract
2. Read ALL changed files in the diff — the actual implementation
3. Read ALL test files added or modified — unit, integration, e2e, contract

For EVERY described behavior, expected outcome, or acceptance criterion:

  a. Find the code that implements it — or mark as MISSING
  b. Find the test that verifies it — or mark as UNTESTED
  c. Classify the test type:
     - BEHAVIORAL: fires a real trigger (HTTP call, user event click, state change) and asserts the outcome
     - STATIC: checks element presence or attribute without triggering any action
  d. Answer the "regression guard" question: "Would this test FAIL if I deleted or reverted the implementation?" 
     - YES = the test catches regressions
     - NO = the test would still pass even if the feature were broken or missing

Output a Functionality Coverage Matrix:

| Behavior Described | Implemented? | Test? | Test Type | Catches Regression? |
|--------------------|-------------|-------|-----------|---------------------|
| Save button enables after audience change | ✅ YES | ❌ NO | — | — |
| API returns 502 when AWS call fails | ✅ YES | ✅ YES | BEHAVIORAL | YES |
| creation_status stays draft if schedule fails | ✅ YES | ✅ YES | BEHAVIORAL | YES |
| Error message is user-friendly (not stack trace) | ✅ YES | ❌ NO | — | — |

After the matrix, list:

CRITICAL GAPS (blocking — must be fixed before PR):
- [Behavior]: Implemented but UNTESTED — no test catches regressions
- [Behavior]: NOT implemented — code was not written

NON-CRITICAL GAPS (warn — follow-up issue recommended):
- [Behavior]: Tested with STATIC test only — test would pass even if feature were removed

VERDICT: COMPLETE or INCOMPLETE — [list every blocking gap if INCOMPLETE]

IMPORTANT rules:
- "Tested" means a test that calls through the real HTTP handler or fires a real user event — NOT a test that only asserts element presence or calls a business logic function directly
- For React/frontend behaviors: only Playwright tests count as behavioral — Node.js scripts without a DOM renderer CANNOT test React interactions
- For Django/API behaviors: only tests using the Django test client or equivalent count — calling service functions directly does NOT count
- A test with assertEqual(True, True) or assertIsNotNone(x) that would pass on broken code is NOT a valid test — mark as static
- Be exhaustive: read every sentence in the spec. Vague descriptions should be flagged as ambiguous, not skipped
- Minimum: flag ALL behaviors that have NO regression-catching test as CRITICAL GAPS
```

---

### Step 5: Aggregate Review Findings

After all 6 agents complete, collect all findings:

```bash
# Pseudo code for aggregation
all_findings = [
  agent1.findings + agent2.findings + agent3.findings + agent4.findings + agent5.findings + agent6.findings
]
```

Deduplicate (if multiple agents reported same issue, keep once with note "also flagged by: [agents]").

Sort by severity: CRÍTICO first, then ALTO, MEDIO, BAJO.

### Step 6: Decision Gate

Apply decision logic:

**If ANY CRÍTICO findings exist:**
```
⛔ BLOCKED — Critical issues must be resolved

CRÍTICO findings (blocking):
[List all CRÍTICO items with location and fix]

Action required:
  1. Resolve each CRÍTICO issue
  2. Commit changes
  3. Run /sdd-review again

Do NOT create PR until all CRÍTICO issues resolved.
```

**Else if ANY ALTO findings exist:**
```
⛔ BLOCKED — High-severity issues must be resolved

ALTO findings (blocking):
[List all ALTO items]

Action required:
  1. Resolve each ALTO issue
  2. Commit changes
  3. Run /sdd-review again

Do NOT create PR until all ALTO issues resolved.
```

**Else (only MEDIO/BAJO or no issues):**

If any MEDIO/BAJO exist:
```
⚠️ Proceed with warnings — Address MEDIO items in follow-up PR

MEDIO findings (non-blocking, fix soon):
[List MEDIO items with fix suggestions]

BAJO findings (polish):
[List BAJO items]

You may proceed to PR creation. Consider opening a follow-up issue for MEDIO items.
```

If zero issues:
```
✅ All clear — No issues found.
Proceed to PR creation.
```

### Step 7: Create Review Gate Marker

Only if no CRÍTICO or ALTO issues:

```bash
touch ~/.claude/.review-gate
chmod 644 ~/.claude/.review-gate
```

This marker signals that `/sdd-review` passed and PR creation is allowed.

If CRÍTICO or ALTO exist, do NOT create this marker.

### Step 8: Handle Quick Mode

If `$ARGUMENTS` includes "quick":

Only run agents 1 (security-engineer) and report CRÍTICO/ALTO only:

```
Quick review mode: CRÍTICO/ALTO scan only

[Agent 1 findings, CRÍTICO + ALTO only]

Result: [BLOCKED or OK to proceed]
```

Skip agents 2-6, skip gate creation logic if only CRÍTICO/ALTO scanned.

### Step 9: Comprehensive Report Output

```markdown
## Code Review Report

**Feature**: NNN-feature-name
**Branch**: [branch]
**Reviewed**: YYYY-MM-DD HH:MM:SS UTC
**Diff**: [N] files, [+N/-N] lines

---

## Review Gate Status

[⛔ BLOCKED / ⚠️ Warnings / ✅ CLEAR]

---

## Detailed Findings

### Agent 1: Security Review
[Table of findings from security-engineer]
CRÍTICO: [N] | ALTO: [N] | MEDIO: [N] | BAJO: [N]

### Agent 2: Code Quality
[Table of findings from code-reviewer]
CRÍTICO: [N] | ALTO: [N] | MEDIO: [N] | BAJO: [N]

### Agent 3: Architecture
[Table of findings from architect-reviewer]
CRÍTICO: [N] | ALTO: [N] | MEDIO: [N] | BAJO: [N]

### Agent 4: Test Quality
[Table of findings from qa-expert]
Test Coverage: [N]%
CRÍTICO: [N] | ALTO: [N] | MEDIO: [N] | BAJO: [N]

### Agent 5: Enterprise Security
[Table of findings from se-security-reviewer]
CRÍTICO: [N] | ALTO: [N] | MEDIO: [N] | BAJO: [N]

### Agent 6: Functionality Completeness
[Coverage matrix from functionality-completeness-reviewer]
CRITICAL GAPS: [N] | NON-CRITICAL GAPS: [N]
VERDICT: COMPLETE or INCOMPLETE

---

## Aggregate Summary

| Severity | Count | Blocking? |
|----------|-------|-----------|
| CRÍTICO  | [N]   | ✅ Yes    |
| ALTO     | [N]   | ✅ Yes    |
| MEDIO    | [N]   | ❌ No     |
| BAJO     | [N]   | ❌ No     |

---

## Next Steps

[If BLOCKED]
Fix all CRÍTICO/ALTO issues and run `/sdd-review` again.

[If OK to proceed]
Ready for PR:
  git add [files]
  git commit -m "feat(NNN): [description]"
  git push -u origin NNN-feature-name
  gh pr create --title "[description]" --body "[description]"
```

## Key Rules

- **Agents read FULL files**, not excerpts — comprehensive analysis
- **CRÍTICO and ALTO block PR** — no exceptions without explicit user override
- **MEDIO/BAJO allow PR** — but should be tracked for follow-up
- **All findings in table format** — easy to scan and reference
- **Security review is deepest** — focus on Zero Trust, not just OWASP
- **Test coverage must reach spec acceptance scenarios** — not arbitrary N%
- **No PR creation happens without gate marker** — enforce discipline
- **Quick mode for high-confidence reviews** — but full review is default
- **Agent findings are recommendations, not dictates** — but CRÍTICO/ALTO indicate real risk
