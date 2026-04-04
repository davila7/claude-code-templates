---
name: worktree-guide
description: Interactive guide for parallel development with Ghostty, git worktrees, and Lazygit. Use when setting up multi-task workflows or learning the worktree system.
license: MIT
metadata:
  author: claude-code-templates
  version: "1.0"
---

Guide the user through parallel development workflows using Ghostty terminal panels, git worktrees, and Lazygit. This is both a teaching experience and a practical reference.

---

## Preflight

Before starting, detect the user's environment:

```bash
git rev-parse --is-inside-work-tree 2>&1 && echo "GIT_OK" || echo "NOT_GIT"
```

**If not a git repo:**
> This isn't a git repository. Navigate to a git project first, then come back to `/worktree-guide`.

Check if we're in a worktree or main repo:
```bash
git worktree list
pwd
```

Note the context for later guidance.

---

## Phase 1: Welcome & Context Detection

Display based on environment:

**If in main repo:**
```
## Worktree Parallel Development Guide

Welcome! I'll guide you through setting up and using parallel worktrees for multi-task development.

┌─────────────────────────────────────────────────────────────┐
│  Ghostty Terminal                                           │
│  ┌──────────────────────┬──────────────────────┐           │
│  │                      │                      │           │
│  │   Claude (Task 1)    │   Claude (Task 2)    │           │
│  │   claude/login-page   │   claude/fix-auth-bug │           │
│  │                      │                      │           │
│  ├──────────────────────┴──────────────────────┤           │
│  │              Lazygit (monitoring)           │           │
│  └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘

**Your workflow:**
1. Create worktrees → `/worktree-init`
2. Open Ghostty panels → `Cmd+D` / `Cmd+Shift+D`
3. Run Claude in each panel → `cd <worktree> && claude`
4. Deliver when done → `/worktree-deliver`
5. Clean up → `/worktree-cleanup`

What would you like to do?
```

Use AskUserQuestion:
- "Learn the full workflow" — Start from Phase 2
- "Just show keybindings" — Jump to Quick Reference
- "Create worktrees now" — Suggest `/worktree-init`
- "Something else" — Ask what they need

**If already in a worktree:**
```
## Worktree Status

You're already inside a worktree! Let me check your status.
```

Then run the equivalent of `/worktree-check` and provide contextual guidance.

---

## Phase 2: Ghostty Essentials

**EXPLAIN:**
```
## Ghostty Panel Management

Ghostty's panel system is perfect for parallel development. Here are the essential keybindings:
```

**SHOW:**
```
┌─────────────────────────────────────────────────────────────┐
│                    GHOSTTY KEYBINDINGS                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SPLITTING                                                  │
│  ─────────                                                  │
│  Cmd+D           Split panel to the right                   │
│  Cmd+Shift+D     Split panel below                          │
│                                                             │
│  NAVIGATION                                                 │
│  ─────────                                                  │
│  Cmd+Alt+←/→/↑/↓ Move focus between panels                  │
│  Cmd+[/]         Cycle through panels                       │
│                                                             │
│  SIZING                                                     │
│  ─────────                                                  │
│  Cmd+Shift+E     Equalize all panel sizes                   │
│  Cmd+Shift+F     Toggle zoom (fullscreen current panel)     │
│                                                             │
│  CLOSING                                                    │
│  ─────────                                                  │
│  Cmd+W           Close current panel                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

**Pro tip:** Use Cmd+Shift+F to zoom into a panel when you need focus, then press it again to return to the multi-panel view.
```

**PAUSE** - "Ready to learn about Lazygit? (Or skip to workflow)"

---

## Phase 3: Lazygit Essentials

**EXPLAIN:**
```
## Lazygit for Monitoring Worktrees

Lazygit gives you a visual overview of all your worktrees and their changes. Run it from your main repo to monitor everything.
```

**SHOW:**
```
┌─────────────────────────────────────────────────────────────┐
│                    LAZYGIT KEYBINDINGS                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WORKTREES (navigate to Worktrees panel)                    │
│  ─────────                                                  │
│  w              Switch to worktree panel (or create new)    │
│  Enter          Switch to selected worktree                 │
│  n              Create new worktree                         │
│  d              Delete worktree (with confirmation)         │
│                                                             │
│  FILES & STAGING                                            │
│  ─────────                                                  │
│  Space          Stage/unstage file                          │
│  a              Stage all files                             │
│  Enter          View file diff (with Delta highlighting)    │
│                                                             │
│  COMMITS                                                    │
│  ─────────                                                  │
│  c              Commit staged changes                       │
│  C              Commit with editor                          │
│  A              Amend last commit                           │
│                                                             │
│  SYNC                                                       │
│  ─────────                                                  │
│  P              Push                                        │
│  p              Pull                                        │
│  f              Fetch                                       │
│                                                             │
│  GENERAL                                                    │
│  ─────────                                                  │
│  ?              Help (context-sensitive)                    │
│  q              Quit / go back                              │
│  Tab            Switch panels                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

**Monitoring workflow:**
1. Open lazygit in the main repo (or a dedicated Ghostty panel)
2. Press `w` to see all worktrees
3. Use Enter to dive into any worktree's changes
4. Press `q` to go back to the worktree list
```

**PAUSE** - "Ready for the full workflow walkthrough?"

---

## Phase 4: Complete Workflow (Guided)

**EXPLAIN:**
```
## Full Parallel Development Workflow

Let me walk you through the complete cycle. We'll go step by step.
```

### Step 4.1: Create Worktrees

**EXPLAIN:**
```
### Step 1: Create Worktrees

First, define the tasks you want to work on in parallel. The `/worktree-init` command creates a worktree for each task.
```

**DO:** Show example command:
```
Example usage:

/worktree-init add user authentication | fix login bug | improve dashboard performance

This creates:
├── ../worktrees/<repo>/claude-add-user-authentication/
├── ../worktrees/<repo>/claude-fix-login-bug/
└── ../worktrees/<repo>/claude-improve-dashboard-performance/
```

### Step 4.2: Open Ghostty Panels

**EXPLAIN:**
```
### Step 2: Open Ghostty Panels

Now split your terminal into panels—one for each task, plus optionally one for Lazygit monitoring.
```

**DO:**
```
1. Press Cmd+D to split right (first worktree)
2. Press Cmd+D again (second worktree)
3. Optionally press Cmd+Shift+D on any panel for Lazygit below

Resulting layout:
┌──────────┬──────────┬──────────┐
│ Task 1   │ Task 2   │ Task 3   │
│ claude   │ claude   │ claude   │
├──────────┴──────────┴──────────┤
│           lazygit              │
└────────────────────────────────┘
```

### Step 4.3: Work in Each Panel

**EXPLAIN:**
```
### Step 3: Work Independently

In each panel:
1. cd to the worktree path (from the commands output)
2. Run `claude` to start a Claude session
3. Use `/worktree-check` anytime to verify which task you're working on
4. Work normally—Claude doesn't know about other panels
```

### Step 4.4: Deliver Completed Work

**EXPLAIN:**
```
### Step 4: Deliver When Done

When you finish a task in any panel, use `/worktree-deliver` to:
1. Review your changes
2. Create a commit
3. Push to remote
4. Create a pull request
```

### Step 4.5: Clean Up

**EXPLAIN:**
```
### Step 5: Clean Up After Merging

After your PRs are merged on GitHub:
1. Go back to the main repo (not a worktree)
2. Run `/worktree-cleanup --all`
3. It removes merged worktrees and branches
```

---

## Phase 5: Troubleshooting

**SHOW:**
```
## Troubleshooting

### "I'm not sure which worktree I'm in"

Run `/worktree-check` — it shows your branch, task, and status.

Alternatively:
$ git branch --show-current    # Shows claude/<name>
$ pwd                          # Shows the worktree path

---

### "I have uncommitted changes and want to switch tasks"

**Option 1:** Commit work-in-progress
$ git add . && git commit -m "wip: progress on feature"

**Option 2:** Stash changes (temporary)
$ git stash push -m "wip: parking changes"

Then in the other panel, continue working. Come back later with:
$ git stash pop

---

### "I accidentally started working in the wrong worktree"

1. Stash your changes: `git stash push -m "work done in wrong place"`
2. Navigate to the correct worktree
3. Apply the stash: `git stash pop`

---

### "My worktree has merge conflicts"

1. Run `git fetch origin` to get latest
2. Run `git rebase origin/main` (or merge if you prefer)
3. Resolve conflicts in your editor
4. `git add .` then `git rebase --continue`

---

### "I want to abandon a worktree"

From the main repo:
$ git worktree remove ../worktrees/repo/claude-<name> --force
$ git branch -D claude/<name>

Note: Force is needed if there are uncommitted changes.

---

### "/worktree-deliver failed on push"

Usually means the remote branch doesn't exist yet or there's a conflict.

Try:
$ git push -u origin HEAD

If there's a conflict with remote, pull first:
$ git pull --rebase origin claude/<name>

---

### "The worktree path doesn't exist anymore"

The worktree was probably deleted manually. Clean up the git state:
$ git worktree prune
```

---

## Phase 6: Quick Reference Card

**SHOW:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORKTREE QUICK REFERENCE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  COMMANDS                                                                   │
│  ─────────                                                                  │
│  /worktree-init <task1> | <task2>    Create worktrees for parallel tasks    │
│  /worktree-check                     Show current worktree status & task    │
│  /worktree-deliver                   Commit, push, and create PR            │
│  /worktree-cleanup --all             Remove merged worktrees and branches   │
│  /worktree-cleanup --dry-run         Preview what would be cleaned up       │
│                                                                             │
│  GHOSTTY                                                                    │
│  ─────────                                                                  │
│  Cmd+D              Split right     │  Cmd+Shift+E    Equalize panels      │
│  Cmd+Shift+D        Split down      │  Cmd+Shift+F    Zoom toggle          │
│  Cmd+Alt+Arrows     Navigate        │  Cmd+W          Close panel          │
│                                                                             │
│  LAZYGIT                                                                    │
│  ─────────                                                                  │
│  w                  Worktrees panel │  Space          Stage/unstage        │
│  Enter              View diff       │  c              Commit               │
│  P                  Push            │  ?              Help                 │
│                                                                             │
│  GIT (manual)                                                               │
│  ─────────                                                                  │
│  git worktree list                   List all worktrees                     │
│  git worktree add -b claude/name path Create worktree manually               │
│  git worktree remove path            Remove a worktree                      │
│  git worktree prune                  Clean up stale worktree refs           │
│                                                                             │
│  WORKFLOW                                                                   │
│  ─────────                                                                  │
│  1. /worktree-init tasks...          Create worktrees                       │
│  2. Cmd+D (split panels)             Open Ghostty panels                    │
│  3. cd <path> && claude              Start Claude in each                   │
│  4. /worktree-deliver                PR when done                           │
│  5. /worktree-cleanup                Clean up after merge                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Guardrails

- **Never execute destructive commands** without confirmation (worktree remove, branch delete)
- **Always verify location** before suggesting worktree operations
- **If user seems lost**, offer `/worktree-check` first
- **Never force-delete** branches that aren't merged
- **Don't assume tools are installed** — check for lazygit availability if suggesting it
- **Respect user's pace** — don't rush through sections if they want to practice
- **Keep the reference card available** — offer to show it whenever relevant
