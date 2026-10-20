---
name: human-approval-loop
description: Runs the task, then pauses and sends you approve / revise / skip before anything ships — human review as a first-class queue where the stop condition is your approval.
category: evaluation
interval: on-demand
stop-condition: You approve the result (it ships) or skip/redirect it — nothing ships without explicit human approval.
components: [hook:quality-gates/plan-gate, hook:automation/telegram-notifications, command:git-workflow/create-pr]
tags: [human-in-the-loop, approval, safety, loop]
---

# Human-in-the-Loop Approval Loop

> **Loop Engineering** — same loop shape as the autonomous ones, but the stop condition is *your approval* instead of a passing test. The agent does the work, then waits at a gate: approve, revise, or skip.

## 🎯 Goal
Run the task, then **pause** and route the result to you for a decision before anything ships — treating human review as its own queue with clear actions.

## ⏱️ Schedule
Trigger: `on-demand` (each item pauses for your call before shipping).

## ▶️ Run it
```
/loop run the next task, then pause and send me approve / revise / skip before anything ships. On approve, continue and ship. On revise, take my note and redo. On skip, move to the next item. Never ship without my approval.
```

## 🔁 Iteration steps
1. **Act** — complete the task up to the point of shipping.
2. **Gate** — the `plan-gate` hook halts before any irreversible/ship step.
3. **Ask** — send approve / revise / skip via `telegram-notifications`.
4. **Branch** — approve → ship (e.g. `/create-pr`); revise → apply note and redo; skip → next item.
5. **Observe** — record the decision; nothing ships unattended.

## 🛑 Stopping condition
You approve (ship) or skip/redirect — the loop never ships without an explicit human decision.

## 💰 Budget & guardrails
The gate is the safety: irreversible actions wait for a human. Add a reminder/deadline so pending items don't pile up silently, and a budget for the work done before each gate.

## 🧩 Referenced components
- `hook:quality-gates/plan-gate` — halts before irreversible/ship steps.
- `hook:automation/telegram-notifications` — sends the approve/revise/skip prompt.
- `command:git-workflow/create-pr` — the ship action on approval.

## 💡 Example
The agent drafts a refund-policy change, pauses, and pings you on Telegram. You hit "revise" with a note; it redoes the draft and pings again — and only ships after you approve.
