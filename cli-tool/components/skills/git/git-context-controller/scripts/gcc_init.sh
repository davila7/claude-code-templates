#!/bin/bash
# GCC Initialization Script
# Creates the .GCC/ directory structure for agent memory management

set -e

GCC_DIR="${1:-.GCC}"

if [ -d "$GCC_DIR" ]; then
  echo "GCC already initialized at $GCC_DIR"
  exit 0
fi

mkdir -p "$GCC_DIR/branches"

# Create main.md - the global roadmap
cat > "$GCC_DIR/main.md" << 'EOF'
# Project Roadmap

## Objectives
- [ ] (Define project objectives here)

## Milestones
(Milestones will be populated as commits are made)

## Active Branches
(No active branches)
EOF

# Create metadata.yaml - infrastructure state
cat > "$GCC_DIR/metadata.yaml" << EOF
version: 1
created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
proactive_commits: true
branches:
  - name: main
    status: active
    created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
file_tree: []
dependencies: []
EOF

# Create initial commit.md
INIT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > "$GCC_DIR/commit.md" << EOF
# Commit History

## [INIT] Project initialized
- **Date**: $INIT_DATE
- **Branch**: main
- **Summary**: GCC memory system initialized.
EOF

# Create initial log.md
cat > "$GCC_DIR/log.md" << 'EOF'
# OTA Execution Log

> Most recent entries at the bottom. Keep last 50 entries max.

---
EOF

echo "GCC initialized successfully at $GCC_DIR/"
echo "Structure:"
echo "  $GCC_DIR/main.md        - Global roadmap"
echo "  $GCC_DIR/metadata.yaml  - Infrastructure state"
echo "  $GCC_DIR/commit.md      - Commit history"
echo "  $GCC_DIR/log.md         - OTA execution log"
echo "  $GCC_DIR/branches/      - Isolated workspaces"
