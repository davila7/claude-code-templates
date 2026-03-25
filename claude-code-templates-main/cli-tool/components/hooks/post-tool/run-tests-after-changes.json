{
  "description": "Automatically run quick tests after code modifications to ensure nothing breaks. This hook executes 'npm run test:quick' silently after any Edit operation and provides feedback on test status. Helps catch breaking changes immediately during development. Only runs if package.json exists and the test:quick script is available.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -f package.json ]] && npm run test:quick --silent >/dev/null 2>&1; then echo '✅ Tests passed'; else echo '⚠️ Tests may need attention'; fi"
          }
        ]
      }
    ]
  }
}