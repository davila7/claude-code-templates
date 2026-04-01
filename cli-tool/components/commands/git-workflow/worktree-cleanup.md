---
allowed-tools: Bash(git:*), Bash(rm:*), Bash(ls:*), Bash(pwd:*), Bash(grep:*)
argument-hint: --all | --branch wt/name | --dry-run
description: Clean up merged worktrees and their branches
---

# Worktree Cleanup

Remove worktrees and branches that have been merged: $ARGUMENTS

## Instructions

You are in the **main repository** (not a worktree). Clean up finished worktrees.

### Step 1: Validate Environment

1. Verify this is the main working tree (first entry in `git worktree list`)
2. If inside a worktree, warn: "Run `/worktree-cleanup` from the main repo, not from a worktree."
3. Fetch latest from origin: `git fetch origin --prune`
4. Get the main branch name (main or master)

### Step 2: Parse Arguments

Parse `$ARGUMENTS` for options:

- `--all` — clean up ALL merged `wt/*` worktrees and branches
- `--branch wt/<name>` — clean up a specific worktree/branch
- `--dry-run` — show what would be cleaned up without doing anything
- No arguments — list worktrees and ask which to clean up

### Step 3: Identify Worktrees

1. List all worktrees: `git worktree list`
2. List all `wt/*` branches: `git branch --list 'wt/*'`
3. For each `wt/*` branch, check if it's been merged into main:
   ```bash
   git branch --merged origin/<main-branch> | grep 'wt/'
   ```
4. Also check remote branches:
   ```bash
   git branch -r --merged origin/<main-branch> | grep 'origin/wt/'
   ```

### Step 4: Display Status

Show a table of all `wt/*` worktrees/branches:

```
| Branch | Worktree Path | Merged? | Action |
|--------|--------------|---------|--------|
| wt/login-page | ../worktrees/repo/wt-login-page | Yes | Will remove |
| wt/auth-bug | ../worktrees/repo/wt-auth-bug | No | Skipped (not merged) |
```

### Step 5: Confirm and Execute

If `--dry-run` was specified, show the table and stop.

Otherwise, use AskUserQuestion to confirm cleanup (unless `--all` was specified with only merged branches).

For each **merged** worktree/branch to clean up:

1. Remove the worktree:
   ```bash
   git worktree remove <path>
   ```
   If that fails (dirty worktree), warn and skip — **never force-remove**.

2. Delete the local branch:
   ```bash
   git branch -d wt/<name>
   ```
   Use `-d` (not `-D`) — this is safe because it only deletes merged branches.

3. Delete the remote branch:
   ```bash
   git push origin --delete wt/<name>
   ```
   If the remote branch doesn't exist, ignore the error silently.

### Step 6: Prune

After all removals:

```bash
git worktree prune
```

### Step 7: Summary

Show what was cleaned up:

```
Cleanup Complete
──────────────────────────────────
Removed:  <N> worktree(s)
Deleted:  <N> local branch(es)
Deleted:  <N> remote branch(es)
Skipped:  <N> unmerged branch(es)
──────────────────────────────────
```

If any unmerged branches were skipped, list them and suggest:
- Merge the PR first, then run cleanup again
- Or use `git worktree remove <path>` and `git branch -D wt/<name>` manually if the work is truly abandoned
