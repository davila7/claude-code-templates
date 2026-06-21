---
name: adversarial-review-loop
description: Has a second, independent model review every change before merge so two different reviewers must agree — code only lands when both clear the bar.
category: engineering
interval: 15m
stop-condition: The implementing agent and the independent cross-model reviewer both approve with no blocking findings and tests pass.
components: [agent:expert-advisors/architect-review, command:git-workflow/gemini-review, command:git-workflow/pr-review]
tags: [code-review, cross-model, quality, loop]
---

# Adversarial-Review Loop

> **Loop Engineering** — the verifier inside the loop is the hard part, and an agent grading its own homework will delete the failing test and call it done. This loop puts a *second, different* model in the reviewer seat: two model families must agree before code lands.

## 🎯 Goal
Implement a change, then have an **independent cross-model reviewer** argue against it. Iterate on findings until both the builder and the outside reviewer sign off — no self-grading.

## ⏱️ Schedule
Suggested interval: `15m` (or run until the change is merge-ready).

## ▶️ Run it
```
/loop 15m "Implement the change. Then have a different model review it adversarially for correctness, security and design. Address every blocking finding and re-run tests. Land it only when both the builder and the independent reviewer agree there are no blocking findings. Max 5 review rounds."
```

## 🔁 Iteration steps
1. **Build** — implement the next slice.
2. **Cross-review** — run `/gemini-review` so a *different* model family critiques the diff.
3. **Reason** — collect blocking findings from the outside reviewer.
4. **Act** — fix them; `architect-review` validates the revision; re-run tests.
5. **Observe** — re-review with `/pr-review`; loop until both sides agree (cap the rounds).

## 🛑 Stopping condition
Both reviewers report zero blocking findings and tests pass — or the review-round cap is reached and the loop hands off with the open findings.

## 💰 Budget & guardrails
A `--max-iter` style cap on review rounds and a severity threshold: only findings at/above the bar block. Two independent models must agree, so neither can rubber-stamp itself.

## 🧩 Referenced components
- `agent:expert-advisors/architect-review` — the in-house reviewer.
- `command:git-workflow/gemini-review` — an independent, different-model review.
- `command:git-workflow/pr-review` — structured re-review checklist.

## 💡 Example
The builder ships an auth change; the cross-model reviewer flags a timing-attack risk the in-house reviewer missed. The loop fixes it, both agree, and only then does it land.
