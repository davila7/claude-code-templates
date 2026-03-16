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

# Extract the commit message from various syntaxes:
#   -m "msg", -m 'msg', -am "msg", --message "msg", --message="msg"
MSG=""
# Try --message="..." or --message "..."
if [ -z "$MSG" ]; then
  MSG=$(echo "$COMMAND" | grep -oE -- "--message=['\"]([^'\"]*)['\"]" | head -1 | sed "s/^--message=//;s/^['\"]//;s/['\"]$//")
fi
if [ -z "$MSG" ]; then
  MSG=$(echo "$COMMAND" | grep -oE -- "--message[[:space:]]+['\"]([^'\"]*)['\"]" | head -1 | sed "s/^--message[[:space:]]*//;s/^['\"]//;s/['\"]$//")
fi
# Try -m "..." or -am "..."
if [ -z "$MSG" ]; then
  MSG=$(echo "$COMMAND" | grep -oE -- "-[a-zA-Z]*m[[:space:]]+['\"]([^'\"]*)['\"]" | head -1 | sed "s/^-[a-zA-Z]*m[[:space:]]*//;s/^['\"]//;s/['\"]$//")
fi

if [ -z "$MSG" ]; then
  # Could not extract message (editor mode, heredoc, etc.), allow through
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
