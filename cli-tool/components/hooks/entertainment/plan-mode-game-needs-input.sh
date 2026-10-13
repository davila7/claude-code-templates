#!/bin/bash
# Pause game when Claude needs user input
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLAG="$SCRIPT_DIR/.plan-active"

# Only send pause if game is active
[ ! -f "$FLAG" ] && exit 0

curl -s --max-time 1 -X POST "http://localhost:3456/pause" > /dev/null 2>&1 || true
