#!/bin/bash
# Run taze for Node.js dependency updates
# Usage: run-taze.sh [-r] [additional-args]
#   -r: Recursive mode for monorepos

set -e

# Check if taze is installed
if ! command -v taze &> /dev/null; then
    echo "ERROR: taze is not installed"
    echo ""
    echo "Install options:"
    echo "  npm install -g taze    # Global install (recommended)"
    echo "  npx taze               # One-time via npx"
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "ERROR: No package.json found in current directory"
    exit 2
fi

# Run taze with provided arguments
echo "Running taze..."
taze "$@"
