#!/bin/bash
# auto-commit-on-stop.sh
# Automatically commits changes when Claude finishes a task.
# Uses the session's last message to generate a commit message.
# Requires: jq, git

INPUT=$(cat)

# Prevent infinite loops
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

# Check if we're in a git repo
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  exit 0
fi

# Check for uncommitted changes (including untracked files)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | head -1)
if git diff --quiet && git diff --cached --quiet && [ -z "$UNTRACKED" ]; then
  exit 0  # Nothing to commit
fi

# ============================================================
# CUSTOMIZE: Commit message generation strategy.
# Options: "summary" (from Claude's last message) or "static"
# ============================================================
STRATEGY="summary"

if [ "$STRATEGY" = "summary" ]; then
  LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // ""' | head -c 200)
  SUMMARY=$(echo "$LAST_MSG" | head -1 | cut -c1-72)
  if [ -z "$SUMMARY" ]; then
    SUMMARY="Auto-commit from Claude Code session"
  fi
  COMMIT_MSG="chore: $SUMMARY"
else
  COMMIT_MSG="chore: auto-commit from Claude Code session"
fi

git add -A
git commit -m "$COMMIT_MSG" --no-verify > /dev/null 2>&1

if [ $? -eq 0 ]; then
  HASH=$(git rev-parse --short HEAD)
  echo "Auto-committed as $HASH: $COMMIT_MSG" >&2
fi

exit 0
