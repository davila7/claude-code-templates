---
name: agency-os
description: Notion-as-source-of-truth dispatch board for teams and agencies. Manage tasks, subtasks, recurring workflows, and batch agent execution - all from Claude Code slash commands, with Notion as the live source of truth.
type: workflow
tags:
  - notion
  - task-management
  - agency
  - automation
  - workflow
---

# agency-os

Run your work like an AI agency from a single Notion board. agency-os is a Claude Code plugin that turns Notion into a live dispatch board: create tasks, triage inboxes, update statuses, and run recurring workflows - all from Claude Code slash commands, without context-switching to a browser.

GitHub: https://github.com/ratamaha-git/agency-os
Author: AutomateLab (https://automatelab.tech)
License: MIT

## What it does

- One Tasks database in Notion is the source of truth for everything
- Status flow: Suggestion -> Discussion -> To-Do -> In Progress -> Done (plus Killed)
- Full slash-command interface: `/agency-os suggest`, `discuss`, `approve`, `start`, `done`, `kill`, `next`, `status`, `run`
- Batch execution: mark rows `Exec=Agent` in Notion, run `/agency-os run --go` to fan them out in parallel (up to 5 concurrent agents)
- Recurring tasks: cadence-aware loop back to To-Do with Last Done updated
- Subtasks: self-referencing relation with cascade on approve and kill
- Natural-language driving: "add a suggestion for X", "let's discuss Y", "approve it", "X is done" all work

## Commands

```
/agency-os suggest "<title>" [--corpus=<s>] [--effort=S|M|L|XL]
/agency-os discuss <id>
/agency-os log <id> "<entry>"
/agency-os add-subtask <parent-id> "<title>"
/agency-os approve <id>
/agency-os start <id>
/agency-os refresh
/agency-os run [--go]
/agency-os done <id> [--result-link <url>]
/agency-os kill <id>
/agency-os next [N]
/agency-os status
/agency-os list <suggestion|todo|inprogress|done|all>
/agency-os show <id>
```

## Setup

1. Install: add `ratamaha-git/agency-os` as a Claude Code plugin.
2. Set `NOTION_KEY` in your `.env` (Notion internal integration token).
3. Run `/agency-os scaffold` to create the Hub, Tasks database, and corpus pages in Notion.
4. Add tasks via Notion UI or `/agency-os suggest`, mark agent-runnable rows with `Exec=Agent`.
5. Run `/agency-os run --go` to batch-execute the queue.

Full docs and launch post: https://automatelab.tech/p/b3e8d44b-dd98-4e16-a888-9b1be7e9829c/
