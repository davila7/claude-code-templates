---
allowed-tools: Bash, Read
argument-hint: [base-branch] [head-branch]
description: Generate a reviewer-ready pull request summary from git diff and commit history
---

# PR Summary

Generate a concise pull request summary for: $ARGUMENTS

## Current State

- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`
- Changed files: !`git diff --name-status ${ARGUMENTS:-origin/main...HEAD} 2>/dev/null || git diff --name-status HEAD~1...HEAD`
- Diff summary: !`git diff --stat ${ARGUMENTS:-origin/main...HEAD} 2>/dev/null || git diff --stat HEAD~1...HEAD`

## Task

Create a pull request summary with these sections:

1. **Summary**
   - 2-4 bullets explaining the user-facing change.
   - Mention the main files or areas touched.

2. **Why**
   - Explain the problem or opportunity this PR addresses.
   - Keep it specific to the diff; do not invent context.

3. **Changes**
   - Group changes by area when useful.
   - Call out migrations, config changes, or public API changes.

4. **Testing**
   - List commands that were run if visible in the conversation or shell history.
   - If no tests were run, say `Not run (not provided)`.

5. **Reviewer Notes**
   - Highlight risky areas, compatibility concerns, or manual checks.
   - Use `None` if there are no special notes.

## Constraints

- Base claims only on the git diff and commit history.
- Do not include marketing language.
- Keep the final output ready to paste into a GitHub PR description.
- Prefer short bullets over paragraphs.
