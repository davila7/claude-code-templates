---
allowed-tools: Bash(dd-cli:*), Bash(bash:*), Bash(cat:*), Bash(jq:*), Bash(mkdir:*), Read, Write, Edit
argument-hint: [status | set | reconcile]
description: View DoorDash spend vs caps, edit the dd-guard spending policy interactively, and reconcile the intent ledger against real order history
---

# DoorDash Budget Manager

Manage the dd-guard spending policy: **$ARGUMENTS**

State: `~/.claude/dd-guard/limits.json` (policy) and
`~/.claude/dd-guard/ledger.jsonl` (spend ledger). This command is the ONLY
sanctioned way to modify `limits.json` — the doordash-spend-guard hook blocks
direct command-line writes to it by design.

## Current State

- Policy: !`cat ~/.claude/dd-guard/limits.json 2>/dev/null || echo "(no policy yet — dd-guard seeds defaults on first run)"`
- Headroom: !`bash .claude/skills/doordash-spend-guard/scripts/dd-guard.sh status 2>/dev/null || echo "(dd-guard.sh not installed — install the doordash-spend-guard skill)"`

## Task

Parse `$ARGUMENTS` and run the matching subcommand:

### `status` (default when no arguments)

Present the dd-guard status output as a friendly table: each cap, spend to
date, headroom left. Note how many ledger entries are unreconciled intents
and remind that subtotals exclude fees/tips.

### `set`

Interactive policy editing:

1. Show the current policy values one by one.
2. Ask the user which value to change and to what
   (`per_order_max`, `daily_max`, `weekly_max`, `monthly_max`,
   `cooldown_minutes`, `allowed_hours.start/end`). Setting a cap to `null`
   removes it.
3. **Confirm the exact new policy with the user before writing** — read back
   the full JSON you intend to save.
4. Write `~/.claude/dd-guard/limits.json` with the Write tool (the hook
   permits interactive edits through this command's flow, not shell
   redirection).

### `reconcile`

Match unpaid intents against reality:

1. Run `dd-cli order history` and list recent orders.
2. For each ledger line with `"status": "intent"`, check whether a matching
   order (by date/restaurant/amount proximity) appears in history:
   - Match found → update the line to `"status": "paid"`.
   - Clearly abandoned (old intent, no matching order) → ask the user, then
     mark `"status": "abandoned"` so it stops counting against caps.
3. Rewrite `ledger.jsonl` preserving all other lines untouched
   (read-modify-write; keep it valid JSONL).
4. Report: N paid, M abandoned, K still pending.

## Rules

- Never change policy values without explicit user confirmation of the final
  JSON.
- Never delete ledger history — reconciliation only flips `status`.
- If the user asks to raise caps mid-session right after a blocked checkout,
  confirm they understand the block reason first (that friction is the
  point of the tool).
