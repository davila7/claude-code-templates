#!/usr/bin/env bash
# Runs test files one by one to find which test creates unwanted files/state.
# Run it from the project root (it searches the current directory for tests).
# Usage: ./find-polluter.sh <file_or_dir_to_check> <test_pattern>
# Example: ./find-polluter.sh 'packages/core/.git' 'src/**/*.test.ts'
# The test runner defaults to `npm test <file>`; override it with TEST_CMD,
# e.g. TEST_CMD="yarn test" or TEST_CMD="python -m pytest -q".

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 <file_to_check> <test_pattern>"
  echo "Example: $0 'packages/core/.git' 'src/**/*.test.ts'"
  exit 1
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

if [ -e "$POLLUTION_CHECK" ]; then
  echo "❌ $POLLUTION_CHECK exists before any test ran, so this run cannot tell"
  echo "   which test creates it. Check what it is first. If it is leftover test"
  echo "   output (not part of the project), move it aside and rerun."
  exit 2
fi

COUNT=0
while IFS= read -r TEST_FILE; do
  [ -n "$TEST_FILE" ] || continue
  COUNT=$((COUNT + 1))

  # Skip if pollution already exists
  if [ -e "$POLLUTION_CHECK" ]; then
    echo "⚠️  Pollution already exists before test $COUNT/$TOTAL"
    echo "   Skipping: $TEST_FILE"
    continue
  fi

  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # Run the test
  # TEST_CMD is intentionally word-split into command + arguments
  # shellcheck disable=SC2086
  $TEST_CMD "$TEST_FILE" > /dev/null 2>&1 || true

  # Check if pollution appeared
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
    echo "  $TEST_CMD $TEST_FILE    # Run just this test"
    echo "  cat $TEST_FILE         # Review test code"
    exit 1
  fi
done <<< "$TEST_FILES"

echo ""
echo "✅ No polluter found - all tests clean!"
exit 0
