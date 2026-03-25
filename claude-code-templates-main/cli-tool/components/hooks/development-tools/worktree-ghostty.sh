#!/bin/bash
# Hook: Worktree Ghostty Layout
#
# Creates git worktrees in a sibling directory and opens a Ghostty terminal
# layout with lazygit (top-right) and yazi (bottom-right).
#
# Events:
#   - WorktreeCreate: Creates worktree + opens Ghostty 3-panel layout
#   - WorktreeRemove: Removes worktree, branch, and empty directories
#
# Requirements:
#   - jq (JSON parsing)
#   - Ghostty terminal (macOS)
#   - lazygit (git TUI)
#   - yazi (file manager TUI)
#
# Ghostty keybindings required:
#   super+d       = new_split:right
#   super+shift+d = new_split:down

INPUT=$(cat)

if ! command -v jq &>/dev/null; then
  echo "jq is required but not installed" >&2
  exit 1
fi

HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name')
CWD=$(echo "$INPUT" | jq -r '.cwd')

#-----------------------------------------------------------------------
# WorktreeCreate: Create worktree in sibling dir + open Ghostty layout
#-----------------------------------------------------------------------
create_worktree() {
  local NAME
  NAME=$(echo "$INPUT" | jq -r '.name')

  local REPO_NAME PARENT_DIR WORKTREE_DIR BRANCH_NAME
  REPO_NAME=$(basename "$CWD")
  PARENT_DIR=$(cd "$CWD/.." && pwd)
  WORKTREE_DIR="$PARENT_DIR/worktrees/$REPO_NAME/$NAME"
  BRANCH_NAME="worktree-$NAME"

  # Detect default remote branch
  local DEFAULT_BRANCH
  DEFAULT_BRANCH=$(cd "$CWD" && git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
  : "${DEFAULT_BRANCH:=main}"

  # Create git worktree in sibling directory
  mkdir -p "$PARENT_DIR/worktrees/$REPO_NAME" >&2
  cd "$CWD" || exit 1
  git fetch origin &>/dev/null || true
  git worktree add -b "$BRANCH_NAME" "$WORKTREE_DIR" "origin/$DEFAULT_BRANCH" >&2 || {
    echo "Failed to create worktree: $NAME" >&2
    exit 1
  }

  # Open Ghostty layout: Claude (left) | lazygit (top-right) / yazi (bottom-right)
  # Uses clipboard + Cmd+V for reliable text input (keystroke is unreliable for long paths)
  {
    sleep 1.5
    osascript <<APPLESCRIPT >/dev/null 2>&1
-- Save current clipboard
try
  set oldClip to the clipboard as text
on error
  set oldClip to ""
end try

tell application "System Events"
  tell process "Ghostty"
    -- Split right (Cmd+D)
    keystroke "d" using {command down}
    delay 1.0

    -- cd + lazygit
    set the clipboard to "cd '${WORKTREE_DIR}' && lazygit"
    keystroke "v" using {command down}
    delay 0.3
    key code 36
    delay 2.0

    -- Split down (Cmd+Shift+D)
    keystroke "d" using {command down, shift down}
    delay 1.0

    -- cd + yazi
    set the clipboard to "cd '${WORKTREE_DIR}' && yazi"
    keystroke "v" using {command down}
    delay 0.3
    key code 36
  end tell
end tell

-- Restore clipboard
delay 0.5
set the clipboard to oldClip
APPLESCRIPT
  } &>/dev/null &

  # Output the worktree path (the ONLY stdout Claude Code reads)
  echo "$WORKTREE_DIR"
}

#-----------------------------------------------------------------------
# WorktreeRemove: Clean up worktree, branch, and empty directories
#-----------------------------------------------------------------------
remove_worktree() {
  local WORKTREE_PATH
  WORKTREE_PATH=$(echo "$INPUT" | jq -r '.worktree_path')

  [ ! -d "$WORKTREE_PATH" ] && exit 0

  # Find main repo (first entry in worktree list)
  local MAIN_REPO BRANCH_NAME
  MAIN_REPO=$(git -C "$WORKTREE_PATH" worktree list --porcelain 2>/dev/null | head -1 | sed 's/^worktree //')
  BRANCH_NAME="worktree-$(basename "$WORKTREE_PATH")"

  # Remove worktree and branch
  cd "$MAIN_REPO" 2>/dev/null || exit 0
  git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || rm -rf "$WORKTREE_PATH"
  git branch -D "$BRANCH_NAME" 2>/dev/null

  # Clean up empty parent directories
  rmdir "$(dirname "$WORKTREE_PATH")" 2>/dev/null
}

#-----------------------------------------------------------------------
# Event dispatcher
#-----------------------------------------------------------------------
case "$HOOK_EVENT" in
  WorktreeCreate) create_worktree ;;
  WorktreeRemove) remove_worktree ;;
esac
