#!/bin/bash

# Create Pull Request using GitHub CLI
gh pr create \
  --title "🎨 Modern Violet Theme + Copy Button Fix" \
  --body "$(cat PR_DESCRIPTION.md)" \
  --base main \
  --head enhancing-modern-colour-schema \
  --label "enhancement" \
  --label "bug-fix" \
  --label "ui/ux"
