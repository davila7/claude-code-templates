{
  "description": "Automatically format JavaScript/TypeScript files after any Edit operation using prettier. This hook runs 'npx prettier --write' on any .js, .ts, .jsx, or .tsx file that Claude modifies, ensuring consistent code formatting. Uses npx so prettier doesn't need to be globally installed. Includes error suppression so it won't fail if prettier is not available.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$CLAUDE_TOOL_FILE_PATH\" =~ \\.(js|ts|jsx|tsx)$ ]]; then npx prettier --write \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true; fi"
          }
        ]
      }
    ]
  }
}