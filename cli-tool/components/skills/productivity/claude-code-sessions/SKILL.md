---
name: claude-code-sessions
description: Search, analyze, and manage Claude Code session history. Use when the user wants to find past sessions, check token usage, review tool breakdowns, resume previous work, or manage tasks across sessions. Provides 11 skills and a web dashboard.
---

# Claude Code Sessions

Session intelligence plugin for Claude Code. Reads the JSONL session files that Claude Code writes to `~/.claude/projects/` and makes them searchable and analyzable.

## What It Does

Claude Code records every session as a JSONL file — messages, tool calls, token counts, diffs, tasks. This plugin reads those files and provides two interfaces. Most operations are read-only; delete and cleanup skills can remove session files when explicitly invoked.

**11 skills** usable directly in Claude Code:

| Skill | Purpose |
|-------|---------|
| `/session-search "query"` | Full-text search across every session |
| `/session-stats` | Token usage, model distribution, tool breakdown |
| `/session-list` | List sessions sorted by recency, size, or duration |
| `/session-detail` | Deep dive into a specific session |
| `/session-diff` | Compare two sessions — files, tools, topics |
| `/session-timeline` | Chronological view of sessions on a project |
| `/session-resume` | Generate a context recovery prompt from any session |
| `/session-tasks` | Find pending and orphaned tasks across sessions |
| `/session-export` | Export a session as clean markdown |
| `/session-cleanup` | Find empty, tiny, or stale sessions |
| `/session-delete` | Delete sessions and their associated tasks |

**Web dashboard** at `localhost:3000` with four views: Dashboard (summary stats), Sessions (sortable table with bulk operations), Search (full-text with context snippets), Tasks (grouped by status with orphan detection).

## Install

```bash
/plugin marketplace add apappascs/claude-code-sessions
/plugin install claude-code-sessions@claude-code-sessions
```

No API keys. No config. No runtime dependencies. It reads what's already on disk.

For the dashboard:

```bash
bun run ui
# → http://localhost:3000
```

## Architecture

Same TypeScript modules power skills, dashboard, and CLI:

```
lib/formatters.ts      — pure utilities, no I/O
lib/session-parser.ts  — parses one JSONL file into structured data
lib/session-store.ts   — scans all sessions, aggregates, searches
ui/server.ts           — HTTP endpoints + static file serving
```

Each lib file doubles as a standalone CLI:

```bash
bun run lib/session-store.ts list --sort recency --limit 10
bun run lib/session-store.ts search "database migration" --since 2025-01-01
bun run lib/session-parser.ts stats path/to/session.jsonl
```

## Use Cases

- Find the session where you solved a specific problem weeks ago
- See which projects consume the most tokens
- Track pending tasks across all sessions and projects
- Resume a past session with full context
- Compare how two sessions approached the same problem
- Export session transcripts for documentation

## Links

- **GitHub**: [github.com/apappascs/claude-code-sessions](https://github.com/apappascs/claude-code-sessions)
- **License**: MIT
