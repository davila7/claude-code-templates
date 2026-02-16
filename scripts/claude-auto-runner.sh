#!/bin/bash
# =============================================================================
# Claude Auto-Runner - Polls for remote tasks and runs them automatically
#
# Install as a LaunchAgent (macOS) to run in the background:
#   bash scripts/claude-auto-runner.sh install
#
# Or run manually:
#   bash scripts/claude-auto-runner.sh poll
#
# Configuration:
#   CLAUDE_TASKS_REPO   - GitHub repo for tasks (required)
#   CLAUDE_POLL_INTERVAL - Seconds between polls (default: 300 = 5 min)
#   CLAUDE_AUTO_RUN     - Set to "true" to auto-execute (default: notify only)
# =============================================================================

set -euo pipefail

POLL_INTERVAL="${CLAUDE_POLL_INTERVAL:-300}"
AUTO_RUN="${CLAUDE_AUTO_RUN:-false}"
CLAUDE_TASKS_REPO="${CLAUDE_TASKS_REPO:-}"
PLIST_NAME="com.claude.task-runner"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
LOG_DIR="$HOME/.claude-launchpad/logs"
REMOTE_TASKS_SCRIPT="$HOME/.claude-launchpad/remote-tasks.sh"

mkdir -p "$LOG_DIR"

# ---------------------------------------------------------------------------
# macOS LaunchAgent installation
# ---------------------------------------------------------------------------

cmd_install() {
  if [[ -z "$CLAUDE_TASKS_REPO" ]]; then
    echo "Error: Set CLAUDE_TASKS_REPO first."
    echo "  export CLAUDE_TASKS_REPO='your-username/claude-tasks'"
    exit 1
  fi

  local script_path
  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

  mkdir -p "$(dirname "$PLIST_PATH")"

  cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${script_path}</string>
        <string>poll</string>
    </array>
    <key>StartInterval</key>
    <integer>${POLL_INTERVAL}</integer>
    <key>EnvironmentVariables</key>
    <dict>
        <key>CLAUDE_TASKS_REPO</key>
        <string>${CLAUDE_TASKS_REPO}</string>
        <key>CLAUDE_AUTO_RUN</key>
        <string>${AUTO_RUN}</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/auto-runner.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/auto-runner.err</string>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  launchctl load "$PLIST_PATH"

  echo "Auto-runner installed and started."
  echo "  Polling every ${POLL_INTERVAL}s for tasks in ${CLAUDE_TASKS_REPO}"
  echo "  Auto-run: ${AUTO_RUN}"
  echo "  Logs: ${LOG_DIR}/auto-runner.log"
  echo ""
  echo "  To stop:   launchctl unload $PLIST_PATH"
  echo "  To remove: rm $PLIST_PATH"
}

cmd_uninstall() {
  if [[ -f "$PLIST_PATH" ]]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm "$PLIST_PATH"
    echo "Auto-runner uninstalled."
  else
    echo "Auto-runner is not installed."
  fi
}

# ---------------------------------------------------------------------------
# Poll for tasks
# ---------------------------------------------------------------------------

cmd_poll() {
  if [[ -z "$CLAUDE_TASKS_REPO" ]]; then
    echo "$(date): CLAUDE_TASKS_REPO not set, skipping." >> "$LOG_DIR/auto-runner.log"
    exit 0
  fi

  local count
  count=$(gh issue list --repo "$CLAUDE_TASKS_REPO" --label "claude-task" \
    --state open --json number --jq 'length' 2>/dev/null || echo "0")

  if [[ "$count" -gt 0 ]]; then
    echo "$(date): Found $count pending task(s)" >> "$LOG_DIR/auto-runner.log"

    if [[ "$AUTO_RUN" == "true" ]]; then
      echo "$(date): Auto-running next task..." >> "$LOG_DIR/auto-runner.log"
      if [[ -f "$REMOTE_TASKS_SCRIPT" ]]; then
        bash "$REMOTE_TASKS_SCRIPT" run-next >> "$LOG_DIR/auto-runner.log" 2>&1
      fi
    else
      # Send macOS notification
      osascript -e "display notification \"$count pending task(s) in queue\" with title \"Claude Tasks\" sound name \"Glass\"" 2>/dev/null || true
    fi
  else
    echo "$(date): No pending tasks" >> "$LOG_DIR/auto-runner.log"
  fi
}

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

cmd_status() {
  echo "Claude Auto-Runner Status"
  echo ""

  if [[ -f "$PLIST_PATH" ]]; then
    echo "  Installed: yes"
    if launchctl list | grep -q "$PLIST_NAME"; then
      echo "  Running: yes"
    else
      echo "  Running: no (load with: launchctl load $PLIST_PATH)"
    fi
  else
    echo "  Installed: no"
  fi

  echo "  Repo: ${CLAUDE_TASKS_REPO:-not set}"
  echo "  Interval: ${POLL_INTERVAL}s"
  echo "  Auto-run: ${AUTO_RUN}"
  echo ""

  if [[ -f "$LOG_DIR/auto-runner.log" ]]; then
    echo "  Last 5 log entries:"
    tail -5 "$LOG_DIR/auto-runner.log" | sed 's/^/    /'
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

case "${1:-status}" in
  install)   cmd_install ;;
  uninstall) cmd_uninstall ;;
  poll)      cmd_poll ;;
  status)    cmd_status ;;
  *)
    echo "Usage: claude-auto-runner.sh [install|uninstall|poll|status]"
    ;;
esac
