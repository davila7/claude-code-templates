---
name: anti-spin-build-loop
description: Builds toward a machine-checkable contract with explicit anti-spin guardrails — stops on no progress, repeated approaches, flip-flopping, or a spend budget.
category: engineering
interval: 15m
stop-condition: The machine-checkable contract passes, or an anti-spin guard trips (no progress, repeated/flip-flopping approach, or budget hit).
components: [agent:expert-advisors/architect-review, command:git-workflow/pr-review, hook:quality-gates/scope-guard]
tags: [reliability, guardrails, budget, loop]
---

# Anti-Spin Build Loop

> **Loop Engineering** — most agent loops never stop to ask whether they're actually making progress, so they retry the same broken approach or quietly edit the test to pass. This loop runs build → audit → verify against a machine-checkable contract, with explicit stops that detect spinning.

## 🎯 Goal
Drive toward a verifiable contract while actively guarding against the classic failure mode: an agent that loops forever without converging.

## ⏱️ Schedule
Suggested interval: `15m`.

## ▶️ Run it
```
/loop 15m "Build toward the goal, then audit and verify against a machine-checkable contract. Track progress each pass. Stop if you make no progress, repeat an approach you already tried, flip-flop between two approaches, or hit the budget. Finish only when the contract passes — never by weakening the contract or the tests."
```

## 🔁 Iteration steps
1. **Build** — advance toward the contract.
2. **Audit** — `architect-review` checks the change; `scope-guard` blocks weakening the tests/contract.
3. **Verify** — run the machine-checkable contract; record progress vs. last pass.
4. **Anti-spin check** — no progress? repeated approach? flip-flop? budget hit? → stop and report.
5. **Observe** — if making progress and contract not yet met, loop; else `/pr-review` and hand off.

## 🛑 Stopping condition
Contract passes, **or** an anti-spin guard trips — whichever comes first.

## 💰 Budget & guardrails
Hard caps on iterations and spend; no-progress, repeated-approach and flip-flop detection. The contract and tests are immutable — the loop may not edit them to "pass".

## 🧩 Referenced components
- `agent:expert-advisors/architect-review` — independent audit each pass.
- `command:git-workflow/pr-review` — structured review at handoff.
- `hook:quality-gates/scope-guard` — prevents weakening tests/contract to fake success.

## 💡 Example
Chasing a contract for a parser, the loop tries approach A, then B, then drifts back to A — the flip-flop guard trips and it stops with a clear report instead of burning tokens forever.
