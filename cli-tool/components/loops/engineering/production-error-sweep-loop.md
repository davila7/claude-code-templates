---
name: production-error-sweep-loop
description: Triages production errors, finds the root cause, ships a verified fix, and repeats until the error budget is clean.
category: engineering
interval: 15m
stop-condition: No unresolved high-severity production errors remain and each fix is verified in tests.
components: [agent:expert-advisors/debug, agent:security/incident-responder, command:git-workflow/create-pr]
tags: [debugging, incidents, reliability, loop]
---

# Production Error Sweep Loop

> **Loop Engineering** — keep an autonomous responder working the error queue, one root cause at a time, until production is quiet.

## 🎯 Goal
Continuously pull the top production error, find its **root cause** (not just the symptom), ship a tested fix, and verify the error stops recurring.

## ⏱️ Schedule
Suggested interval: `15m` (or trigger on new error alerts).

## ▶️ Run it
```
/loop 15m "Take the highest-impact unresolved production error. Reproduce it, find the root cause, write a regression test, fix it, and open a PR. Continue until no high-severity errors remain."
```

## 🔁 Iteration steps
1. **Perceive** — read the top error by impact (frequency × severity).
2. **Reason** — reproduce and trace to the true root cause with the `debug` agent.
3. **Plan** — design a minimal fix plus a regression test that fails first.
4. **Act** — implement the fix; the `incident-responder` agent documents impact and mitigation.
5. **Observe** — confirm the regression test passes, then open a PR with `/create-pr`.

## 🛑 Stopping condition
The high-severity error queue is empty and every fix is covered by a passing regression test.

## 🧩 Referenced components
- `agent:expert-advisors/debug` — root-cause analysis.
- `agent:security/incident-responder` — impact assessment and mitigation notes.
- `command:git-workflow/create-pr` — ships each fix for review.

## 💡 Example
A recurring null-pointer crash is traced to an unvalidated webhook payload; the loop adds a failing regression test, fixes the validation, verifies, and opens `fix: validate webhook payload before parse`.
