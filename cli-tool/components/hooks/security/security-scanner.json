{
  "description": "Scan code for security vulnerabilities and secrets after modifications. Uses multiple security tools to detect potential issues.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "if command -v semgrep >/dev/null 2>&1; then semgrep --config=auto \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true; fi; if command -v bandit >/dev/null 2>&1 && [[ \"$CLAUDE_TOOL_FILE_PATH\" == *.py ]]; then bandit \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true; fi; if command -v gitleaks >/dev/null 2>&1; then gitleaks detect --source=\"$CLAUDE_TOOL_FILE_PATH\" --no-git 2>/dev/null || true; fi; if grep -qE '(password|secret|key|token)\\s*=\\s*[\"\\'][^\"\\'\n]{8,}' \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null; then echo \"Warning: Potential hardcoded secrets detected in $CLAUDE_TOOL_FILE_PATH\" >&2; fi"
          }
        ]
      }
    ]
  }
}