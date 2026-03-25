{
  "description": "Send Slack notifications when Claude Code finishes working. Requires SLACK_WEBHOOK_URL environment variable. Get webhook URL from Slack App settings -> Incoming Webhooks.",
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$SLACK_WEBHOOK_URL\" ]]; then MESSAGE='{\"text\":\"🤖 Claude Code finished working at $(date '+%Y-%m-%d %H:%M:%S')\"}'; curl -s -X POST \"$SLACK_WEBHOOK_URL\" -H \"Content-type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1 || echo \"Failed to send Slack notification\"; else echo \"⚠️ Slack notification skipped: Set SLACK_WEBHOOK_URL environment variable\"; fi"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$SLACK_WEBHOOK_URL\" ]]; then MESSAGE='{\"text\":\"🎯 Claude Code subagent completed task at $(date '+%Y-%m-%d %H:%M:%S')\"}'; curl -s -X POST \"$SLACK_WEBHOOK_URL\" -H \"Content-type: application/json\" -d \"$MESSAGE\" >/dev/null 2>&1 || echo \"Failed to send Slack notification\"; else echo \"⚠️ Slack notification skipped: Set SLACK_WEBHOOK_URL environment variable\"; fi"
          }
        ]
      }
    ]
  }
}