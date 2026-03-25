{
  "description": "Automatically stage modified files with git add after editing. Helps maintain a clean git workflow by staging changes as they're made.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -n \"$CLAUDE_TOOL_FILE_PATH\" ]] && git rev-parse --git-dir >/dev/null 2>&1; then git add \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true; fi"
          }
        ]
      }
    ]
  }
}