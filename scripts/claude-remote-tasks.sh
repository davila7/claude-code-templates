#!/bin/bash
# =============================================================================
# Claude Remote Tasks - Give Claude instructions from anywhere
#
# Uses GitHub Issues as a task queue. Create an issue from your phone, tablet,
# or any browser, and Claude picks it up on your Mac.
#
# Setup:
#   1. Create a GitHub repo for tasks (e.g. your-username/claude-tasks)
#   2. Set CLAUDE_TASKS_REPO below or export it
#   3. Authenticate gh: gh auth login
#
# Usage:
#   claude-tasks list          Show pending tasks
#   claude-tasks create        Create a new task interactively
#   claude-tasks run-next      Pick up and run the next pending task
#   claude-tasks run <number>  Run a specific task by issue number
#   claude-tasks done <number> Mark a task as complete
#   claude-tasks quick "msg"   Create a task with one command
# =============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Set this to your tasks repo (owner/repo format)
CLAUDE_TASKS_REPO="${CLAUDE_TASKS_REPO:-}"
WORKSPACE="${CLAUDE_WORKSPACE:-$HOME/claude-workspace}"

# Labels used for task states
LABEL_PENDING="claude-task"
LABEL_RUNNING="in-progress"
LABEL_DONE="completed"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

check_deps() {
  if ! command -v gh &>/dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is required. Install with: brew install gh${NC}"
    exit 1
  fi
  if ! gh auth status &>/dev/null 2>&1; then
    echo -e "${RED}Error: Not authenticated. Run: gh auth login${NC}"
    exit 1
  fi
}

check_repo() {
  if [[ -z "$CLAUDE_TASKS_REPO" ]]; then
    echo -e "${YELLOW}No tasks repo configured.${NC}"
    echo ""
    echo "  Option 1: Export the variable:"
    echo "    export CLAUDE_TASKS_REPO='your-username/claude-tasks'"
    echo ""
    echo "  Option 2: Create a repo now and set it:"
    read -rp "  Create a new tasks repo? (y/n): " yn
    if [[ "$yn" == "y" ]]; then
      read -rp "  Repo name (default: claude-tasks): " repo_name
      repo_name="${repo_name:-claude-tasks}"
      gh repo create "$repo_name" --private --description "Remote task queue for Claude" 2>/dev/null || true
      CLAUDE_TASKS_REPO="$(gh api user --jq .login)/$repo_name"
      echo ""
      echo -e "${GREEN}Created $CLAUDE_TASKS_REPO${NC}"
      echo ""
      echo "  Add this to your shell config:"
      echo "    export CLAUDE_TASKS_REPO='$CLAUDE_TASKS_REPO'"

      # Set up labels
      gh label create "$LABEL_PENDING" --repo "$CLAUDE_TASKS_REPO" \
        --description "Task for Claude to pick up" --color "0E8A16" 2>/dev/null || true
      gh label create "$LABEL_RUNNING" --repo "$CLAUDE_TASKS_REPO" \
        --description "Claude is working on this" --color "FBCA04" 2>/dev/null || true
      gh label create "$LABEL_DONE" --repo "$CLAUDE_TASKS_REPO" \
        --description "Claude completed this task" --color "5319E7" 2>/dev/null || true
    else
      exit 1
    fi
  fi
}

ensure_labels() {
  gh label create "$LABEL_PENDING" --repo "$CLAUDE_TASKS_REPO" \
    --description "Task for Claude to pick up" --color "0E8A16" 2>/dev/null || true
  gh label create "$LABEL_RUNNING" --repo "$CLAUDE_TASKS_REPO" \
    --description "Claude is working on this" --color "FBCA04" 2>/dev/null || true
  gh label create "$LABEL_DONE" --repo "$CLAUDE_TASKS_REPO" \
    --description "Claude completed this task" --color "5319E7" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

cmd_list() {
  echo -e "${BOLD}Pending tasks:${NC}"
  echo ""
  local tasks
  tasks=$(gh issue list --repo "$CLAUDE_TASKS_REPO" --label "$LABEL_PENDING" \
    --state open --json number,title,createdAt,labels \
    --jq '.[] | "  #\(.number)  \(.title)  (\(.createdAt | split("T")[0]))"' 2>/dev/null || echo "")

  if [[ -z "$tasks" ]]; then
    echo -e "  ${DIM}No pending tasks.${NC}"
  else
    echo "$tasks"
  fi

  echo ""
  echo -e "${BOLD}In progress:${NC}"
  echo ""
  local running
  running=$(gh issue list --repo "$CLAUDE_TASKS_REPO" --label "$LABEL_RUNNING" \
    --state open --json number,title \
    --jq '.[] | "  #\(.number)  \(.title)"' 2>/dev/null || echo "")

  if [[ -z "$running" ]]; then
    echo -e "  ${DIM}None.${NC}"
  else
    echo "$running"
  fi
  echo ""
}

cmd_create() {
  echo -e "${BOLD}Create a new task for Claude${NC}"
  echo ""
  read -rp "  Task title: " title
  if [[ -z "$title" ]]; then
    echo -e "${YELLOW}Cancelled.${NC}"
    return
  fi

  echo "  Task details (press Ctrl-D when done, or leave empty):"
  local body=""
  body=$(cat 2>/dev/null || echo "")

  echo ""

  # Ask for target repo/directory
  read -rp "  Target repo or directory (optional, e.g. owner/repo or ~/projects/myapp): " target

  local full_body="$body"
  if [[ -n "$target" ]]; then
    full_body="${full_body}

---
**Target:** \`${target}\`"
  fi

  local issue_url
  issue_url=$(gh issue create --repo "$CLAUDE_TASKS_REPO" \
    --title "$title" \
    --body "$full_body" \
    --label "$LABEL_PENDING" 2>/dev/null)

  echo -e "${GREEN}Task created: $issue_url${NC}"
}

cmd_quick() {
  local title="$1"
  local target="${2:-}"

  local body=""
  if [[ -n "$target" ]]; then
    body="---
**Target:** \`${target}\`"
  fi

  local issue_url
  issue_url=$(gh issue create --repo "$CLAUDE_TASKS_REPO" \
    --title "$title" \
    --body "$body" \
    --label "$LABEL_PENDING" 2>/dev/null)

  echo -e "${GREEN}Task created: $issue_url${NC}"
}

cmd_run() {
  local issue_number="$1"

  # Get issue details
  local issue
  issue=$(gh issue view "$issue_number" --repo "$CLAUDE_TASKS_REPO" \
    --json title,body,labels 2>/dev/null)

  if [[ -z "$issue" ]]; then
    echo -e "${RED}Issue #$issue_number not found.${NC}"
    return 1
  fi

  local title body target
  title=$(echo "$issue" | jq -r '.title')
  body=$(echo "$issue" | jq -r '.body')
  target=$(echo "$body" | grep -oP '(?<=\*\*Target:\*\* `)[^`]+' 2>/dev/null || echo "")

  echo -e "${CYAN}Running task #$issue_number: $title${NC}"

  # Mark as in-progress
  gh issue edit "$issue_number" --repo "$CLAUDE_TASKS_REPO" \
    --remove-label "$LABEL_PENDING" --add-label "$LABEL_RUNNING" 2>/dev/null || true

  # Determine working directory
  local workdir="$WORKSPACE"
  if [[ -n "$target" ]]; then
    if [[ "$target" =~ ^~/ ]] || [[ "$target" =~ ^/ ]]; then
      workdir="${target/#\~/$HOME}"
    elif [[ "$target" =~ / ]]; then
      # Looks like owner/repo - clone if needed
      local repo_name
      repo_name=$(basename "$target")
      workdir="$WORKSPACE/$repo_name"
      if [[ ! -d "$workdir" ]]; then
        echo -e "${CYAN}Cloning $target...${NC}"
        git clone "https://github.com/$target.git" "$workdir"
      fi
    else
      workdir="$WORKSPACE/$target"
    fi
  fi

  if [[ ! -d "$workdir" ]]; then
    mkdir -p "$workdir"
  fi

  # Build the prompt from the issue
  local prompt="Task from remote queue (GitHub Issue #$issue_number):

Title: $title

$body

When complete, summarize what you did."

  # Run Claude
  cd "$workdir"
  echo -e "${CYAN}Working directory: $workdir${NC}"
  echo -e "${CYAN}Starting Claude...${NC}"
  echo ""

  local output
  if output=$(claude -p "$prompt" 2>&1); then
    # Post result as comment
    gh issue comment "$issue_number" --repo "$CLAUDE_TASKS_REPO" \
      --body "## Claude completed this task

$output" 2>/dev/null || true

    # Mark as done
    gh issue edit "$issue_number" --repo "$CLAUDE_TASKS_REPO" \
      --remove-label "$LABEL_RUNNING" --add-label "$LABEL_DONE" 2>/dev/null || true
    gh issue close "$issue_number" --repo "$CLAUDE_TASKS_REPO" 2>/dev/null || true

    echo ""
    echo -e "${GREEN}Task #$issue_number completed and closed.${NC}"
  else
    # Post error as comment
    gh issue comment "$issue_number" --repo "$CLAUDE_TASKS_REPO" \
      --body "## Claude encountered an error

\`\`\`
$output
\`\`\`" 2>/dev/null || true

    echo ""
    echo -e "${RED}Task #$issue_number failed. Error posted to issue.${NC}"
  fi
}

cmd_run_next() {
  local next
  next=$(gh issue list --repo "$CLAUDE_TASKS_REPO" --label "$LABEL_PENDING" \
    --state open --json number --jq '.[0].number' 2>/dev/null || echo "")

  if [[ -z "$next" ]] || [[ "$next" == "null" ]]; then
    echo -e "${DIM}No pending tasks.${NC}"
    return
  fi

  cmd_run "$next"
}

cmd_done() {
  local issue_number="$1"
  gh issue edit "$issue_number" --repo "$CLAUDE_TASKS_REPO" \
    --remove-label "$LABEL_PENDING" --remove-label "$LABEL_RUNNING" \
    --add-label "$LABEL_DONE" 2>/dev/null || true
  gh issue close "$issue_number" --repo "$CLAUDE_TASKS_REPO" 2>/dev/null || true
  echo -e "${GREEN}Task #$issue_number marked as complete.${NC}"
}

cmd_help() {
  echo -e "${BOLD}Claude Remote Tasks${NC}"
  echo ""
  echo "  Give Claude instructions from anywhere using GitHub Issues."
  echo "  Create tasks from your phone, tablet, or browser."
  echo ""
  echo -e "  ${BOLD}Usage:${NC}"
  echo "    claude-tasks list              Show pending tasks"
  echo "    claude-tasks create            Create task interactively"
  echo "    claude-tasks quick \"fix bug\"   Create task with one command"
  echo "    claude-tasks run-next          Run the next pending task"
  echo "    claude-tasks run <number>      Run a specific task"
  echo "    claude-tasks done <number>     Mark task as complete"
  echo ""
  echo -e "  ${BOLD}Quick tips:${NC}"
  echo "    - Create tasks from GitHub mobile app (new issue + 'claude-task' label)"
  echo "    - Use iOS/Android Shortcuts to create tasks via gh CLI"
  echo "    - Set up a cron job to auto-run pending tasks"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  check_deps
  check_repo

  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    list)     cmd_list ;;
    create)   cmd_create ;;
    quick)    cmd_quick "$@" ;;
    run-next) cmd_run_next ;;
    run)      cmd_run "$@" ;;
    done)     cmd_done "$@" ;;
    help|*)   cmd_help ;;
  esac
}

main "$@"
