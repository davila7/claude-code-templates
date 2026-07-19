---
allowed-tools: Bash(dd-cli:*), Bash(jq:*), Bash(cat:*), Bash(mkdir:*), Read, Write, Edit
argument-hint: [list | add <name> | rm <name> | show <name>]
description: Manage saved DoorDash order playbooks (list, add from order history, remove, inspect) stored in ~/.claude/dd-cli/playbooks.json
---

# DoorDash Playbook Manager

Manage saved order playbooks: **$ARGUMENTS**

State file: `~/.claude/dd-cli/playbooks.json` (create with `mkdir -p ~/.claude/dd-cli` if missing).

## Current State

- Playbooks file: !`cat ~/.claude/dd-cli/playbooks.json 2>/dev/null || echo "(no playbooks yet)"`
- dd-cli available: !`command -v dd-cli || echo "dd-cli NOT on PATH"`

## Task

Parse `$ARGUMENTS` and run the matching subcommand:

### `list` (default when no arguments)

Render a table of playbooks: name, restaurant, baseline subtotal, contexts,
last used, times used. If empty, explain how to add one.

### `add <name>`

1. Run `dd-cli order history` and show the recent orders.
2. Ask the user which order to save under `<name>` (never guess).
3. Ask for optional context words (e.g. "post-gym, workout").
4. Write the playbook entry: `order_uuid`, `restaurant`, `items_summary`
   (name/qty/price per item as shown by history or the last `cart show`),
   `baseline_total`, `tolerance_pct: 10`, `contexts`, `last_used: today`,
   `times_used: 0`.

### `rm <name>`

Show the entry, confirm with the user, then delete it from the JSON.

### `show <name>`

Pretty-print the full entry, including stored items and baseline, and when
it was last used.

## Rules

- Keep the JSON valid — read-modify-write the whole file, never append text.
- `order_uuid` values come only from real `dd-cli order history` output.
- This command only manages the state file; actual ordering/recall flows are
  handled by the `doordash-order-playbooks` skill (install it alongside).
- If dd-cli is missing or logged out, say so and stop — don't fabricate
  history entries.
