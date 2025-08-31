{
  "description": "Automatically stage changes in git after file modifications for easier commit workflow. This hook runs 'git add' on any file that Claude edits or writes, automatically staging changes for the next commit. Includes error suppression so it won't fail in non-git repositories. Helps streamline the development workflow by preparing files for commit.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "git add \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      },
      {
        "matcher": "Write", 
        "hooks": [
          {
            "type": "command",
            "command": "git add \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}