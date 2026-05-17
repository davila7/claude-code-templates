---
description: Full GitHub Project issue lifecycle — triage Backlog items, pick next by priority, implement in the correct repo, commit, and close. Reads org-specific config from the nearest .claude/issue-flow-context.md up the directory tree.
argument-hint: [triage|work|auto] [--issue <number>]
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Task
---

# Issue Flow

Automate the full lifecycle of a GitHub Project issue: Backlog → Ready → In Progress → Local Completed.

## Context Discovery

Before doing anything, locate the org-specific context file by walking up from CWD:

```bash
CONTEXT_FILE=""
DIR="$PWD"
while [ "$DIR" != "/" ]; do
  if [ -f "$DIR/.claude/issue-flow-context.md" ]; then
    CONTEXT_FILE="$DIR/.claude/issue-flow-context.md"
    break
  fi
  DIR=$(dirname "$DIR")
done
```

If `CONTEXT_FILE` is empty, stop and tell the user: "No `.claude/issue-flow-context.md` found in the directory tree. Create one following the template in the global commands documentation."

**Read `$CONTEXT_FILE` fully before continuing.** All org-specific values (project IDs, field IDs, repo list, routing rules, test conventions) come from that file.

## Mode Detection

Parse `$ARGUMENTS`:

| Argument | Mode |
|----------|------|
| `triage` | Triage only — analyze Backlog, move to Ready or comment |
| `work` | Work only — pick next Ready issue and implement it |
| `auto` | Triage first, then immediately work on the top issue |
| `--issue <N>` | Force a specific issue number (skip priority selection) |
| *(empty)* | Default: `work` |

---

## Mode: TRIAGE

### Step 1 — Fetch Backlog issues

```bash
gh api graphql -f query='
{
  user(login: "<ORG>") {
    projectV2(number: <PROJECT_NUMBER>) {
      items(first: 100) {
        nodes {
          id
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
            }
          }
          content {
            ... on Issue {
              number title body labels(first: 10) { nodes { name } } comments(last: 5) { nodes { body author { login } } }
            }
          }
        }
      }
    }
  }
}'
```

Filter for items where Status == "Backlog".

### Step 2 — Analyze each Backlog issue

For each issue, determine:

**Move to Ready if ALL of these are true:**
- Title and description clearly describe the problem/feature
- No `[NEEDS CLARIFICATION]` or open questions in the body
- The affected repo can be inferred from labels, file paths, or description
- The expected behavior is testable

**Leave a comment and keep in Backlog if ANY of these is true:**
- The expected behavior is ambiguous or missing
- No reproduction steps on a bug
- The solution requires a business decision not yet made
- Multiple conflicting approaches described without a clear direction

### Step 3 — Execute decisions

For each "Move to Ready" issue:
```bash
gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: { projectId: "<PROJECT_ID>" itemId: "<ITEM_ID>" fieldId: "<STATUS_FIELD_ID>" value: { singleSelectOptionId: "<READY_OPTION_ID>" } }) { projectV2Item { id } } }'
```

For each "Needs comment" issue:
```bash
gh issue comment <NUMBER> --repo <ORG>/<REPO> --body "..."
```
Write the comment in English. Tag the issue author. Be specific about what information is missing.

### Step 4 — Report

Print a summary table: issue number, title, decision (Ready / Needs clarification), reason.

---

## Mode: WORK

### Step 1 — Select issue

If `--issue <N>` was given, fetch that issue directly and skip the selection logic.

Otherwise, fetch all Ready issues and sort by priority using these rules (from the context file's priority order). Pick the first one.

```bash
gh api graphql -f query='{ user(login: "<ORG>") { projectV2(number: <PROJECT_NUMBER>) { items(first: 100) { nodes { id fieldValues(first: 20) { nodes { ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2SingleSelectField { name } } } } } content { ... on Issue { number title body labels(first: 10) { nodes { name } } } } } } } } }'
```

Filter for Status == "Ready". Sort by Priority field (P0 > P1 > P2 > No Priority). Take the top issue.

### Step 2 — Move to In Progress

```bash
gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: { projectId: "<PROJECT_ID>" itemId: "<ITEM_ID>" fieldId: "<STATUS_FIELD_ID>" value: { singleSelectOptionId: "<IN_PROGRESS_OPTION_ID>" } }) { projectV2Item { id } } }'
```

### Step 2.5 — TEST SPEC (mandatory before implementation)

⛔ **Do NOT delegate to the domain agent yet.** First, spawn a qa-expert to define exactly what tests are required for this issue.

Spawn Agent with subagent_type `qa-expert` and this prompt:

```
You are a world-class QA expert. Your job is to define the complete test specification for a bug fix or feature BEFORE any implementation begins.

Read the COMPLETE issue body below. Extract every behavior, expected outcome, edge case, and acceptance criterion described.

Issue body:
[PASTE FULL ISSUE BODY HERE]

Target repo and test conventions (from context file):
[PASTE TEST CONVENTIONS FROM CONTEXT FILE HERE]

For EVERY described behavior, produce a test case in ALL 6 categories:

### Category 1 — CRITICAL CASE
The test that directly proves the bug is fixed or the feature works.
- MUST exercise the EXACT TRIGGER described (user action, API call, state change)
- MUST fail on broken/old code and PASS on correct implementation
- Comment: # CRITICAL: would fail without fix because [exact reason]
- For Django/API: call through the HTTP handler (test client), never service functions directly
- For React UI: must be a Playwright test that fires a real user event — NOT a Node.js script checking element presence

### Category 2 — HAPPY PATH
Standard successful scenario with realistic data.
- Real-looking data: 'john.smith@company.com', not 'test@test.com'
- Verify complete success signal: status code + response body + DB state

### Category 3 — MINORITY / RARE VALID CASE
Unusual but valid scenario real users will eventually hit.
- Examples: empty audience, single subscriber, Unicode names, exact boundary values
- Must PASS on correct implementation

### Category 4 — EDGE CASE
Boundary conditions and extremes.
- Zero amounts, empty collections, null/None, max length
- Off-by-one boundaries
- State why each is a risk

### Category 5 — SUCCESS FLOW (full state verification)
Complete state verification before AND after.
- Assert BEFORE state (initial conditions)
- Trigger the action
- Assert AFTER state (every field the issue says changes)
- For backend: HTTP status + response body + DB state

### Category 6 — FAILURE FLOW
What happens when things go wrong.
- Missing required field → exact error code + exact message
- External service unavailable → correct HTTP code (502 not 400)
- Unauthorized → 401/403 with NO data exposed
- Assert system state is UNCHANGED after each failure

For every test case output:
| Field | Value |
|-------|-------|
| Test name | descriptive_snake_case_name |
| Category | (1-6 above) |
| Trigger | exact HTTP call or user action |
| Given | initial state |
| When | action taken |
| Then | expected outcome + DB state |
| Would fail without fix? | YES or NO + why |
| Test infra | Django TestCase / Playwright / pytest |

REJECT any test that:
- Only checks element presence without triggering an action
- Calls business logic functions directly instead of through the API
- Uses data like 'test', 'foo', 'null', '123'
- Would pass even on broken or reverted code

Output: numbered test list. End with:
TEST SPEC COMPLETE: [N] tests across 6 categories
```

**Wait for qa-expert to complete.** Store the TEST SPEC output — it will be passed to the domain agent in Step 4.

If the qa-expert cannot produce at least one test per category, STOP and add a comment to the issue asking for more detail about the expected behavior. Do NOT proceed to implementation.

### Step 3 — Determine target repo and agent

Read the issue labels and body. Cross-reference with the `Agent Routing` section of the context file.

Determine:
- **Target repo**: which directory to work in
- **Agent type**: which subagent to spawn
- **Branch**: which branch to check out (from context file)

### Step 4 — Delegate to domain agent

Spawn the appropriate subagent with a self-contained prompt that includes:
1. Full issue body (copy verbatim)
2. The complete TEST SPEC from Step 2.5 (copy verbatim) — the agent must implement ALL tests from the spec
3. Target repo path
4. Branch to work on
5. Relevant file paths (if known from issue body or labels)
6. Test conventions for that repo (from context file)
7. Commit message format (from context file)
8. These explicit instructions:

```
MANDATORY IMPLEMENTATION RULES:

1. Write ALL tests from the TEST SPEC before or alongside implementation. Do not skip any category.
2. Every test MUST call through the real handler/endpoint — never call service functions or business logic directly.
3. For React/frontend behavioral tests: Playwright tests are mandatory — Node.js scripts cannot test React interactions.
4. Tests must use realistic data — no 'test', 'foo', 'null', '123'.
5. Assert HTTP status codes EXACTLY: assertEqual(response.status_code, 502) — never assertGreaterEqual(400).
6. Assert error codes by content: assertEqual(response.data['error'], 'SCHEDULE_UNAVAILABLE') — not just assertIn('error', response.data).
7. Run the full test suite after implementation — all tests must pass.
8. After tests pass, do a self-completeness check:
   - Re-read the original issue body sentence by sentence
   - For EACH described behavior, confirm: (a) code implements it, (b) a test would fail if the code were removed
   - If any behavior is unimplemented or only covered by a static test, fix it before committing
9. Do NOT commit until all tests pass and the self-completeness check passes.
```

Use the `Agent` tool with `subagent_type` matching the routing table.

### Step 4.5 — TEST QUALITY GATE (mandatory before marking complete)

After the domain agent returns, **before moving to Local Completed**, spawn a functionality-completeness-reviewer to verify the work is genuinely done.

Spawn Agent with subagent_type `general-purpose` and this prompt:

```
You are a functionality completeness specialist. Your ONLY job is to verify that every behavior described in the issue is implemented AND covered by a test that would actually fail if the implementation were removed.

Issue body (source of truth for required behaviors):
[PASTE FULL ISSUE BODY HERE]

TEST SPEC (the tests that were required):
[PASTE TEST SPEC FROM STEP 2.5 HERE]

Your task:
1. Read ALL changed files (git diff vs base branch)
2. Read ALL test files that were added or modified
3. For EVERY behavior described in the issue AND every test from the TEST SPEC:

   a. Find the code that implements it — or mark as MISSING
   b. Find the test that verifies it — or mark as UNTESTED
   c. Classify the test:
      - BEHAVIORAL: calls through real HTTP handler / fires real user event in Playwright
      - STATIC: checks element presence or attribute without triggering any action
   d. Answer: "Would this test FAIL if the implementation were deleted?" YES or NO

Output a Functionality Coverage Matrix:

| Behavior / Test Spec Item | Implemented? | Test? | Test Type | Catches Regression? |
|---------------------------|-------------|-------|-----------|---------------------|

CRITICAL GAPS (blocking — implementation is NOT complete):
- Behavior X: not implemented in code
- Behavior Y: implemented but no behavioral test — a static test that passes on broken code does not count

NON-CRITICAL GAPS (warn — follow-up issue recommended):
- Test Z: only covered by a static assertion — recommend adding behavioral test

VERDICT: COMPLETE or INCOMPLETE — [list every blocking gap]

Rules:
- Django/DRF tests MUST use the test client — calling view functions or service methods directly is NOT a real test
- React tests MUST use Playwright — a Node.js script that checks element.disabled is NOT a behavioral test
- assertEqual(True, True) or assertIsNotNone(x) that passes even on broken code = STATIC, mark accordingly
- "Tests pass" is NOT the same as "tests prove the feature works"
```

**If VERDICT is INCOMPLETE:**
```
⛔ QUALITY GATE FAILED

The implementation is incomplete. Critical gaps:
[List from completeness reviewer]

Action:
  1. Move issue back to "Ready" in GitHub Project
  2. Add comment to issue: "Implementation returned incomplete. Missing: [gaps]. Reopening for rework."
  3. Do NOT commit.
  4. Stop — do not attempt to fix inline; re-run issue-flow for this issue.
```

Execute the rollback:
```bash
gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: { projectId: "<PROJECT_ID>" itemId: "<ITEM_ID>" fieldId: "<STATUS_FIELD_ID>" value: { singleSelectOptionId: "<READY_OPTION_ID>" } }) { projectV2Item { id } } }'
gh issue comment <NUMBER> --repo <ORG>/<REPO> --body "Implementation returned with gaps: [list gaps]. Moved back to Ready for rework."
```

**If VERDICT is COMPLETE (with or without non-critical warnings):**
```
✅ Quality gate passed — all described behaviors implemented and covered by behavioral tests.
```
Proceed to Step 5.

### Step 5 — Move to Local Completed

Only reached if the quality gate in Step 4.5 passed.

```bash
gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: { projectId: "<PROJECT_ID>" itemId: "<ITEM_ID>" fieldId: "<STATUS_FIELD_ID>" value: { singleSelectOptionId: "<LOCAL_COMPLETED_OPTION_ID>" } }) { projectV2Item { id } } }'
```

### Step 6 — Report

Print: issue number, title, repo, files changed, commit hash, new status, test summary (N tests added, categories covered).

---

## Mode: AUTO

Run TRIAGE first (full), then immediately run WORK for the top-priority Ready issue.

---

## GraphQL Helper — Get item ID for an issue number

```bash
gh api graphql -f query='{ user(login: "<ORG>") { projectV2(number: <PROJECT_NUMBER>) { items(first: 100) { nodes { id content { ... on Issue { number } } } } } } }' \
| python3 -c "import json,sys; items=json.load(sys.stdin)['data']['user']['projectV2']['items']['nodes']; [print(i['id']) for i in items if i.get('content',{}).get('number')==<ISSUE_NUMBER>]"
```

---

## Rules

1. **Always read the context file first** — never hardcode IDs or repo paths.
2. **One issue at a time** in WORK mode. Do not batch.
3. **TEST SPEC is mandatory** (Step 2.5) — do not delegate to the domain agent without it.
4. **Quality gate is mandatory** (Step 4.5) — do not mark complete without completeness verification.
5. **Tests are behavioral, not static** — tests checking element presence without triggering actions do not count.
6. **"Tests pass" ≠ "feature works"** — the quality gate enforces this distinction explicitly.
7. **Never push** — only commit locally. Push and PR creation is a separate step.
8. **Never modify issues or statuses without first confirming the issue is in the expected state** — re-fetch before mutating.
9. If the domain agent returns an error or fails the quality gate, move the issue back to "Ready", add a comment explaining what failed, and stop.
