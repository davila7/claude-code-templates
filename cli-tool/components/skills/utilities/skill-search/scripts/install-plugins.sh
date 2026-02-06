#!/bin/bash
# Show installation instructions for GitHub Plugin Marketplace (Anthropic official)
# Plugins require the /plugin command inside Claude Code and cannot be installed via shell scripts.
# Usage: bash install-plugins.sh "<plugin-name>" "<marketplace-name>"
# Example: bash install-plugins.sh "pr-review-toolkit" "claude-plugins-official"

PLUGIN_NAME="$1"
MARKETPLACE_NAME="$2"

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: install-plugins.sh <plugin-name> [marketplace-name]"
  echo ""
  echo "Prints installation instructions for Claude Code plugins."
  echo "Plugins must be installed via the /plugin command inside Claude Code."
  echo ""
  echo "Arguments:"
  echo "  plugin-name       Name of the plugin to install"
  echo "  marketplace-name  Marketplace slug (default: claude-plugins-official)"
  exit 0
fi

if [ -z "$PLUGIN_NAME" ]; then
  echo "Error: Usage: install-plugins.sh <plugin-name> [marketplace-name]"
  exit 1
fi

# Default marketplace
if [ -z "$MARKETPLACE_NAME" ]; then
  MARKETPLACE_NAME="claude-plugins-official"
fi

# Output as JSON for consistent parsing
node -e "
console.log(JSON.stringify({
  type: 'plugin_install_instructions',
  plugin: '${PLUGIN_NAME}',
  marketplace: '${MARKETPLACE_NAME}',
  install_command: '/plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}',
  setup_steps: [
    'The official Anthropic marketplace (claude-plugins-official) is automatically available in Claude Code.',
    'Run: /plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}',
    'Or open /plugin and browse the Discover tab.'
  ],
  note: 'Plugins must be installed via the /plugin command inside Claude Code. They cannot be installed from a shell script.'
}, null, 2));
" 2>/dev/null || cat <<EOF
{
  "type": "plugin_install_instructions",
  "plugin": "${PLUGIN_NAME}",
  "marketplace": "${MARKETPLACE_NAME}",
  "install_command": "/plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}",
  "note": "Plugins must be installed via the /plugin command inside Claude Code."
}
EOF
