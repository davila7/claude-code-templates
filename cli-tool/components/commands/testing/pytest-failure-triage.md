---
name: pytest-failure-triage
allowed-tools: Read, Write, Edit, Bash
argument-hint: "[pytest-output-file] | [failing-test-name] | [path-to-project]"
description: Analyze pytest failures, group related errors, identify likely root causes, and propose the smallest useful fix plan
---

# Pytest Failure Triage

Analyze pytest failures for: $ARGUMENTS

## Purpose

This command helps diagnose failing pytest runs efficiently by:
1. Grouping failures that likely share the same root cause
2. Distinguishing test bugs from application bugs
3. Identifying fixture, import, environment, and assertion-pattern issues
4. Proposing the smallest high-confidence fix plan first
5. Suggesting what to re-run after each fix

## Current Context

- Pytest configuration: @pytest.ini or @pyproject.toml or @tox.ini or @setup.cfg
- Python dependencies: @requirements.txt or @poetry.lock or @Pipfile or @pyproject.toml
- Existing test layout: !`find . -type f \\( -name "test_*.py" -o -name "*_test.py" \\) | head -50`
- Recent failures or logs: @$ARGUMENTS
- Recent code changes: !`git diff --stat HEAD~1 2>/dev/null || git diff --stat`
- Git status: !`git status --short`

## Task

Review the available pytest failure output and repository context, then produce a triage report that includes:

1. **Failure Summary**
   - number of failing tests
   - number of distinct failure clusters
   - likely severity
   - likely first blocker
   - overall confidence

2. **Failure Clusters**
   For each cluster:
   - failing tests involved
   - shared error signature
   - probable root cause
   - confidence level: high / medium / low

3. **Root Cause Classification**
   Classify each cluster into one of:
   - application logic bug
   - outdated test expectation
   - fixture/setup issue
   - import/module path issue
   - environment/configuration issue
   - dependency/version mismatch
   - flaky or order-dependent behavior
   - data/seed/migration issue
   - typing or mocking issue

4. **Minimal Fix Plan**
   - suggest the smallest reasonable fix first
   - avoid broad refactors unless clearly necessary
   - identify exact files likely to need changes
   - note whether production code, tests, or both should change

5. **Verification Plan**
   - exact pytest command(s) to run after each fix
   - whether to rerun a single test, test file, marker group, or full suite

## Process

Follow this workflow:

1. Parse the pytest output and identify repeated stack traces, exception types, fixture names, and failing modules
2. Group failures that likely stem from the same underlying issue
3. Check whether failures correlate with recent code changes
4. Inspect relevant source files, test files, fixtures, and configuration
5. Prefer root-cause elimination over one-off patching
6. Recommend the smallest safe fix sequence
7. End with a concise action plan in priority order

## Triage Heuristics

### Signs of a shared root cause
- multiple failures with the same exception type
- the same fixture failing across many tests
- import errors affecting many modules
- one upstream API/schema change breaking multiple assertions
- one migration or seed issue causing broad failures

### Common pytest-specific patterns
- `ModuleNotFoundError` or `ImportError` → import path, packaging, environment, or dependency issue
- fixture not found → fixture naming, scope, conftest discovery, or plugin loading issue
- many assertion diffs after a UI/API change → tests may need expectation updates, but verify intended behavior first
- time/date randomness → flaky test or missing freeze/mocking
- order-dependent failures → hidden shared state, fixture scope, cache leakage, DB cleanup issue
- mocking failures → patched wrong symbol path or interface drift
- parameterized test waves → likely one shared implementation regression

## Output Format

Use exactly this structure:

```md
# Pytest Failure Triage Report

## Failure summary
- Failing tests:
- Distinct clusters:
- Likely severity:
- Likely first blocker:
- Overall confidence:

## Cluster 1
- Tests involved:
- Shared signal:
- Likely root cause:
- Classification:
- Confidence:
- Suggested fix:

## Cluster 2
- Tests involved:
- Shared signal:
- Likely root cause:
- Classification:
- Confidence:
- Suggested fix:

## Minimal fix plan
1.
2.
3.

## Verification plan
- Step 1:
- Step 2:
- Step 3:

## Notes
- Risks:
- Assumptions:
- Unknowns:

---
