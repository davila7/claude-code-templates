---
name: test-coverage-loop
description: Adds meaningful tests pass after pass until the suite reaches a target coverage threshold and stays green.
category: engineering
interval: 20m
stop-condition: Coverage meets or exceeds the target (e.g. 90%) with all tests passing and no flaky additions.
components: [agent:performance-testing/test-automator, command:testing/test-coverage, command:testing/generate-tests]
tags: [testing, coverage, quality, loop]
---

# Test Coverage Loop

> **Loop Engineering** — a recurring goal that drives the agent to grow real test coverage incrementally instead of in one risky batch.

## 🎯 Goal
Raise test coverage toward a defined target by adding **meaningful** tests for the least-covered, highest-risk code first — never gaming the metric with empty assertions.

## ⏱️ Schedule
Suggested interval: `20m`.

## ▶️ Run it
```
/loop 20m "Measure current test coverage. Pick the lowest-covered, highest-risk module and add real, behavior-focused tests for it. Re-run the suite. Continue until coverage is at least 90% with everything passing."
```

## 🔁 Iteration steps
1. **Perceive** — run the coverage report and rank uncovered code by risk.
2. **Reason** — identify branches, error paths and edge cases that lack tests.
3. **Plan** — choose one module/area to cover this pass.
4. **Act** — generate tests with `test-automator` + `/generate-tests`.
5. **Observe** — re-run `/test-coverage`; if the suite is green and coverage rose, continue; if flaky, fix before moving on.

## 🛑 Stopping condition
Coverage ≥ target, full suite passes, and no newly-added test is flaky.

## 🧩 Referenced components
- `agent:performance-testing/test-automator` — authors the tests.
- `command:testing/test-coverage` — measures progress each pass.
- `command:testing/generate-tests` — scaffolds new test cases.

## 💡 Example
Starting at 61%, the loop targets the untested error branches of the payment module first, climbing a few points per pass until it crosses 90% with a green suite.
