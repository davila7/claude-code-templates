{
  "description": "Advanced dependency analysis and security checking. Monitors for outdated packages, security vulnerabilities, and license compatibility.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$CLAUDE_TOOL_FILE_PATH\" == *package.json || \"$CLAUDE_TOOL_FILE_PATH\" == *requirements.txt || \"$CLAUDE_TOOL_FILE_PATH\" == *Cargo.toml || \"$CLAUDE_TOOL_FILE_PATH\" == *pom.xml || \"$CLAUDE_TOOL_FILE_PATH\" == *Gemfile ]]; then echo \"Dependency file modified: $CLAUDE_TOOL_FILE_PATH\"; if [[ \"$CLAUDE_TOOL_FILE_PATH\" == *package.json ]] && command -v npm >/dev/null 2>&1; then npm audit 2>/dev/null || true; npx npm-check-updates 2>/dev/null || true; elif [[ \"$CLAUDE_TOOL_FILE_PATH\" == *requirements.txt ]] && command -v safety >/dev/null 2>&1; then safety check -r \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true; elif [[ \"$CLAUDE_TOOL_FILE_PATH\" == *Cargo.toml ]] && command -v cargo >/dev/null 2>&1; then cargo audit 2>/dev/null || true; fi; fi"
          }
        ]
      }
    ]
  }
}