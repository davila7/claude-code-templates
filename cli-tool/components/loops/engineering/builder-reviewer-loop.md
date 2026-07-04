---
name: builder-reviewer-loop
description: Passes code between a builder and an independent reviewer subagent until the review has no blocking findings and tests pass.
category: engineering
interval: 15m
stop-condition: The reviewer reports zero blocking findings and the full test suite passes.
components: [agent:expert-advisors/architect-review, agent:development-team/test-runner, command:git-workflow/pr-review]
tags: [code-review, subagents, quality, loop]
---

# Builder–Reviewer Loop

> **Loop Engineering** — separate the *builder* from the *reviewer* so the agent doesn't grade its own work. Code bounces between them until it genuinely passes.

## 🎯 Goal
Implement a change, then have an **independent reviewer subagent** critique it; iterate on the findings until the review is clean and tests are green.

## ⏱️ Schedule
Suggested interval: `15m` (or run until done on a single feature).

## ▶️ Run it
```
/loop 15m "Implement the next slice of the feature. Then hand it to an independent reviewer subagent for an adversarial review. Address every blocking finding and re-run tests. Continue until the reviewer has no blocking findings and the suite passes."
```

## 🔁 Iteration steps
1. **Build** — implement the next slice of work.
2. **Review** — the `architect-review` agent inspects the diff for correctness, design and risk.
3. **Plan** — collect blocking findings into a fix list.
4. **Act** — address each finding; re-run the suite with `test-runner`.
5. **Observe** — re-review with `/pr-review`; if blocking findings remain, loop again.

## 🛑 Stopping condition
Reviewer reports zero blocking findings **and** all tests pass.

## 🧩 Referenced components
- `agent:expert-advisors/architect-review` — the independent reviewer (no self-grading).
- `agent:development-team/test-runner` — runs the suite each pass.
- `command:git-workflow/pr-review` — structured review checklist.

## 💡 Example
The builder ships a new caching layer; the reviewer flags a race condition and a missing eviction test. The loop fixes both, re-reviews, and exits clean.
