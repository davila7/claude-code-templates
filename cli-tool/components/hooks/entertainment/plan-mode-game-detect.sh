#!/bin/bash
# Detects Write to .claude/plans/ and starts the game (for /plan command)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLAG="$SCRIPT_DIR/.plan-active"

# Already in plan mode? Just forward to activity hook
if [ -f "$FLAG" ]; then
  INPUT=$(cat)
  curl -s --max-time 1 -X POST "http://localhost:3456/activity" \
    -H "Content-Type: application/json" -d "$INPUT" > /dev/null 2>&1 || true
  exit 0
fi

# Read stdin to check if this Write is to the plans directory
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if echo "$FILE_PATH" | grep -q "/.claude/plans/"; then
  # Plan mode detected! Start the game
  bash "$SCRIPT_DIR/start.sh"
  # Send this Write as first activity
  curl -s --max-time 1 -X POST "http://localhost:3456/activity" \
    -H "Content-Type: application/json" -d "$INPUT" > /dev/null 2>&1 || true
fi
