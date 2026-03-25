{
  "description": "Send detailed Slack notifications with session information when Claude Code finishes. Includes working directory, session duration, and system info. Requires SLACK_WEBHOOK_URL environment variable.",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$SLACK_WEBHOOK_URL\" ]]; then echo \"$(date +%s)\" > ~/.claude/session_start.tmp; PROJECT_DIR=\"$(basename \"$(pwd)\")\"; MESSAGE='{\"blocks\":[{\"type\":\"header\",\"text\":{\"type\":\"plain_text\",\"text\":\"🚀 Claude Code Session Started\"}},{\"type\":\"section\",\"fields\":[{\"type\":\"mrkdwn\",\"text\":\"*📁 Project:*\\n'\"$PROJECT_DIR\"'\"},{\"type\":\"mrkdwn\",\"text\":\"*⏰ Time:*\\n'\"$(date '+%H:%M:%S')\"'\"},{\"type\":\"mrkdwn\",\"text\":\"*📅 Date:*\\n'\"$(date '+%Y-%m-%d')\"'\"}]}]}'; curl -s -X POST \"$SLACK_WEBHOOK_URL\" -H \"Content-type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1; fi"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$SLACK_WEBHOOK_URL\" ]]; then END_TIME=\"$(date +%s)\"; if [[ -f ~/.claude/session_start.tmp ]]; then START_TIME=\"$(cat ~/.claude/session_start.tmp)\"; DURATION=\"$((END_TIME - START_TIME))\"; MINUTES=\"$((DURATION / 60))\"; SECONDS=\"$((DURATION % 60))\"; DURATION_TEXT=\"${MINUTES}m ${SECONDS}s\"; rm -f ~/.claude/session_start.tmp; else DURATION_TEXT=\"Unknown\"; fi; PROJECT_DIR=\"$(basename \"$(pwd)\")\"; MEMORY_MB=\"$(ps -o rss= -p $$ 2>/dev/null | awk '{print int($1/1024)}' || echo 'N/A')\"; MESSAGE='{\"blocks\":[{\"type\":\"header\",\"text\":{\"type\":\"plain_text\",\"text\":\"✅ Claude Code Session Completed\"}},{\"type\":\"section\",\"fields\":[{\"type\":\"mrkdwn\",\"text\":\"*📁 Project:*\\n'\"$PROJECT_DIR\"'\"},{\"type\":\"mrkdwn\",\"text\":\"*⏱️ Duration:*\\n'\"$DURATION_TEXT\"'\"},{\"type\":\"mrkdwn\",\"text\":\"*💾 Memory Used:*\\n'\"${MEMORY_MB}\"'MB\"},{\"type\":\"mrkdwn\",\"text\":\"*⏰ Finished:*\\n'\"$(date '+%H:%M:%S')\"'\"},{\"type\":\"mrkdwn\",\"text\":\"*📅 Date:*\\n'\"$(date '+%Y-%m-%d')\"'\"}]}]}'; curl -s -X POST \"$SLACK_WEBHOOK_URL\" -H \"Content-type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1 || echo \"Failed to send detailed Slack notification\"; else echo \"⚠️ Detailed Slack notification skipped: Set SLACK_WEBHOOK_URL\"; fi"
          }
        ]
      }
    ]
  }
}