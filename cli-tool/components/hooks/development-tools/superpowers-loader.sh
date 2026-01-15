#!/usr/bin/env bash
# SessionStart hook for superpowers - loads the using-superpowers skill
# This is the companion script for superpowers-loader.json hook

set -euo pipefail

# Determine skill location (try both possible installation paths)
SKILL_PATH_1="${HOME}/.claude/skills/using-superpowers.md"
SKILL_PATH_2="${HOME}/.claude/skills/development/using-superpowers/SKILL.md"

# Try to read the skill content from either location
if [ -f "$SKILL_PATH_1" ]; then
    using_superpowers_content=$(cat "$SKILL_PATH_1" 2>&1 || echo "Error reading using-superpowers skill")
elif [ -f "$SKILL_PATH_2" ]; then
    using_superpowers_content=$(cat "$SKILL_PATH_2" 2>&1 || echo "Error reading using-superpowers skill")
else
    using_superpowers_content="Superpowers skills not found. Install using: npx claude-code-templates@latest --skill using-superpowers"
fi

# Escape outputs for JSON using pure bash
escape_for_json() {
    local input="$1"
    local output=""
    local i char
    for (( i=0; i<${#input}; i++ )); do
        char="${input:$i:1}"
        case "$char" in
            $'\\') output+='\\\\' ;;
            '"') output+='\\"' ;;
            $'\n') output+='\\n' ;;
            $'\r') output+='\\r' ;;
            $'\t') output+='\\t' ;;
            *) output+="$char" ;;
        esac
    done
    printf '%s' "$output"
}

using_superpowers_escaped=$(escape_for_json "$using_superpowers_content")

# Output context injection as JSON
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<EXTREMELY_IMPORTANT>\\nYou have superpowers.\\n\\n**Below is the full content of your 'superpowers:using-superpowers' skill - your introduction to using skills. For all other skills, use the 'Skill' tool:**\\n\\n${using_superpowers_escaped}\\n</EXTREMELY_IMPORTANT>"
  }
}
EOF

exit 0
