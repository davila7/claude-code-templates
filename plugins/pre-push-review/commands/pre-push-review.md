---
description: Run the pre-push expert review panel on demand (staged changes, a branch, or a PR)
---

Run the bundled multi-agent expert review panel over the current changes and report the findings.

Steps:
1. Determine what to review from the user's arguments (`$ARGUMENTS`):
   - no args → review staged/unstaged changes
   - `branch` → review the commits being pushed (`--branch`)
   - `pr <n>` → review PR `<n>` and post the report as a rolling PR comment (`--pr <n>`)
2. Execute the panel:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-review-panel.mjs" <flags>
   ```
3. Summarize the panel's output for the user: the per-agent finding counts, every critical/high issue with its `file:line`, and the final `SUMMARY:` line. Do not re-review yourself — just relay and, if asked, help fix the reported issues.

Note: this is the same panel that the plugin's PreToolUse hook runs automatically before every `git push`. Use this command to review without pushing.
