---
allowed-tools: Bash(git:*), Bash(rm:*), Bash(ls:*), Bash(pwd:*), Bash(grep:*)
argument-hint: --all | --branch claude/name | --dry-run
description: Clean up merged worktrees and their branches
---

# Worktree Cleanup

Remove worktrees and branches that have been merged: $ARGUMENTS

## Instructions

You are in the **main repository** (not a worktree). Clean up finished worktrees.

### Branch Patterns

This project uses the following branch prefixes for worktrees:
- `claude/*` — Claude Code auto-created worktrees
- `claude-daniel/*` — User-created worktrees
- `review/*` — Component review worktrees

All three prefixes must be checked in every step below.

### Step 1: Validate Environment

1. Verify this is the main working tree (first entry in `git worktree list`)
2. If inside a worktree, warn: "Run `/worktree-cleanup` from the main repo, not from a worktree."
3. Fetch latest from origin: `git fetch origin --prune`
4. Get the main branch name (main or master)

### Step 2: Parse Arguments

Parse `$ARGUMENTS` for options:

- `--all` — clean up ALL merged worktrees and branches
- `--branch <prefix>/<name>` — clean up a specific worktree/branch
- `--dry-run` — show what would be cleaned up without doing anything
- `--force-all` — remove ALL worktrees regardless of merge status (asks confirmation per worktree)
- No arguments — list worktrees and ask which to clean up

### Step 3: Identify Worktrees

1. List all worktrees: `git worktree list`
2. List all matching branches:
   ```bash
   git branch --list 'claude/*' 'claude-daniel/*' 'review/*'
   ```
3. For each matching branch, check if it's been merged into main:
   ```bash
   git branch --merged origin/<main-branch> | grep -E '^\s+(claude/|claude-daniel/|review/)'
   ```
4. Also check remote branches:
   ```bash
   git branch -r --merged origin/<main-branch> | grep -E 'origin/(claude/|claude-daniel/|review/)'
   ```
5. For squash-merged branches (not detected by `--merged`), check if the branch diff is empty against main:
   ```bash
   # A branch is effectively merged if its changes already exist in main
   git diff origin/main...<branch> --stat
   ```
   If the diff is empty or very small (only whitespace), consider it merged.

### Step 4: Display Status

Show a table of all worktrees/branches:

```
| # | Worktree | Branch | Merged? | Dirty? | Action |
|---|---------|--------|---------|--------|--------|
| 1 | eager-mendeleev | claude/eager-mendeleev | Yes | Clean | Will remove |
| 2 | agent-a7e312d0 | review/code-reviewer-2026-04-01 | No | Clean | Skipped |
```

### Step 5: Confirm and Execute

If `--dry-run` was specified, show the table and stop.

Otherwise, use AskUserQuestion to confirm cleanup (unless `--all` was specified with only merged branches).

For each worktree/branch to clean up:

1. Remove the worktree:
   ```bash
   git worktree remove <path>
   ```
   If that fails (dirty worktree), warn and skip — **never force-remove**.

2. Delete the local branch:
   ```bash
   git branch -d <branch>
   ```
   Use `-d` (not `-D`) for merged branches. For `--force-all` unmerged branches, use `-D` only after explicit user confirmation.

3. Delete the remote branch (if it exists):
   ```bash
   git push origin --delete <branch>
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
- Or use `git worktree remove <path>` and `git branch -D <branch>` manually if the work is truly abandoned
