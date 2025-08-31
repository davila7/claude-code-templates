{
  "description": "Automatically run linting tools after file modifications. Supports ESLint for JavaScript/TypeScript, Pylint for Python, and RuboCop for Ruby.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$CLAUDE_TOOL_FILE_PATH\" == *.js || \"$CLAUDE_TOOL_FILE_PATH\" == *.ts || \"$CLAUDE_TOOL_FILE_PATH\" == *.jsx || \"$CLAUDE_TOOL_FILE_PATH\" == *.tsx ]]; then npx eslint \"$CLAUDE_TOOL_FILE_PATH\" --fix 2>/dev/null || true; elif [[ \"$CLAUDE_TOOL_FILE_PATH\" == *.py ]]; then pylint \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true; elif [[ \"$CLAUDE_TOOL_FILE_PATH\" == *.rb ]]; then rubocop \"$CLAUDE_TOOL_FILE_PATH\" --auto-correct 2>/dev/null || true; fi"
          }
        ]
      }
    ]
  }
}