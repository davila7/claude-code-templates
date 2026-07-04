---
name: five-minute-maintainer-loop
description: Every few minutes while you work, makes one small verified repository improvement — a flaky test, a stale comment, a missing type — one change, one commit.
category: engineering
interval: 5m
stop-condition: You end the session, or there is no safe low-risk improvement left to make this pass.
components: [agent:development-team/test-runner, command:git-workflow/commit, hook:quality-gates/scope-guard]
tags: [maintenance, hygiene, automation, loop]
---

# Five-Minute Maintainer Loop

> **Loop Engineering** — the `/loop` verb repeats a task *while you are present*. This one does continuous, low-risk upkeep on a tight timer while you focus on the real work. Inspired by Peter Steinberger's five-minute maintainer.

## 🎯 Goal
Every few minutes, make exactly **one** small, verified improvement to the repo — and let the agent decide *what* to clean. That judgment is the whole point; nothing is hardcoded.

## ⏱️ Schedule
Suggested interval: `5m` (runs while your session is open).

## ▶️ Run it
```
/loop 5m "Make one small, verified repository improvement: a flaky test, a stale comment, a missing type, a dead import. One change, one commit, tests green. Never touch anything risky or architectural. If nothing safe remains, say so and wait."
```

## 🔁 Iteration steps
1. **Perceive** — scan for a small, low-risk improvement opportunity.
2. **Reason** — confirm it is safe; the `scope-guard` hook blocks risky/out-of-scope edits.
3. **Act** — make the single change.
4. **Verify** — run the suite with `test-runner`; only proceed if green.
5. **Observe** — commit with `/commit`; one change, one commit. Wait for the next tick.

## 🛑 Stopping condition
You end the session, or there is no safe improvement left this pass (the loop idles rather than inventing risky work).

## 💰 Budget & guardrails
One change per tick; never refactors or touches production-critical paths. Set a per-session token budget before walking away.

## 🧩 Referenced components
- `agent:development-team/test-runner` — verifies each change is green.
- `command:git-workflow/commit` — one clean commit per improvement.
- `hook:quality-gates/scope-guard` — blocks risky / out-of-scope edits.

## 💡 Example
While you build a feature, the loop quietly fixes a flaky timer test, removes a dead import, and adds a missing return type — three tiny green commits — without ever touching the feature you're working on.
