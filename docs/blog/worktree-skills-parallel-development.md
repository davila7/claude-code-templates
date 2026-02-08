# Parallel Development with Git Worktrees: A Skill + Commands Pattern for Claude Code

Working on a single task at a time is fine -- until you have three bugs to fix, a feature to ship, and a PR review waiting. With git worktrees and Claude Code, you can work on all of them simultaneously in separate terminal panels, each with its own Claude instance.

## The Problem

Traditional git workflows force sequential development. You stash changes, switch branches, lose context, switch back. Every context switch costs time and mental energy.

Git worktrees solve this by letting you check out multiple branches simultaneously in separate directories. But managing worktrees manually -- creating branches, tracking tasks, cleaning up -- adds overhead.

## The Solution: 1 Skill + 4 Commands

We built a system that combines Claude Code's two extension models:

- **1 Skill** (`worktree-guide`) -- an interactive guide Claude can discover and suggest automatically
- **4 Commands** -- manual workflows for each lifecycle step

```
Architecture
──────────────────────────────────────
  SKILL: /worktree-guide
  (discoverable, interactive guide)

  Delegates to COMMANDS:
  ├── /worktree-init      Create worktrees
  ├── /worktree-check     Check status
  ├── /worktree-deliver   Commit + PR
  └── /worktree-cleanup   Clean up
──────────────────────────────────────
```

### Why this architecture?

Commands and Skills serve different purposes in Claude Code:

| | Commands | Skills |
|---|---------|--------|
| **Who triggers** | Only the user | User and/or Claude |
| **Best for** | Manual workflows with side effects | Discoverable knowledge and context |
| **Git operations** | Perfect (push, branch, PR) | Overkill |
| **Auto-discovery** | No | Yes |

The worktree operations create branches, push code, and delete things -- you want deterministic control over when that happens. But the guide that teaches you the workflow? That's perfect for a Skill that Claude can suggest when you mention "parallel development" or "multiple tasks."

## Installation

Copy the commands and the guide skill to your project:

```bash
# Commands (manual workflows)
cp .claude/commands/worktree-*.md your-project/.claude/commands/

# Skill (interactive guide)
cp -r .claude/skills/worktree-guide your-project/.claude/skills/
```

Or install globally for all projects:

```bash
cp .claude/commands/worktree-*.md ~/.claude/commands/
cp -r .claude/skills/worktree-guide ~/.claude/skills/
```

## Workflow: From Tasks to PRs

### Start with the guide

If it's your first time, just ask Claude:

```
How do I work on multiple tasks at once?
```

Claude will discover the `worktree-guide` skill and walk you through the full workflow interactively, including Ghostty keybindings and Lazygit integration.

Or invoke it directly:

```
/worktree-guide
```

### 1. Initialize Worktrees

Start in your main repo and describe your tasks separated by `|`:

```
/worktree-init fix login bug | add dark mode | update API docs
```

Claude creates 3 worktrees, each on its own `wt/*` branch:

```
| # | Task            | Branch             | Path                                |
|---|-----------------|--------------------|------------------------------------|
| 1 | fix login bug   | wt/fix-login-bug   | ../worktrees/repo/wt-fix-login-bug |
| 2 | add dark mode   | wt/add-dark-mode   | ../worktrees/repo/wt-add-dark-mode |
| 3 | update API docs | wt/update-api-docs | ../worktrees/repo/wt-update-api-docs|
```

Each worktree gets a `.worktree-task.md` file with the task context.

### 2. Open Parallel Panels

In Ghostty, split your terminal:

- `Cmd+D` -- split right
- `Cmd+Shift+D` -- split down

Navigate to each worktree and launch Claude:

```bash
# Panel 1
cd ../worktrees/repo/wt-fix-login-bug && claude

# Panel 2
cd ../worktrees/repo/wt-add-dark-mode && claude

# Panel 3
cd ../worktrees/repo/wt-update-api-docs && claude
```

Now you have 3 independent Claude instances, each working on a separate task with full git isolation.

### 3. Check Status

Inside any worktree, run:

```
/worktree-check
```

You get a clean status report:

```
Worktree Status
──────────────────────────────────
Branch:    wt/fix-login-bug
Task:      fix login bug
Commits:   3 ahead of main
Modified:  2 files
Staged:    0 files
Untracked: 0 files
──────────────────────────────────
```

### 4. Deliver Your Work

When a task is done, run:

```
/worktree-deliver
```

Claude will:
1. Show you all changes for review
2. Generate a conventional commit message
3. Push the branch
4. Create a PR with the task description as context

### 5. Clean Up

After your PRs are merged, go back to the main repo and run:

```
/worktree-cleanup --all
```

This removes all merged worktrees, deletes local and remote `wt/*` branches, and prunes stale references.

Use `--dry-run` to preview what would be cleaned up first:

```
/worktree-cleanup --dry-run
```

## The Pattern: Skill as Orchestrator, Commands as Executors

This architecture demonstrates a pattern you can apply to any complex workflow:

1. **Create Commands** for each discrete step that has side effects (git operations, file modifications, deployments)
2. **Create a Skill** that acts as an entry point, guide, and orchestrator -- referencing the commands
3. The Skill is **discoverable** -- Claude can suggest it when relevant
4. The Commands are **deterministic** -- only triggered by explicit user action

Other workflows that fit this pattern:
- **Database migrations**: Skill guide + commands for create, apply, rollback
- **Release management**: Skill guide + commands for bump, changelog, publish
- **Environment setup**: Skill guide + commands for provision, configure, validate

## Tips

- **Name your tasks clearly**: The task description becomes the branch name and PR context
- **One task per worktree**: Keep each worktree focused on a single deliverable
- **Don't cross-edit**: Each worktree is isolated. Changes in one don't affect others until merged
- **Install dependencies**: If your project uses npm/yarn/pnpm, run the install command in each new worktree
- **Works with any terminal**: While optimized for Ghostty panels, this workflow works with any terminal that supports split panes (iTerm2, tmux, Warp, etc.)
- **Use Lazygit**: Open it in a dedicated panel to monitor all worktrees visually
