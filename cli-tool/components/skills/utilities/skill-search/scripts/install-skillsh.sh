#!/bin/bash
# Install a skill from Skills.sh (Vercel)
# Usage: bash install-skillsh.sh "<package>"
# Example: bash install-skillsh.sh "vercel-labs/agent-skills"
# Example: bash install-skillsh.sh "vercel-labs/skills@find-skills"

PACKAGE="$1"

if [ -z "$PACKAGE" ]; then
  echo "Error: Usage: install-skillsh.sh <package>"
  echo "  package: owner/repo or owner/repo@skill-name"
  exit 1
fi

# Check if npx is available
if ! command -v npx &> /dev/null; then
  echo "Error: npx is not installed. Please install Node.js first."
  echo "Visit: https://nodejs.org"
  exit 1
fi

echo "Installing skill from Skills.sh: ${PACKAGE}..."

# Install globally for the current user, non-interactive
npx -y skills add "${PACKAGE}" -g -y

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "Successfully installed skill: ${PACKAGE}"
else
  echo "Error: Failed to install skill: ${PACKAGE} (exit code: ${EXIT_CODE})"
  echo "Manual install: npx skills add ${PACKAGE} -g -y"
  echo "Browse available skills at: https://skills.sh"
  exit $EXIT_CODE
fi
