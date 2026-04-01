---
allowed-tools: Bash(git:*), Bash(mkdir:*), Bash(ls:*), Bash(cat:*), Bash(basename:*), Bash(pwd:*), Bash(sed:*)
argument-hint: task 1 | task 2 | task 3
description: Create parallel worktrees for multi-task development with Ghostty panels
---

# Worktree Parallel Init

Create multiple git worktrees for parallel development: $ARGUMENTS

## Instructions

You are setting up parallel worktrees so the user can work on multiple tasks simultaneously in separate Ghostty terminal panels, each running its own Claude instance.

### Step 1: Validate Environment

1. Check this is a git repository: `git rev-parse --is-inside-work-tree`
2. Get the repo name: `basename $(git rev-parse --show-toplevel)`
3. Get the main branch name (check for `main` or `master`): `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'` — if that fails, default to `main`
4. Ensure working tree is clean: `git status --porcelain`. If dirty, warn the user and ask if they want to continue.
5. Fetch latest: `git fetch origin`

### Step 2: Parse Tasks

Parse tasks from `$ARGUMENTS`. Tasks are separated by `|` (pipe character).

If `$ARGUMENTS` is empty, use AskUserQuestion to ask the user to describe their tasks (they can provide multiple separated by `|`).

For each task description:
- Trim whitespace
- Generate a kebab-case branch name: `wt/<kebab-case-task>` (max 50 chars, alphanumeric and hyphens only)
- Generate a worktree directory path: `../worktrees/<repo-name>/wt-<kebab-case-task>`

### Step 3: Create Worktrees

For each task:

1. Create the parent directory if needed: `mkdir -p ../worktrees/<repo-name>`
2. Create the worktree:
   ```bash
   git worktree add -b wt/<name> ../worktrees/<repo-name>/wt-<name> origin/<main-branch>
   ```
3. Write a `.worktree-task.md` file inside the new worktree with this content:
   ```markdown
   # Worktree Task

   **Branch:** wt/<name>
   **Task:** <original task description>
   **Created:** <ISO date>
   **Source repo:** <path to main repo>
   ```

### Step 4: Check for Dependencies

If a `package.json` exists in the repo root, note that each worktree may need `npm install` (or the appropriate package manager).

Check for:
- `package-lock.json` → npm install
- `yarn.lock` → yarn install
- `pnpm-lock.yaml` → pnpm install
- `bun.lockb` → bun install

### Step 5: Output Summary

Display a clear summary table:

```
| # | Task | Branch | Path |
|---|------|--------|------|
| 1 | ... | wt/... | ../worktrees/repo/wt-... |
```

Then display ready-to-copy commands for Ghostty panels. For each worktree:

```
# Panel <N>: <task description>
cd <absolute-path-to-worktree> && claude
```

If dependencies were detected, add a note:
```
# Note: Run <package-manager> install in each worktree before starting
```

Finally, remind the user:
- Open a new Ghostty panel with `Cmd+D` (split right) or `Cmd+Shift+D` (split down)
- When done with a task, use `/worktree-deliver` to commit, push, and create a PR
- After merging all PRs, use `/worktree-cleanup --all` from the main repo
