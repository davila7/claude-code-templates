---
allowed-tools: Bash(dd-cli:*), Bash(cat:*), Bash(jq:*), Bash(wc:*), Read, Write, Edit
argument-hint: [week | month]
description: Spend and activity report for agent-driven DoorDash ordering - reconciles the audit log against real order history and renders totals, per-restaurant breakdown, repeat rate, and abandoned-cart rate
---

# DoorDash Activity Report

Report period: **$ARGUMENTS** (default: `week`)

Data sources: `~/.claude/dd-guard/audit.jsonl` (written by the doordash-audit-log
hook), `~/.claude/dd-guard/ledger.jsonl` (if doordash-spend-guard is installed),
and live `dd-cli order history`.

## Current State

- Audit events: !`wc -l < ~/.claude/dd-guard/audit.jsonl 2>/dev/null || echo "0"`
- Last reconciled: !`cat ~/.claude/dd-guard/last-reconciled 2>/dev/null || echo "(never)"`

## Task

### 1. Reconcile

1. Run `dd-cli order history` and parse the entries (date, restaurant,
   total, order_uuid).
   - **Parsing fallback**: the exact output format is version-dependent. If
     you cannot parse it confidently, fall back to **intent-only mode**:
     report from the audit log alone and label the report clearly as
     "unreconciled — based on agent activity, not confirmed orders".
2. Match `checkout_url` audit events (and ledger intents) against history
   entries by date proximity and cart/order uuid where visible:
   - matched → confirmed order
   - checkout_url event with no matching order after 24h → abandoned cart
3. Update `~/.claude/dd-guard/last-reconciled` with today's date. If
   doordash-spend-guard's ledger exists, flip matched intents to `paid` /
   `abandoned` exactly as `/doordash-budget reconcile` would.

### 2. Render the report (right-sized — no dashboard theater)

```
DoorDash activity — week of 2026-07-13
  Confirmed spend:   $87.40   (prev week $52.10, +68%)
  Orders:            4 confirmed, 1 abandoned cart (20% abandon rate)
  By restaurant:     Sweetgreen $34.90 (2x) · Thai Palace $28.50 · ...
  Repeat rate:       75% of orders were reorders/playbooks
  Agent activity:    12 searches, 9 cart mutations, 5 checkout URLs
```

- Totals from history are real; totals from intents are pre-fee subtotals —
  label which is which.
- `month` argument widens the window to 30 days and adds a week-by-week
  spend line.

### 3. Answer follow-ups from data

For questions like "what did I order most?" or "how much on ramen this
month?", query the audit log with `jq` (the doordash-order-ledger skill documents
recipes) — never answer from memory.

## Rules

- Never edit audit.jsonl — it is append-only; only the hook writes it.
- Keep `cuisine-map.json` (restaurant → cuisine) next to the audit log if
  the user wants cuisine grouping; persist their corrections there.
- Privacy: these files are a local plaintext record of eating habits.
  Remind the user once to keep `~/.claude/dd-guard/` out of any repo.
