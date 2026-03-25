{
  "description": "Send detailed Discord notifications with session information when Claude Code finishes. Includes working directory, session duration, and system info with rich embeds. Requires DISCORD_WEBHOOK_URL environment variable.",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$DISCORD_WEBHOOK_URL\" ]]; then echo \"$(date +%s)\" > ~/.claude/session_start.tmp; PROJECT_DIR=\"$(basename \"$(pwd)\")\"; MESSAGE='{\"embeds\":[{\"title\":\"🚀 Claude Code Session Started\",\"color\":3447003,\"fields\":[{\"name\":\"📁 Project\",\"value\":\"'\"$PROJECT_DIR\"'\",\"inline\":true},{\"name\":\"⏰ Time\",\"value\":\"'\"$(date '+%H:%M:%S')\"'\",\"inline\":true},{\"name\":\"📅 Date\",\"value\":\"'\"$(date '+%Y-%m-%d')\"'\",\"inline\":true}],\"timestamp\":\"'\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"'\"}]}'; curl -s -X POST \"$DISCORD_WEBHOOK_URL\" -H \"Content-Type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1; fi"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$DISCORD_WEBHOOK_URL\" ]]; then END_TIME=\"$(date +%s)\"; if [[ -f ~/.claude/session_start.tmp ]]; then START_TIME=\"$(cat ~/.claude/session_start.tmp)\"; DURATION=\"$((END_TIME - START_TIME))\"; MINUTES=\"$((DURATION / 60))\"; SECONDS=\"$((DURATION % 60))\"; DURATION_TEXT=\"${MINUTES}m ${SECONDS}s\"; rm -f ~/.claude/session_start.tmp; else DURATION_TEXT=\"Unknown\"; fi; PROJECT_DIR=\"$(basename \"$(pwd)\")\"; MEMORY_MB=\"$(ps -o rss= -p $$ 2>/dev/null | awk '{print int($1/1024)}' || echo 'N/A')\"; MESSAGE='{\"embeds\":[{\"title\":\"✅ Claude Code Session Completed\",\"color\":5763719,\"fields\":[{\"name\":\"📁 Project\",\"value\":\"'\"$PROJECT_DIR\"'\",\"inline\":true},{\"name\":\"⏱️ Duration\",\"value\":\"'\"$DURATION_TEXT\"'\",\"inline\":true},{\"name\":\"💾 Memory Used\",\"value\":\"'\"${MEMORY_MB}\"'MB\",\"inline\":true},{\"name\":\"⏰ Finished\",\"value\":\"'\"$(date '+%H:%M:%S')\"'\",\"inline\":true},{\"name\":\"📅 Date\",\"value\":\"'\"$(date '+%Y-%m-%d')\"'\",\"inline\":true}],\"timestamp\":\"'\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"'\"}]}'; curl -s -X POST \"$DISCORD_WEBHOOK_URL\" -H \"Content-Type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1 || echo \"Failed to send detailed Discord notification\"; else echo \"⚠️ Detailed Discord notification skipped: Set DISCORD_WEBHOOK_URL\"; fi"
          }
        ]
      }
    ]
  }
}