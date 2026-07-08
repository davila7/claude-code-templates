---
name: quality-streak-loop
description: Runs realistic scenarios and fixes failures until the suite passes N times in a row with no regressions.
category: evaluation
interval: 20m
stop-condition: The scenario suite passes N consecutive times (e.g. 5) with zero failures.
components: [agent:performance-testing/test-automator, hook:testing/test-runner, command:testing/test-quality-analyzer]
tags: [evaluation, reliability, testing, loop]
---

# Quality Streak Loop

> **Loop Engineering** — don't trust a single green run. Require a *streak* of clean passes to prove stability before stopping.

## 🎯 Goal
Exercise the product with realistic scenarios, fix every failure, and keep going until the suite passes N consecutive times — catching flakiness and intermittent bugs.

## ⏱️ Schedule
Suggested interval: `20m`.

## ▶️ Run it
```
/loop 20m "Run the realistic scenario suite. Fix any failure you find, including flaky ones. Reset the streak counter on any failure. Continue until the suite passes 5 times in a row."
```

## 🔁 Iteration steps
1. **Perceive** — run the scenario suite via the `test-runner` hook.
2. **Reason** — analyze failures (real bug vs flake) with `/test-quality-analyzer`.
3. **Plan** — fix the failure and harden the test.
4. **Act** — implement the fix with `test-automator`; reset the streak on any failure.
5. **Observe** — repeat; only stop after N consecutive clean runs.

## 🛑 Stopping condition
N consecutive passes (default 5) with zero failures or flakes.

## 🧩 Referenced components
- `agent:performance-testing/test-automator` — fixes and hardens tests.
- `hook:testing/test-runner` — auto-runs the suite.
- `command:testing/test-quality-analyzer` — distinguishes real bugs from flakes.

## 💡 Example
The suite passes 4 times then a timing-dependent test flakes; the loop stabilizes it with a deterministic clock and restarts the streak until it hits 5 clean.
