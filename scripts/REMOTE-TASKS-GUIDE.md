# Remote Claude Tasks - Quick Start Guide

Give Claude instructions from your phone, tablet, or any browser. Tasks queue up as GitHub Issues and your Mac picks them up automatically.

## How It Works

```
Phone/Browser --> GitHub Issue --> Your Mac --> Claude runs it --> Result posted back
```

1. You create a GitHub Issue with the label `claude-task`
2. Your Mac polls for new tasks (or you trigger manually)
3. Claude reads the issue, runs the task, posts the result as a comment
4. The issue is closed automatically

## Setup (One Time)

```bash
# 1. Run the Mac setup
bash scripts/mac-setup.sh

# 2. Set your tasks repo
export CLAUDE_TASKS_REPO='your-username/claude-tasks'
# Add this to your ~/.zshrc too

# 3. (Optional) Enable auto-polling
bash scripts/claude-auto-runner.sh install
```

## Creating Tasks

### From Terminal
```bash
# Interactive
claude-tasks create

# One-liner
claude-tasks quick "Add dark mode to my-app" "owner/my-app"

# Short alias
ct quick "Fix the login bug" "~/projects/website"
```

### From GitHub (Phone/Browser)
1. Go to your `claude-tasks` repo on github.com
2. Create a new Issue
3. Add the label `claude-task`
4. In the body, optionally add a target:
   ```
   Fix the broken navbar on mobile.

   ---
   **Target:** `owner/my-web-app`
   ```

### From iOS Shortcuts
Create an iOS Shortcut with these actions:

1. **Ask for Input** - "What should Claude do?"
2. **Get Contents of URL**
   - URL: `https://api.github.com/repos/YOUR-USER/claude-tasks/issues`
   - Method: POST
   - Headers:
     - `Authorization`: `token YOUR_GITHUB_PAT`
     - `Accept`: `application/vnd.github.v3+json`
   - Body (JSON):
     ```json
     {
       "title": "[input from step 1]",
       "labels": ["claude-task"]
     }
     ```
3. **Show Notification** - "Task sent to Claude"

### From Android (Tasker/HTTP Shortcuts)
Use the same GitHub API call as iOS above. The HTTP Shortcuts app makes this simple.

## Running Tasks

```bash
# See what's pending
claude-tasks list    # or: ct list

# Run the next task in queue
claude-tasks run-next    # or: ct run-next

# Run a specific task
claude-tasks run 42

# Mark done manually
claude-tasks done 42
```

## Auto-Runner

The auto-runner polls GitHub for new tasks on a schedule:

```bash
# Install (default: check every 5 minutes, notify only)
bash scripts/claude-auto-runner.sh install

# Auto-execute tasks (hands-free mode)
CLAUDE_AUTO_RUN=true bash scripts/claude-auto-runner.sh install

# Check status
bash scripts/claude-auto-runner.sh status

# View logs
tail -f ~/.claude-launchpad/logs/auto-runner.log

# Stop
bash scripts/claude-auto-runner.sh uninstall
```

## Task Format Tips

Write issues like you'd talk to a developer:

**Good tasks:**
- "Add input validation to the signup form in src/components/Signup.tsx"
- "Write tests for the payment module"
- "Refactor the database queries in api/users.js to use parameterized queries"
- "Review package.json and update outdated dependencies"

**Include context when needed:**
- Which repo/directory to work in (use `**Target:**` field)
- What branch to work on
- Any constraints or preferences

## Launchpad

The Launchpad gives you a menu-driven interface for everything:

```bash
lp    # or: launchpad
```

```
  ╔══════════════════════════════════════════╗
  ║         CLAUDE  LAUNCHPAD                ║
  ╚══════════════════════════════════════════╝

  Quick Actions
  1  Start Claude in current directory
  2  Start Claude in workspace
  3  Resume last Claude session

  Projects
  4  Open a project (pick from workspace)
  5  Clone a repo and start Claude

  Remote Tasks
  6  Check for remote tasks
  7  Create a new remote task
  8  Run next pending task

  Tools
  9  Install a component
  10 Run Claude with prompt from clipboard
  11 Open Claude settings
```
