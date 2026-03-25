{
  "description": "Send Discord notifications when Claude Code finishes working. Requires DISCORD_WEBHOOK_URL environment variable. Get webhook URL from Discord Server Settings -> Integrations -> Webhooks.",
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$DISCORD_WEBHOOK_URL\" ]]; then MESSAGE='{\"content\":\"🤖 Claude Code finished working at $(date '+%Y-%m-%d %H:%M:%S')\"}'; curl -s -X POST \"$DISCORD_WEBHOOK_URL\" -H \"Content-Type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1 || echo \"Failed to send Discord notification\"; else echo \"⚠️ Discord notification skipped: Set DISCORD_WEBHOOK_URL environment variable\"; fi"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$DISCORD_WEBHOOK_URL\" ]]; then MESSAGE='{\"content\":\"🎯 Claude Code subagent completed task at $(date '+%Y-%m-%d %H:%M:%S')\"}'; curl -s -X POST \"$DISCORD_WEBHOOK_URL\" -H \"Content-Type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1 || echo \"Failed to send Discord notification\"; else echo \"⚠️ Discord notification skipped: Set DISCORD_WEBHOOK_URL environment variable\"; fi"
          }
        ]
      }
    ]
  }
}