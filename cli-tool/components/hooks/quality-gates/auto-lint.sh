#!/bin/bash
# auto-lint.sh
# Runs the appropriate linter after Claude edits or writes a file.
# Lint errors are fed back to Claude as context.
# Requires: jq

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXTENSION="${FILE_PATH##*.}"

# ============================================================
# CUSTOMIZE: Map file extensions to linter commands.
# The linter command receives the file path as an argument.
# ============================================================
case "$EXTENSION" in
  js|jsx|mjs)
    LINTER="npx eslint --no-error-on-unmatched-pattern"
    ;;
  ts|tsx)
    LINTER="npx eslint --no-error-on-unmatched-pattern"
    ;;
  py)
    LINTER="ruff check"
    ;;
  rb)
    LINTER="rubocop --format simple"
    ;;
  go)
    LINTER="golangci-lint run"
    ;;
  rs)
    LINTER="cargo clippy --message-format short --"
    ;;
  css|scss)
    LINTER="npx stylelint"
    ;;
  *)
    exit 0
    ;;
esac

LINT_OUTPUT=$($LINTER "$FILE_PATH" 2>&1)
LINT_EXIT=$?

if [ $LINT_EXIT -ne 0 ] && [ -n "$LINT_OUTPUT" ]; then
  echo "Lint errors in $FILE_PATH:" >&2
  echo "$LINT_OUTPUT" >&2
  exit 2
fi

exit 0
