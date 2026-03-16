#!/bin/bash
# test-runner-on-stop.sh
# Runs tests before Claude stops. Blocks stop if tests fail.
# Requires: jq

INPUT=$(cat)

# Prevent infinite loops: if stop hook already fired, allow stopping
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

# ============================================================
# CUSTOMIZE: Set your test command, or use auto-detection below.
# ============================================================
# TEST_CMD="npm test"  # Uncomment to hardcode

# Auto-detect project type
if [ -z "$TEST_CMD" ]; then
  if [ -f "package.json" ]; then
    TEST_CMD="npm test"
  elif [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
    TEST_CMD="python -m pytest --tb=short -q"
  elif [ -f "Cargo.toml" ]; then
    TEST_CMD="cargo test"
  elif [ -f "go.mod" ]; then
    TEST_CMD="go test ./..."
  elif [ -f "Gemfile" ]; then
    TEST_CMD="bundle exec rspec"
  else
    exit 0  # No test framework detected, allow stop
  fi
fi

TEST_OUTPUT=$($TEST_CMD 2>&1)
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
  jq -n \
    --arg reason "Tests failed. Fix the issues before finishing:\n$TEST_OUTPUT" \
    '{decision: "block", reason: $reason}'
  exit 0
fi

exit 0
