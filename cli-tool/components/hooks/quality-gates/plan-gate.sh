#!/bin/bash
# plan-gate.sh — Warning if implementing code without an approved spec
# Source: pm-workspace (https://github.com/gonzalezpazmonica/pm-workspace)
# License: MIT
#
# PreToolUse hook (Edit|Write) that warns if source code is being edited
# without a recent specification file (.spec.md) in the project.
# Non-blocking: shows warning but allows the edit to proceed.

set -euo pipefail

# Only check source code files
FILE="${CLAUDE_TOOL_INPUT_FILE:-}"
[[ -z "$FILE" ]] && exit 0

case "$FILE" in
    *.cs|*.ts|*.tsx|*.js|*.jsx|*.py|*.go|*.rs|*.php|*.rb|*.java|*.kt|*.swift|*.dart|*.vb|*.cbl) ;;
    *) exit 0 ;;
esac

# Look for active spec in the project
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"

# Search for recent specs (last sprint = last 14 days)
RECENT_SPECS=$(find "$PROJECT_DIR" -name "*.spec.md" -mtime -14 2>/dev/null | head -5)

if [[ -z "$RECENT_SPECS" ]]; then
    echo ""
    echo "Plan Gate: No recent approved spec found (.spec.md modified in last 14 days)."
    echo "   Consider creating a specification before implementing."
    echo "   (Warning only — does not block the edit)"
    echo ""
fi

exit 0
