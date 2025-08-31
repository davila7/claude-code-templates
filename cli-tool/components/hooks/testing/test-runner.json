{
  "description": "Automatically run relevant tests after code changes. Detects test files and runs appropriate test commands based on file extensions and project structure.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$CLAUDE_TOOL_FILE_PATH\" == *.js || \"$CLAUDE_TOOL_FILE_PATH\" == *.ts ]] && [[ -f package.json ]]; then npm test 2>/dev/null || yarn test 2>/dev/null || true; elif [[ \"$CLAUDE_TOOL_FILE_PATH\" == *.py ]] && [[ -f pytest.ini || -f setup.cfg || -f pyproject.toml ]]; then pytest \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || python -m pytest \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true; elif [[ \"$CLAUDE_TOOL_FILE_PATH\" == *.rb ]] && [[ -f Gemfile ]]; then bundle exec rspec \"$CLAUDE_TOOL_FILE_PATH\" 2>/dev/null || true; fi"
          }
        ]
      }
    ]
  }
}