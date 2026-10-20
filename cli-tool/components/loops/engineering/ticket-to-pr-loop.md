---
name: ticket-to-pr-loop
description: Converts open bug reports and issues into verified, reviewer-ready pull requests, one ticket per pass.
category: engineering
interval: 30m
stop-condition: Every actionable ticket in scope has a verified PR or is flagged for human input.
components: [command:git-workflow/fix-github-issue, command:git-workflow/create-pr, hook:git/conventional-commits]
tags: [issues, pull-requests, automation, loop]
---

# Ticket-to-PR-Ready Loop

> **Loop Engineering** — turn a backlog of issues into a steady stream of small, verified PRs without hand-holding each one.

## 🎯 Goal
Pick one actionable ticket, implement and verify the fix, and open a PR that a reviewer can approve quickly — then move to the next ticket.

## ⏱️ Schedule
Suggested interval: `30m`.

## ▶️ Run it
```
/loop 30m "Take the next actionable open issue. Implement the fix in an isolated branch, add tests, verify, and open a conventional-commit PR linking the issue. If a ticket needs product decisions, label it for human review and skip. Continue until the queue is clear."
```

## 🔁 Iteration steps
1. **Perceive** — read the next open, actionable issue.
2. **Reason** — confirm scope; if it needs human/product input, label and skip.
3. **Plan** — outline the change and the test that proves it.
4. **Act** — implement with `/fix-github-issue`; commits follow `conventional-commits`.
5. **Observe** — run tests; on green, open a PR with `/create-pr` that links the issue.

## 🛑 Stopping condition
No actionable tickets remain — each is either a verified PR or flagged for human input.

## 🧩 Referenced components
- `command:git-workflow/fix-github-issue` — implements the ticket fix.
- `command:git-workflow/create-pr` — opens the linked PR.
- `hook:git/conventional-commits` — enforces clean, conventional commit messages.

## 💡 Example
A "typo in error message" issue becomes a one-line fix with a snapshot test and a `fix: correct auth error copy (#412)` PR, all within a single pass.
