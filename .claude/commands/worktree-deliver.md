---
allowed-tools: Bash(git:*), Bash(gh:*), Bash(rm:*), Bash(cat:*), Bash(pwd:*), Bash(ls:*)
description: Commit, push, and create PR from the current worktree
---

# Worktree Deliver

Commit all work, push, and create a pull request from the current worktree.

## Instructions

You are inside a worktree. Package up the work and deliver it as a PR.

### Step 1: Validate Environment

1. Verify this is a worktree (not the main working tree) using `git worktree list`
2. Get current branch: `git branch --show-current`
3. Verify branch follows `wt/*` pattern. If not, warn the user and ask if they want to continue.
4. Read `.worktree-task.md` if it exists to get the original task description

### Step 2: Review Changes

1. Run `git diff --stat` and `git diff --cached --stat` to show all changes
2. Run `git status --short` to show the full picture
3. If there are no changes at all (clean working tree, no commits ahead of main), inform the user there's nothing to deliver and stop.

### Step 3: Clean Up Task File

Before staging anything, remove the worktree task file so it doesn't end up in the commit:

```bash
rm -f .worktree-task.md
```

### Step 4: Confirm Files to Commit

Use AskUserQuestion to show the user what will be committed and ask for confirmation. List all modified, added, and untracked files.

Options:
- "Stage all changes" — stage everything
- "Let me choose" — user will specify which files to include

If the user wants to choose, ask them which files to stage.

### Step 5: Stage and Commit

1. Stage the confirmed files with `git add`
2. Generate a commit message following conventional commits format

**Commit Message Strategy:**

   1. **Analyze the diff** to determine the conventional commit type:
      - `feat:` — New functionality, new files, new exports, new API endpoints
      - `fix:` — Bug fixes, error corrections, fixing broken behavior
      - `refactor:` — Code restructuring without changing behavior
      - `docs:` — Documentation only changes
      - `test:` — Adding or modifying tests
      - `chore:` — Build scripts, configs, maintenance tasks

   2. **Generate a commit message** based on:
      - The task description from `.worktree-task.md` (if it was found)
      - A brief summary of what the diff actually changed
      - Format: `<type>: <subject>` (max 72 characters)

   3. **Show the proposed message** to the user with AskUserQuestion:
      - Display the generated message clearly
      - Options: "Use this message" / "Let me write my own"

   4. **If user chooses to write their own:**
      - Ask them to provide their commit message
      - Validate it follows conventional commits format (warn if not, but allow)

   5. **Always include body and co-author:**
      - Add a brief body summarizing what changed (2-3 bullet points if multiple changes)
      - Include the standard co-author line

3. Create the commit with the message using a HEREDOC:
   ```bash
   git commit -m "$(cat <<'EOF'
   <commit message here>
   EOF
   )"
   ```

### Step 6: Push

Push the branch to origin:

```bash
git push -u origin HEAD
```

If push fails due to no upstream, the `-u` flag should handle it. If it fails for another reason, show the error and suggest fixes.

### Step 7: Create Pull Request

1. Determine the base branch (main or master) using the same detection as worktree-init
2. Create the PR using `gh pr create`:

```bash
gh pr create --base <main-branch> --title "<PR title>" --body "$(cat <<'EOF'
## Summary

<bullet points describing the changes based on task description and diff>

## Original Task

<task description from .worktree-task.md>

## Changes

<git diff --stat summary>

---
Created from worktree `wt/<name>` using `/worktree-deliver`
EOF
)"
```

3. Display the PR URL prominently

### Step 8: Next Steps

Tell the user:
- PR is ready for review at `<URL>`
- After merging, run `/worktree-cleanup` from the main repo to clean up
- They can close this terminal panel
