#!/bin/bash
# Send "Claude Finished!" announcement, remove flag, kill server safely
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/server.pid"
FLAG="$SCRIPT_DIR/.plan-active"
PORT=3456

# Send announcement
curl -s -X POST "http://localhost:$PORT/done" -d "Claude Finished!" > /dev/null 2>&1

# Remove plan-active flag
rm -f "$FLAG"

# Safe kill: save current PID and verify before killing
TARGET_PID=$(cat "$PID_FILE" 2>/dev/null)
if [ -n "$TARGET_PID" ]; then
  (sleep 10 && [ -f "$PID_FILE" ] && [ "$(cat "$PID_FILE" 2>/dev/null)" = "$TARGET_PID" ] && kill "$TARGET_PID" 2>/dev/null && rm -f "$PID_FILE") &
fi
