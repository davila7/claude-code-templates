---
name: build-test-fix-loop
description: Builds the next item on the plan, then runs tests, typecheck and lint, feeding every failure back as the next instruction until the build is green.
category: engineering
interval: 10m
stop-condition: The build is green — tests, typecheck and lint all pass — and the checker reports nothing left to fix.
components: [agent:development-team/test-runner, hook:testing/test-runner, command:testing/generate-tests]
tags: [testing, build, ci, loop]
---

# Build–Test–Fix Loop

> **Loop Engineering** — the single most-demoed loop pattern: a builder writes code and a checker runs tests, typecheck and lint and reports exactly what broke. They pass work back and forth until it's clean. A one-shot agent ships its bugs; this loop catches them.

## 🎯 Goal
Implement the next item on the plan, then run the full check gate (tests + typecheck + lint), feed **every** failure back as the next instruction, and repeat until the build is green.

## ⏱️ Schedule
Suggested interval: `10m` (or run until done on a feature).

## ▶️ Run it
```
/loop 10m "Build the next item on the plan, then run tests, typecheck and lint. Feed every failure back as the next instruction and fix it. Add a test for anything that lacked coverage. Stop when the build is green and the checker has nothing left to report."
```

## 🔁 Iteration steps
1. **Build** — implement the next plan item.
2. **Check** — the `test-runner` hook runs tests, typecheck and lint automatically.
3. **Reason** — collect every failure into a concrete fix list.
4. **Act** — fix each; add tests with `/generate-tests` for uncovered paths.
5. **Observe** — re-run the gate; loop until fully green.

## 🛑 Stopping condition
Tests, typecheck and lint all pass and the checker reports nothing outstanding.

## 💰 Budget & guardrails
Cap iterations or spend so a stubborn failure can't spin forever — surface anything that fails the same way twice for human eyes.

## 🧩 Referenced components
- `agent:development-team/test-runner` — runs and interprets the check gate.
- `hook:testing/test-runner` — fires the suite automatically each pass.
- `command:testing/generate-tests` — covers gaps the loop uncovers.

## 💡 Example
Implementing a new endpoint, the loop catches a type error, then a failing integration test, then a lint warning — fixing each in turn — and exits only when all three gates are green.
