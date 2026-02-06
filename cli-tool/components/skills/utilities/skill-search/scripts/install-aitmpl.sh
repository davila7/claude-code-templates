#!/bin/bash
# Install a component from Claude Code Templates (aitmpl.com)
# Usage: bash install-aitmpl.sh "<type>" "<path>"
# Example: bash install-aitmpl.sh "agent" "development-team/frontend-developer"

TYPE="$1"
COMPONENT_PATH="$2"

if [ -z "$TYPE" ] || [ -z "$COMPONENT_PATH" ]; then
  echo "Error: Usage: install-aitmpl.sh <type> <path>"
  echo "  type: agent, command, mcp, hook, setting, skill, template"
  echo "  path: component path (e.g., development-team/frontend-developer)"
  exit 1
fi

echo "Installing ${TYPE}: ${COMPONENT_PATH} from Claude Code Templates..."

npx claude-code-templates@latest --${TYPE}="${COMPONENT_PATH}" --yes

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "Successfully installed ${TYPE}: ${COMPONENT_PATH}"
else
  echo "Error: Failed to install ${TYPE}: ${COMPONENT_PATH} (exit code: ${EXIT_CODE})"
  echo "Manual install: npx claude-code-templates@latest --${TYPE}=${COMPONENT_PATH}"
  exit $EXIT_CODE
fi
