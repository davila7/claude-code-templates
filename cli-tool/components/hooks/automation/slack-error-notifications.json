{
  "description": "Send Slack notifications when Claude Code encounters long-running operations or when tools take significant time. Helps monitor productivity and catch potential issues. Requires SLACK_WEBHOOK_URL environment variable.",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$SLACK_WEBHOOK_URL\" ]]; then echo \"$(date +%s)\" > ~/.claude/bash_start.tmp; fi"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$SLACK_WEBHOOK_URL\" && -f ~/.claude/bash_start.tmp ]]; then END_TIME=\"$(date +%s)\"; START_TIME=\"$(cat ~/.claude/bash_start.tmp)\"; DURATION=\"$((END_TIME - START_TIME))\"; rm -f ~/.claude/bash_start.tmp; if [[ $DURATION -gt 30 ]]; then MINUTES=\"$((DURATION / 60))\"; SECONDS=\"$((DURATION % 60))\"; MESSAGE='{\"blocks\":[{\"type\":\"header\",\"text\":{\"type\":\"plain_text\",\"text\":\"⚠️ Long Bash Operation\"}},{\"type\":\"section\",\"fields\":[{\"type\":\"mrkdwn\",\"text\":\"*⏱️ Duration:*\\n'\"${MINUTES}\"'m '\"${SECONDS}\"'s\"},{\"type\":\"mrkdwn\",\"text\":\"*📁 Project:*\\n'\"$(basename \"$(pwd)\")\"'\"},{\"type\":\"mrkdwn\",\"text\":\"*⏰ Time:*\\n'\"$(date '+%H:%M:%S')\"'\"}]}]}'; curl -s -X POST \"$SLACK_WEBHOOK_URL\" -H \"Content-type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1; fi; fi"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$SLACK_WEBHOOK_URL\" ]]; then MESSAGE='{\"blocks\":[{\"type\":\"header\",\"text\":{\"type\":\"plain_text\",\"text\":\"🔔 Claude Code Notification\"}},{\"type\":\"section\",\"fields\":[{\"type\":\"mrkdwn\",\"text\":\"*📁 Project:*\\n'\"$(basename \"$(pwd)\")\"'\"},{\"type\":\"mrkdwn\",\"text\":\"*⏰ Time:*\\n'\"$(date '+%H:%M:%S')\"'\"},{\"type\":\"mrkdwn\",\"text\":\"*💬 Status:*\\nWaiting for user input or permission\"}]}]}'; curl -s -X POST \"$SLACK_WEBHOOK_URL\" -H \"Content-type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1; fi"
          }
        ]
      }
    ]
  }
}