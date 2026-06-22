---
name: overnight-pr-routine-loop
description: A nightly routine that watches your open PRs, auto-fixes build failures, answers review comments in a fresh worktree, and rebases stale branches while you sleep.
category: operations
interval: daily
stop-condition: Every fixable PR is green and updated; anything ambiguous is left flagged for human review.
components: [command:git-workflow/worktree-init, command:git-workflow/create-pr, agent:git/git-workflow-manager, hook:automation/slack-notifications]
tags: [schedule, pull-requests, automation, loop]
---

# Overnight PR Routine

> **Loop Engineering** — the `/schedule` verb runs a routine *while you are gone*. This is the "I don't write code, I write loops, and they write the code while I sleep" pattern: a scheduled routine that lands the fixable PRs overnight.

## 🎯 Goal
Each night, work the open-PR queue: auto-fix build failures, answer review comments in an isolated worktree, rebase stale branches — and leave anything ambiguous for a human in the morning.

## ⏱️ Schedule
Trigger: `daily` (overnight routine, runs while your laptop is closed).

## ▶️ Run it
```
/schedule every night, watch my open PRs. For each: auto-fix build failures, answer review comments in a fresh worktree, and rebase what is stale. Leave anything ambiguous or product-sensitive for me. Keep state in git so a crash loses nothing. Post a morning summary.
```

## 🔁 Iteration steps
1. **Perceive** — list open PRs and their CI/review state.
2. **Isolate** — spin a fresh worktree per PR with `/worktree-init` (no cross-contamination).
3. **Act** — `git-workflow-manager` fixes build failures, addresses review comments, rebases stale branches.
4. **Verify** — re-run CI; push only when green; ambiguous items are flagged, never guessed.
5. **Report** — post a morning summary via `slack-notifications`; update each PR with `/create-pr`.

## 🛑 Stopping condition
Every fixable PR is green and updated; ambiguous/product-sensitive items are flagged for human review (not auto-merged).

## 💰 Budget & guardrails
A nightly spend ceiling; never auto-merges; isolated worktrees so parallel fixes don't collide; state in git so a crash is recoverable.

## 🧩 Referenced components
- `command:git-workflow/worktree-init` — isolated workspace per PR.
- `command:git-workflow/create-pr` — updates/opens PRs.
- `agent:git/git-workflow-manager` — safe rebases, fixes and comment replies.
- `hook:automation/slack-notifications` — the morning summary.

## 💡 Example
You wake up to three PRs rebased and green, two review comments answered with commits, and one PR flagged "needs a product decision" — exactly the one you should look at.
