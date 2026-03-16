#!/bin/bash
# git-safety-net.sh
# Blocks destructive git operations to protect your repository.
# Requires: jq

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Only check git commands
if ! echo "$COMMAND" | grep -qE '^\s*git\s+'; then
  exit 0
fi

# ============================================================
# CUSTOMIZE: Branches that should be protected from force push,
# deletion, and history rewriting.
# ============================================================
PROTECTED_BRANCHES="main|master|develop|staging|production|release"

# --- Force push ---
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*--force'; then
  echo "BLOCKED: git push --force is not allowed. Use --force-with-lease for safer force pushes." >&2
  exit 2
fi

# --- Delete protected branches ---
if echo "$COMMAND" | grep -qE "git\s+branch\s+(-[dD]|--delete)\s+($PROTECTED_BRANCHES)\b"; then
  echo "BLOCKED: Cannot delete protected branch." >&2
  exit 2
fi
if echo "$COMMAND" | grep -qE "git\s+push\s+\S+\s+:($PROTECTED_BRANCHES)\b"; then
  echo "BLOCKED: Cannot delete protected branch on remote." >&2
  exit 2
fi
if echo "$COMMAND" | grep -qE "git\s+push\s+.*--delete\s+($PROTECTED_BRANCHES)\b"; then
  echo "BLOCKED: Cannot delete protected branch on remote." >&2
  exit 2
fi

# --- Reset --hard ---
if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard'; then
  echo "BLOCKED: git reset --hard discards all uncommitted changes. Use git stash instead, or specify a commit." >&2
  exit 2
fi

# --- Clean -fd (removes untracked files) ---
if echo "$COMMAND" | grep -qE 'git\s+clean\s+.*-[a-zA-Z]*f'; then
  echo "BLOCKED: git clean -f permanently deletes untracked files. Use git clean -n (dry run) first." >&2
  exit 2
fi

# --- Checkout -- . (discard all changes) ---
if echo "$COMMAND" | grep -qE 'git\s+checkout\s+--\s+\.'; then
  echo "BLOCKED: git checkout -- . discards all unstaged changes. Use git stash instead." >&2
  exit 2
fi

# --- Rebase on protected branches ---
if echo "$COMMAND" | grep -qE "git\s+rebase\s+.*($PROTECTED_BRANCHES)\b"; then
  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
  if echo "$CURRENT_BRANCH" | grep -qE "^($PROTECTED_BRANCHES)$"; then
    echo "BLOCKED: Cannot rebase while on protected branch '$CURRENT_BRANCH'. Create a feature branch first." >&2
    exit 2
  fi
fi

# --- Amend on protected branches ---
if echo "$COMMAND" | grep -qE 'git\s+commit\s+.*--amend'; then
  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
  if echo "$CURRENT_BRANCH" | grep -qE "^($PROTECTED_BRANCHES)$"; then
    echo "BLOCKED: Cannot amend commits on protected branch '$CURRENT_BRANCH'." >&2
    exit 2
  fi
fi

exit 0
