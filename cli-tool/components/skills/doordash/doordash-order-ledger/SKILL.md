---
name: doordash-order-ledger
description: Accountability layer for agent-driven DoorDash ordering. Works with the doordash-audit-log hook (which appends every dd-cli invocation to an append-only audit log) and the /doordash-report command to answer "what has my AI been ordering and what did it cost" from data instead of memory. Use when the user asks about their DoorDash spending, ordering patterns, what the agent did in past sessions, or wants jq recipes for querying the audit log. Covers log schema, query patterns, rotation, and privacy guidance.
allowed-tools: Bash(dd-cli:*), Bash(jq:*), Bash(cat:*), Bash(wc:*), Bash(tail:*), Bash(mv:*), Bash(gzip:*), Read
tags: [DoorDash, Audit Log, Spend Tracking, Analytics, Accountability, CLI]
---

# DoorDash Order Ledger

Every dd-cli command the agent runs is recorded by the `doordash-audit-log` hook
in `~/.claude/dd-guard/audit.jsonl` — one versioned JSON line per event.
This skill teaches you to answer questions from that log instead of
guessing.

> Install the bundle: hook `doordash/doordash-audit-log` (the recorder), command
> `/doordash-report` (reconciled summaries), this skill (querying). Composes with
> doordash-spend-guard (shares the `~/.claude/dd-guard/` state directory) but runs
> standalone.

## Line schema (v1)

```json
{
  "v": 1,
  "ts": "2026-07-19T13:02:11",
  "session_id": "abc123",
  "cwd": "/Users/x/project",
  "command": "dd-cli search --query \"ramen near me\"",
  "event_type": "search | cart_mutation | checkout_url | history | login | other",
  "cart_uuid": "…or null",
  "order_uuid": "…or null",
  "exit_ok": true
}
```

Commands are secret-stripped before persisting and truncated to 500 chars.
The `v` field guards future schema changes — check it before assuming
fields.

## Query recipes (jq)

Answer from data, not memory:

```bash
# What did the agent do today?
jq -r 'select(.ts >= "2026-07-19") | "\(.ts) \(.event_type) \(.command)"' ~/.claude/dd-guard/audit.jsonl

# Checkout URLs issued this week (intents, not confirmed orders)
jq -r 'select(.event_type == "checkout_url" and .ts >= "2026-07-13")' ~/.claude/dd-guard/audit.jsonl

# Activity by type
jq -s 'group_by(.event_type) | map({type: .[0].event_type, n: length})' ~/.claude/dd-guard/audit.jsonl

# Which sessions touched carts?
jq -r 'select(.event_type == "cart_mutation") | .session_id' ~/.claude/dd-guard/audit.jsonl | sort | uniq -c

# Failed dd-cli calls (agent flailing?)
jq -r 'select(.exit_ok == false) | "\(.ts) \(.command)"' ~/.claude/dd-guard/audit.jsonl
```

When the user asks a money question ("how much this week?"), prefer
`/doordash-report` — it reconciles against real `dd-cli order history` and labels
intent-only numbers honestly. Raw checkout_url counts are intents: the
human may have abandoned the payment page.

## Honest semantics

- **checkout_url ≠ purchase.** It records that a link was issued. Only
  reconciliation against `order history` confirms money moved.
- Subtotals (when present via doordash-spend-guard's ledger) are pre-fee.
- The log records what went through Claude Code's Bash tool — orders placed
  by the human directly in a terminal or app are invisible to it.

## Maintenance

- **Rotation**: when audit.jsonl exceeds ~5 MB, rotate:
  `mv audit.jsonl audit-$(date +%Y%m).jsonl && gzip audit-*.jsonl` (keep the
  gzips; they are the history).
- **Never edit lines** — append-only is the audit property. Corrections go
  in reports, not in the log.
- **Privacy**: this is a plaintext record of eating habits and schedules.
  Keep `~/.claude/dd-guard/` out of repos and backups you share. Mention
  this to the user the first time you query the log in a session.
