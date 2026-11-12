#!/usr/bin/env bash
# Runs test files one by one to find which test creates unwanted files/state.
# Exit codes: 0 no polluter, 1 polluter found, 2 usage/setup error,
# 3 no polluter but some test files failed (incomplete result).
# Run it from the project root (it searches the current directory for tests).
# Usage: ./find-polluter.sh <file_or_dir_to_check> <test_pattern>
# Example: ./find-polluter.sh 'packages/core/.git' 'src/**/*.test.ts'
# The test runner defaults to `npm test <file>`; override it with TEST_CMD,
# e.g. TEST_CMD="yarn test" or TEST_CMD="python -m pytest -q".

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 <file_to_check> <test_pattern>"
  echo "Example: $0 'packages/core/.git' 'src/**/*.test.ts'"
  exit 2
fi

POLLUTION_CHECK="$1"
TEST_PATTERN="$2"
TEST_CMD="${TEST_CMD:-npm test}"

echo "🔍 Searching for test that creates: $POLLUTION_CHECK"
echo "Test pattern: $TEST_PATTERN"
echo "Test command: $TEST_CMD <file>"
echo ""

# Get list of test files (find . emits ./-prefixed paths, so accept the
# pattern written with or without a leading ./)
TEST_PATTERN="${TEST_PATTERN#./}"
# find -path can't match '**/' against zero directory levels, so a pattern
# like src/**/*.test.ts would skip src/top.test.ts; also try the pattern
# with '**/' collapsed to cover files directly under the base directory.
TEST_FILES=$(find . \( -path "./$TEST_PATTERN" -o -path "./${TEST_PATTERN//\*\*\//}" \) | sort -u)
if [ -z "$TEST_FILES" ]; then
  TOTAL=0
else
  TOTAL=$(printf '%s\n' "$TEST_FILES" | wc -l | tr -d ' ')
fi

echo "Found $TOTAL test files"
echo ""

if [ "$TOTAL" -eq 0 ]; then
  echo "❌ No test files match '$TEST_PATTERN' (searched from $(pwd))."
  echo "   Check the pattern and run this from the project root."
  exit 2
fi

if [ -e "$POLLUTION_CHECK" ]; then
  echo "❌ $POLLUTION_CHECK exists before any test ran, so this run cannot tell"
  echo "   which test creates it. Check what it is first. If it is leftover test"
  echo "   output (not part of the project), move it aside and rerun."
  exit 2
fi

COUNT=0
FAILED=0
while IFS= read -r TEST_FILE; do
  [ -n "$TEST_FILE" ] || continue
  COUNT=$((COUNT + 1))
  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # TEST_CMD is intentionally word-split into command + arguments.
  # A failing test is fine (polluters often fail too), but count it, and stop
  # if the runner itself is missing.
  STATUS=0
  # shellcheck disable=SC2086
  $TEST_CMD "$TEST_FILE" > /dev/null 2>&1 || STATUS=$?
  if [ "$STATUS" -eq 127 ] || [ "$STATUS" -eq 126 ]; then
    echo "❌ Could not run '$TEST_CMD' (exit $STATUS). Set TEST_CMD to your test runner."
    exit 2
  fi
  [ "$STATUS" -eq 0 ] || FAILED=$((FAILED + 1))

  if [ -e "$POLLUTION_CHECK" ]; then
    echo ""
    echo "🎯 FOUND POLLUTER!"
    echo "   Test: $TEST_FILE"
    echo "   Created: $POLLUTION_CHECK"
    echo ""
    echo "Pollution details:"
    ls -la "$POLLUTION_CHECK"
    echo ""
    echo "To investigate:"
    printf '  %s %q    # Run just this test\n' "$TEST_CMD" "$TEST_FILE"
    printf '  cat -- %q    # Review test code\n' "$TEST_FILE"
    exit 1
  fi
done <<< "$TEST_FILES"

echo ""
if [ "$FAILED" -gt 0 ]; then
  echo "⚠️  No polluter found, but $FAILED of $TOTAL test files exited with an error."
  echo "   A test that fails early may never reach the code that pollutes, so this"
  echo "   result is incomplete. Run one of them with: $TEST_CMD <file>"
  exit 3
fi
echo "✅ No polluter found: all $TOTAL test files ran cleanly."
exit 0
