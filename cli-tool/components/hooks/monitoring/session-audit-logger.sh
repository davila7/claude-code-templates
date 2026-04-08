#!/bin/bash
# session-audit-logger.sh
# Logs every tool call as a JSON-lines entry for audit/compliance.
# Creates daily log files at .claude/logs/audit-YYYY-MM-DD.jsonl
# Requires: jq

INPUT=$(cat)

# ============================================================
# CUSTOMIZE: Log file location.
# ============================================================
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/logs"
LOG_FILE="$LOG_DIR/audit-$(date +%Y-%m-%d).jsonl"

mkdir -p "$LOG_DIR"

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input // {}')
CWD=$(echo "$INPUT" | jq -r '.cwd // "unknown"')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -n -c \
  --arg ts "$TIMESTAMP" \
  --arg sid "$SESSION_ID" \
  --arg tool "$TOOL_NAME" \
  --argjson input "$TOOL_INPUT" \
  --arg cwd "$CWD" \
  '{timestamp: $ts, session_id: $sid, tool: $tool, input: $input, cwd: $cwd}' \
  >> "$LOG_FILE"

exit 0
