---
name: nightly-changelog-loop
description: Updates the changelog every night with user-relevant changes and notifies the team when it ships.
category: operations
interval: 24h
stop-condition: The changelog reflects all merged, user-facing changes since the last entry and the team has been notified.
components: [agent:documentation/changelog-generator, hook:automation/change-logger, hook:automation/slack-notifications]
tags: [changelog, operations, release-notes, loop]
---

# Nightly Changelog Loop

> **Loop Engineering** — a scheduled operations loop that turns the day's merges into a clean, user-facing changelog and announces it automatically.

## 🎯 Goal
Each night, collect everything merged since the last entry, translate it into **user-relevant** changelog notes (not raw commits), and notify the team.

## ⏱️ Schedule
Suggested interval: `24h` (run overnight).

## ▶️ Run it
```
/loop 24h "Gather all changes merged since the last changelog entry. Write clear, user-facing release notes grouped by Added/Changed/Fixed. Update the changelog file, commit it, and post a summary to the team channel. Skip internal-only changes."
```

## 🔁 Iteration steps
1. **Perceive** — read merges since the last changelog entry via `change-logger`.
2. **Reason** — filter to user-facing changes; group as Added / Changed / Fixed.
3. **Plan** — draft concise, human-readable notes.
4. **Act** — update the changelog with `changelog-generator` and commit.
5. **Observe** — post the summary through `slack-notifications`; confirm delivery.

## 🛑 Stopping condition
Changelog covers all user-facing changes since the last entry and the team notification was sent.

## 🧩 Referenced components
- `agent:documentation/changelog-generator` — writes the release notes.
- `hook:automation/change-logger` — captures what changed.
- `hook:automation/slack-notifications` — announces the update.

## 💡 Example
Overnight the loop turns 14 merged PRs into 5 user-facing bullet points, commits `docs: changelog 2026-06-20`, and posts the summary to `#releases`.
