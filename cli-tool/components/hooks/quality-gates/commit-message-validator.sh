#!/bin/bash
# commit-message-validator.sh
# Enforces Conventional Commits format on git commit messages.
# Requires: jq

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check git commit commands
if ! echo "$COMMAND" | grep -qE '^\s*git\s+commit\b'; then
  exit 0
fi

# Skip if no message flag is present
if ! echo "$COMMAND" | grep -qE '\s-[a-zA-Z]*m\b|\s--message\b'; then
  exit 0
fi

# Extract the commit message from -m "..." or --message "..."
MSG=$(echo "$COMMAND" | grep -oE "(-m|--message)\s+['\"]([^'\"]*)['\"]" | head -1 | sed "s/^-m\s\+//;s/^--message\s\+//;s/^['\"]//;s/['\"]$//")

if [ -z "$MSG" ]; then
  exit 0
fi

# ============================================================
# CUSTOMIZE: Allowed commit types and format pattern.
# ============================================================
ALLOWED_TYPES="feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert"
PATTERN="^($ALLOWED_TYPES)(\([a-zA-Z0-9_-]+\))?(!)?: .{1,}"

if ! echo "$MSG" | grep -qE "$PATTERN"; then
  cat >&2 <<EOF
BLOCKED: Commit message does not follow Conventional Commits format.

Your message: "$MSG"

Expected format: <type>(<optional scope>): <description>
Allowed types: $ALLOWED_TYPES

Examples:
  feat: add user authentication
  fix(auth): handle expired JWT tokens
  docs: update API reference
  chore!: drop support for Node 14
EOF
  exit 2
fi

exit 0
