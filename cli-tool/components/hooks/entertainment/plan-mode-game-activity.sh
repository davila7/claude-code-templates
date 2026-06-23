#!/bin/bash
# Plan-mode-game activity hook - FAST PATH: exit immediately if not in plan mode
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLAG="$SCRIPT_DIR/.plan-active"

# Fast exit if not in plan mode (no stdin read, no subprocess)
[ ! -f "$FLAG" ] && exit 0

# We're in plan mode - read stdin and send activity
INPUT=$(cat)
curl -s --max-time 1 -X POST "http://localhost:3456/activity" \
  -H "Content-Type: application/json" -d "$INPUT" > /dev/null 2>&1 || true
