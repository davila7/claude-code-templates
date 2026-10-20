---
allowed-tools: Bash(dd-cli:*), Bash(cat:*), Bash(jq:*), Bash(mkdir:*), Read, Write, Edit
argument-hint: [order | checkout | whose-turn | roster]
description: Team lunch orchestration via DoorDash CLI - build a group round, emit checkout with split table, track payer rotation
---

# Team Lunch

Group order operation: **$ARGUMENTS**

Works with the `doordash-group-orders` skill (install it alongside — it defines
the full flows; this command is the quick entrypoint). State:
`team-food.json` (roster), `.dd/round-<date>.json` (active round),
`.dd/rounds.jsonl` (history).

## Current State

- Roster: !`cat team-food.json 2>/dev/null || cat ~/.claude/dd-cli/team-food.json 2>/dev/null || echo "(no roster yet)"`
- Active round: !`ls .dd/round-*.json 2>/dev/null | tail -1 || echo "(none)"`
- Rounds history: !`wc -l < .dd/rounds.jsonl 2>/dev/null || echo "0"` rounds recorded

## Task

Parse `$ARGUMENTS`:

### `order` (default)

Run Flow 1 of the doordash-group-orders skill: roster check → constraint-aware
restaurant shortlist via `dd-cli search` → per-member choices (favorites
first, one question max per member) → build cart recording person →
cart-item-id in the round ledger → show the cart grouped by person.

If the user pastes a thread of requests, parse it (Flow 2) instead of
interviewing members.

### `checkout`

1. Show the grouped cart one final time (per-person subtotals).
2. Emit the checkout URL — via `bash .claude/skills/doordash-spend-guard/scripts/dd-guard.sh checkout
   <cart-uuid>` when doordash-spend-guard is installed, otherwise
   `dd-cli order checkout-url --cart-uuid <cart-uuid>`.
3. Print a share-ready split table (markdown, ready to paste into Slack):
   person, items, subtotal share.
4. After the human confirms payment: pull order_uuid from `dd-cli order
   history`, ask who paid, append `{date, order_uuid, payer, split}` to
   `.dd/rounds.jsonl`, and offer the fee-proration fallback ("tell me the
   final total and I'll prorate the difference").

### `whose-turn`

Read `.dd/rounds.jsonl`, compute per-member (consumed − paid) balances,
name the next payer, show the balance table so the answer explains itself.

### `roster`

Show/edit `team-food.json` interactively: add/remove members, update hard
constraints, allergens (ask severity explicitly), favorites, dislikes.
Confirm the final JSON before writing.

## Rules

- Never guess an order for a member with allergens.
- cart-item-ids only from real `cart show` output — attribution depends on it.
- Splits are pre-fee until the user reports the final total; say so in the
  split table footer.
