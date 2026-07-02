---
name: devils-advocate-loop
description: Adversarially challenges a design or decision until every serious objection is resolved or explicitly accepted.
category: evaluation
interval: 15m
stop-condition: No unresolved serious objections remain — each is fixed or consciously accepted with rationale.
components: [agent:expert-advisors/architect-review, agent:expert-advisors/critical-thinking, command:git-workflow/pr-review]
tags: [evaluation, design-review, decision-making, loop]
---

# Devil's-Advocate Loop

> **Loop Engineering** — put a dedicated critic in the loop. It keeps attacking the design until the proposal survives scrutiny or is knowingly accepted with its trade-offs.

## 🎯 Goal
Stress-test a design, RFC, or architectural decision by generating the strongest possible objections, then resolving or explicitly accepting each one — no objection silently ignored.

## ⏱️ Schedule
Suggested interval: `15m` (or run until the design is settled).

## ▶️ Run it
```
/loop 15m "Act as a devil's advocate against the current design. Raise the strongest objections (scaling, security, cost, edge cases, maintainability). For each, either fix the design or record an explicit accepted trade-off with rationale. Continue until no serious objection is unresolved."
```

## 🔁 Iteration steps
1. **Perceive** — read the current design/decision.
2. **Reason** — the `critical-thinking` agent generates the strongest counter-arguments.
3. **Plan** — for each objection, choose fix vs accept-with-rationale.
4. **Act** — update the design or the decision log; `architect-review` validates the revision.
5. **Observe** — re-run with `/pr-review`; stop only when nothing serious is unresolved.

## 🛑 Stopping condition
Every serious objection is either resolved or recorded as an explicit, justified trade-off.

## 🧩 Referenced components
- `agent:expert-advisors/architect-review` — validates each revision.
- `agent:expert-advisors/critical-thinking` — generates adversarial objections.
- `command:git-workflow/pr-review` — structured review of the design changes.

## 💡 Example
A proposed single-region database is challenged on availability; the loop either adds a replication plan or records "single-region accepted for MVP, revisit at scale" with reasoning.
