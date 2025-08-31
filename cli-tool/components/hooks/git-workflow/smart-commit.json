{
  "description": "Intelligent git commit creation with automatic message generation and validation. Creates meaningful commits based on file changes.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if git rev-parse --git-dir >/dev/null 2>&1 && [[ -n \"$CLAUDE_TOOL_FILE_PATH\" ]]; then git add \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null; CHANGED_LINES=$(git diff --cached --numstat \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null | awk '{print $1+$2}'); if [[ $CHANGED_LINES -gt 0 ]]; then FILENAME=$(basename \"$CLAUDE_TOOL_FILE_PATH\"); if [[ $CHANGED_LINES -lt 10 ]]; then SIZE=\"minor\"; elif [[ $CHANGED_LINES -lt 50 ]]; then SIZE=\"moderate\"; else SIZE=\"major\"; fi; MSG=\"Update $FILENAME: $SIZE changes ($CHANGED_LINES lines)\"; git commit -m \"$MSG\" \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true; fi; fi"
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "if git rev-parse --git-dir >/dev/null 2>&1 && [[ -n \"$CLAUDE_TOOL_FILE_PATH\" ]]; then git add \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null; FILENAME=$(basename \"$CLAUDE_TOOL_FILE_PATH\"); git commit -m \"Add new file: $FILENAME\" \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true; fi"
          }
        ]
      }
    ]
  }
}