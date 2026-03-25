{
  "description": "Send Discord notifications when Claude Code encounters long-running operations or when tools take significant time. Helps monitor productivity and catch potential issues with rich embeds. Requires DISCORD_WEBHOOK_URL environment variable.",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$DISCORD_WEBHOOK_URL\" ]]; then echo \"$(date +%s)\" > ~/.claude/bash_start.tmp; fi"
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
            "command": "if [[ -n \"$DISCORD_WEBHOOK_URL\" && -f ~/.claude/bash_start.tmp ]]; then END_TIME=\"$(date +%s)\"; START_TIME=\"$(cat ~/.claude/bash_start.tmp)\"; DURATION=\"$((END_TIME - START_TIME))\"; rm -f ~/.claude/bash_start.tmp; if [[ $DURATION -gt 30 ]]; then MINUTES=\"$((DURATION / 60))\"; SECONDS=\"$((DURATION % 60))\"; MESSAGE='{\"embeds\":[{\"title\":\"⚠️ Long Bash Operation\",\"color\":16776960,\"fields\":[{\"name\":\"⏱️ Duration\",\"value\":\"'\"${MINUTES}\"'m '\"${SECONDS}\"'s\",\"inline\":true},{\"name\":\"📁 Project\",\"value\":\"'\"$(basename \"$(pwd)\")\"'\",\"inline\":true},{\"name\":\"⏰ Time\",\"value\":\"'\"$(date '+%H:%M:%S')\"'\",\"inline\":true}],\"timestamp\":\"'\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"'\"}]}'; curl -s -X POST \"$DISCORD_WEBHOOK_URL\" -H \"Content-Type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1; fi; fi"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$DISCORD_WEBHOOK_URL\" ]]; then MESSAGE='{\"embeds\":[{\"title\":\"🔔 Claude Code Notification\",\"color\":3066993,\"fields\":[{\"name\":\"📁 Project\",\"value\":\"'\"$(basename \"$(pwd)\")\"'\",\"inline\":true},{\"name\":\"⏰ Time\",\"value\":\"'\"$(date '+%H:%M:%S')\"'\",\"inline\":true},{\"name\":\"💬 Status\",\"value\":\"Waiting for user input or permission\",\"inline\":false}],\"timestamp\":\"'\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"'\"}]}'; curl -s -X POST \"$DISCORD_WEBHOOK_URL\" -H \"Content-Type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1; fi"
          }
        ]
      }
    ]
  }
}