#!/bin/bash
# smart-context-injector.sh
# Injects project context into Claude's session on startup and compact.
# Everything printed to stdout becomes Claude's context.
# Requires: jq, git

INPUT=$(cat)
SOURCE=$(echo "$INPUT" | jq -r '.source // "startup"')

# ============================================================
# CUSTOMIZE: Add or remove sections below.
# ============================================================

echo "## Project Context (auto-injected)"
echo ""

# --- Git info ---
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  BRANCH=$(git branch --show-current 2>/dev/null)
  echo "### Git Status"
  echo "- Branch: \`$BRANCH\`"

  CHANGED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CHANGED" -gt 0 ]; then
    echo "- Uncommitted changes: $CHANGED files"
    git status --porcelain 2>/dev/null | head -10 | while read -r line; do
      echo "  - \`$line\`"
    done
    if [ "$CHANGED" -gt 10 ]; then
      echo "  - ... and $((CHANGED - 10)) more"
    fi
  else
    echo "- Working tree is clean"
  fi

  echo ""
  echo "### Recent Commits"
  git log --oneline -5 2>/dev/null | while read -r line; do
    echo "- $line"
  done
  echo ""
fi

# --- TODOs in recent changes ---
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  TODOS=$(git diff --name-only HEAD~3 2>/dev/null | xargs grep -l "TODO\|FIXME\|HACK\|XXX" 2>/dev/null | head -5)
  if [ -n "$TODOS" ]; then
    echo "### TODOs in Recently Changed Files"
    for file in $TODOS; do
      grep -n "TODO\|FIXME\|HACK\|XXX" "$file" 2>/dev/null | head -3 | while read -r line; do
        echo "- \`$file\`: $line"
      done
    done
    echo ""
  fi
fi

# --- Project reminders ---
# CUSTOMIZE: Add your own project-specific reminders
echo "### Reminders"
echo "- Run tests before committing"
echo "- Follow the coding conventions in CLAUDE.md"
echo ""

echo "_Context injected on: $SOURCE ($(date '+%Y-%m-%d %H:%M'))_"
