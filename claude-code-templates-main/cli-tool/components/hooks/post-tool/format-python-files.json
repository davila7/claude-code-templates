{
  "description": "Automatically format Python files after any Edit operation using black formatter. This hook runs 'black' on any .py file that Claude modifies, ensuring consistent Python code formatting. Requires black to be installed ('pip install black'). The command includes error suppression (2>/dev/null || true) so it won't fail if black is not installed.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$CLAUDE_TOOL_FILE_PATH\" == *.py ]]; then black \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true; fi"
          }
        ]
      }
    ]
  }
}