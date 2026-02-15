#!/bin/bash
# Check if a tool is installed and provide installation instructions if not

TOOL_NAME="$1"
INSTALL_CMD="$2"

if [ -z "$TOOL_NAME" ]; then
    echo "Usage: check-tool.sh <tool-name> [install-command]"
    exit 1
fi

if command -v "$TOOL_NAME" &> /dev/null; then
    echo "OK: $TOOL_NAME is installed"
    $TOOL_NAME --version 2>/dev/null || true
    exit 0
else
    echo "MISSING: $TOOL_NAME is not installed"
    if [ -n "$INSTALL_CMD" ]; then
        echo "Install with: $INSTALL_CMD"
    fi
    exit 1
fi
