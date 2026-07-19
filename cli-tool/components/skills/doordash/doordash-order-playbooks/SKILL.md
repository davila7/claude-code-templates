---
name: doordash-order-playbooks
description: Named, context-bound saved DoorDash orders ("post-gym", "late-night deploy") recalled through the DoorDash CLI (dd-cli) with a mandatory cart-diff before any checkout link is handed over. Use when the user names a saved order ("order my post-gym bowl", "the usual", "my Friday ramen"), wants to save the order they just placed as a playbook, or asks to list/remove saved orders. Persists name→order-uuid playbooks across sessions, catches silent menu/price drift on every recall, and self-heals stale playbooks when a restaurant's menu changes. Requires dd-cli (macOS Apple Silicon, waitlist-gated).
allowed-tools: Bash(dd-cli:*), Bash(command -v:*), Bash(mkdir:*), Bash(cat:*), Bash(jq:*), Read, Write, Edit
tags: [DoorDash, Food Delivery, CLI, Saved Orders, Reorder, Automation]
---

# DoorDash Order Playbooks

Saved orders with names and contexts, recalled safely. A playbook maps a
human name ("post-gym", "late-night deploy", "Friday ramen") to a concrete
DoorDash order that can be rebuilt with `dd-cli order reorder` — plus enough
stored detail to **detect drift** (menu changes, price hikes, substitutions)
before the user is ever handed a checkout link.

> Unofficial community skill built on DoorDash's `doordash-oss/doordash-cli`.
> `dd-cli` must be installed, on PATH, and logged in (`dd-cli login`).

## Why this exists

`dd-cli order history` already lists past orders — but Claude has no
cross-session memory of *which* order is "the post-gym one", and plain
reordering silently accepts whatever the restaurant's menu says *today*:
substituted items, missing items, higher prices. This skill stores the
mapping AND makes a cart-diff against the stored baseline **mandatory**
before emitting any checkout URL. Silent drift becomes a caught event.

## State

Single JSON file: `~/.claude/dd-cli/playbooks.json`

```json
{
  "playbooks": {
    "post-gym": {
      "order_uuid": "<uuid from dd-cli order history>",
      "restaurant": "Sweetgreen",
      "items_summary": [
        { "name": "Harvest Bowl", "qty": 1, "price": 13.95 },
        { "name": "Lemonade", "qty": 1, "price": 3.5 }
      ],
      "baseline_total": 17.45,
      "tolerance_pct": 10,
      "contexts": ["post-gym", "gym", "workout"],
      "last_used": "2026-07-19",
      "times_used": 4
    }
  },
  "preflight": { "verified": false, "notes": "" }
}
```

Create the directory and file on first use (`mkdir -p ~/.claude/dd-cli`).
Prices are pre-fee subtotals — say so when presenting totals.

## Preflight (first use only — REQUIRED)

This skill assumes `dd-cli order reorder --order-uuid Y` returns a cart-uuid
that `cart show` and `order checkout-url` accept. That handoff is
load-bearing and must be verified empirically once per install:

1. Run `dd-cli order reorder --help` and `dd-cli order checkout-url --help`
   to confirm flags.
2. On the first real recall, after running `reorder`, confirm the output
   contains a cart-uuid and that `dd-cli cart show --cart-uuid <it>` works.
3. Record the outcome in `preflight.verified` (+ any format notes in
   `preflight.notes`) so future sessions skip this step.

If the handoff does NOT work as assumed, fall back to rebuilding the cart
manually (`dd-cli search` → `cart add-items`) and record that in
`preflight.notes`.

## Flow 1 — Recall (the main flow)

User says something like "order my post-gym bowl" / "the usual after the gym":

1. **Match**: fuzzy-match the request against playbook names and `contexts`.
   Ambiguous → ask. No match → offer Flow 2 (capture) instead.
2. **Rebuild**: `dd-cli order reorder --order-uuid <stored uuid>`. Capture
   the cart-uuid from the output.
3. **MANDATORY diff**: run `dd-cli cart show --cart-uuid <cart-uuid>` and
   compare against the stored `items_summary` + `baseline_total`:

   | | Stored | Current |
   |---|---|---|
   | Harvest Bowl | $13.95 | $14.95 ⬆ |
   | Lemonade | $3.50 | ❌ missing |
   | **Subtotal** | **$17.45** | **$14.95** |

   Present the diff table to the user. Never skip this step, even when
   everything matches — say "matches your baseline" explicitly.
4. **Gate**: if items are missing/substituted, or the subtotal exceeds
   `baseline_total` by more than `tolerance_pct`, STOP and ask the user how
   to proceed (accept, edit cart via `cart remove-item`/`cart add-items`, or
   abort). Do NOT hand over a checkout link silently.
5. **Checkout**: only after the diff is shown (and approved when the gate
   tripped): `dd-cli order checkout-url --cart-uuid <cart-uuid>`. Hand the
   URL to the user — payment always happens on the DoorDash page, by the
   human.
6. **Update**: bump `last_used` / `times_used`; if the user accepted new
   prices, offer to refresh `items_summary` and `baseline_total`.

## Flow 2 — Capture

After ANY completed order (via playbook or bespoke), offer once — don't nag:
"Want to save this as a playbook?" If yes:

1. `dd-cli order history` — take the most recent order's uuid.
2. Ask for a name and optional context words ("when should I suggest this?").
3. Write the entry with `items_summary` and `baseline_total` from the cart
   that was just built (or from the history entry if it shows detail).
4. Default `tolerance_pct`: 10.

## Flow 3 — Staleness / self-heal

When `order reorder` fails or the diff shows the restaurant no longer offers
the stored items:

1. Tell the user the playbook is stale and why.
2. `dd-cli search --query "<restaurant name>"` — confirm the restaurant still
   exists on DoorDash. Gone → offer to retire the playbook or find a
   replacement.
3. Rebuild an equivalent cart (`cart add-items`, navigating with `--help` as
   needed), confirm with the user, and after a successful checkout-url
   handoff refresh the playbook's `order_uuid` from `dd-cli order history`.

## Rules

- **Never emit a checkout URL without showing the diff first.** This is the
  contract of the skill.
- Read uuids from real command output; never fabricate or guess them.
- One capture offer per order, max. Respect a "no".
- Totals you can verify are pre-fee subtotals; final totals (fees, tip, tax)
  appear only on the DoorDash payment page. Say so.
- If `dd-cli` reports auth/waitlist errors, stop and tell the user to run
  `dd-cli login` — don't retry in a loop.
