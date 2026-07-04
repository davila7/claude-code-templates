---
name: goal-refiner-loop
description: Rewrites a vague request into a precise goal — exact end state, how to verify it, what not to touch, and the stop condition — then executes against it.
category: engineering
interval: on-demand
stop-condition: The refined goal's verifiable end state is reached, or its explicit turn/budget cap is hit.
components: [agent:expert-advisors/critical-thinking, agent:development-team/code-architect]
tags: [goal, planning, prompting, loop]
---

# Goal-Refiner Loop

> **Loop Engineering** — "your agent is not dumb, your instructions are just vague." This loop's only first job is to turn a fuzzy ask into a rigorous, verifiable goal before any code is written, then run the `/goal` against it.

## 🎯 Goal
Convert a vague request into a precise goal — the exact end state, how it will be verified, what must not be touched, and the stop condition — confirm it, then execute.

## ⏱️ Schedule
Trigger: `on-demand`.

## ▶️ Run it
```
/goal Before doing anything, rewrite my request into a precise goal: the exact end state, how you will verify it, what you must not touch, and the stop condition (including a turn cap). Confirm that goal with me, then execute against it and stop when the end state is verified.
```

## 🔁 Iteration steps
1. **Refine** — `critical-thinking` rewrites the ask into a crisp, testable goal.
2. **Scope** — `code-architect` defines the blast radius: what's in, what must not be touched.
3. **Confirm** — surface the refined goal for a quick yes before acting.
4. **Act** — execute against the goal.
5. **Verify** — check the end state against the stated verification; stop when met.

## 🛑 Stopping condition
The goal's verifiable end state is reached, or the turn/budget cap is hit (the loop reports how far it got).

## 💰 Budget & guardrails
Every refined goal carries an explicit "what not to touch" and a turn cap, so an under-specified ask can't sprawl into a risky, open-ended run.

## 🧩 Referenced components
- `agent:expert-advisors/critical-thinking` — sharpens the goal and verification.
- `agent:development-team/code-architect` — bounds scope and the do-not-touch list.

## 💡 Example
"Make the app faster" becomes "p95 of /search ≤ 200ms measured by the existing benchmark, without changing the public API, stop after 8 turns" — and the loop executes against that.
