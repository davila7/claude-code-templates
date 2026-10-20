---
name: repo-cleanup-loop
description: Recovers valuable unmerged work and prunes stale branches and PRs until the repository is tidy.
category: engineering
interval: 7d
stop-condition: No stale branches or abandoned PRs remain and any salvageable work has been captured.
components: [command:git-workflow/branch-cleanup, agent:git/git-workflow-manager, skill:git/git-context-controller]
tags: [git, maintenance, cleanup, loop]
---

# Repository Cleanup Loop

> **Loop Engineering** — a recurring janitor that keeps the repo's branch and PR list honest without deleting anything valuable.

## 🎯 Goal
Find stale branches and abandoned PRs, **recover** any work worth keeping (extract to an issue or fresh branch), and safely remove the rest.

## ⏱️ Schedule
Suggested interval: `7d` (weekly). Because this loop can delete branches, keep the cadence slow and review its actions.

## ▶️ Run it
```
/loop 7d "Scan branches and PRs. For each stale one, decide: salvage valuable work into an issue/branch, or delete if fully merged or abandoned. Never lose unmerged work. Continue until the branch and PR list is clean."
```

## 🔁 Iteration steps
1. **Perceive** — list branches/PRs by last activity with `git-context-controller`.
2. **Reason** — classify each: merged, abandoned, or contains salvageable work.
3. **Plan** — decide salvage vs delete for the oldest item.
4. **Act** — salvage to an issue/branch, then prune with `/branch-cleanup`; the `git-workflow-manager` agent guides safe operations.
5. **Observe** — confirm nothing valuable was lost; continue down the list.

## 🛑 Stopping condition
No stale branches or abandoned PRs remain and all salvageable work is captured.

## 🧩 Referenced components
- `command:git-workflow/branch-cleanup` — prunes merged/stale branches.
- `agent:git/git-workflow-manager` — guards safe git operations.
- `skill:git/git-context-controller` — inspects branch/PR history.

## 💡 Example
A six-month-old `spike/new-parser` branch holds a useful prototype; the loop extracts it into an issue with the diff attached, then deletes the branch.
