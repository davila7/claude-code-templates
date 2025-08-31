{
  "description": "Send simple desktop notifications when Claude Code operations complete. Works on macOS and Linux systems.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "if command -v osascript >/dev/null 2>&1; then osascript -e 'display notification \"Tool: $CLAUDE_TOOL_NAME completed\" with title \"Claude Code\"'; elif command -v notify-send >/dev/null 2>&1; then notify-send 'Claude Code' \"Tool: $CLAUDE_TOOL_NAME completed\"; fi"
          }
        ]
      }
    ]
  }
}