#!/bin/bash
# Start plan-mode-game server and open browser
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/server.pid"
FLAG="$SCRIPT_DIR/.plan-active"
PORT=3456

# Create plan-active flag
touch "$FLAG"

# Check if server is already running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    # Server running, just open browser
    open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null
    exit 0
  else
    rm -f "$PID_FILE"
  fi
fi

# Start server in background
nohup node "$SCRIPT_DIR/server.js" > /dev/null 2>&1 &

# Wait for server to be ready
for i in {1..20}; do
  if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

# Open browser (macOS or Linux)
open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null
