---
name: doordash-group-orders
description: Group food ordering through the DoorDash CLI (dd-cli) from a persistent team roster. One request ("lunch for the team") fans out into a single merged cart with every line attributed to its eater via a person-to-cart-item-id ledger, per-person cost split with fee proration, payer rotation history, and a checkout gate that re-derives allergen conflicts against the roster live. Use when ordering for multiple people — team lunch, incident-response food, "collect orders from the thread" — or for /whose-turn payer rotation questions. Handles paste-a-thread intake: paste a Slack/chat thread and it builds the order ledger from it.
allowed-tools: Bash(dd-cli:*), Bash(command -v:*), Bash(mkdir:*), Bash(cat:*), Bash(jq:*), Read, Write, Edit
tags: [DoorDash, Team Lunch, Group Orders, Cost Split, CLI, Coordination]
---

# DoorDash Group Orders

Coordinating N people's food is exactly the cross-session state Claude
drops: who's vegetarian, who hates cilantro, which cart line is Bob's, whose
turn it is to pay. This skill keeps a roster, attributes every cart line to
its eater, splits costs with fees prorated, and remembers payer history.

> Unofficial community skill built on DoorDash's `doordash-oss/doordash-cli`.
> Note: dd-cli orders under ONE account — the account owner pays DoorDash;
> the split is for reimbursement (Venmo/transfer), not split payment.

## State

- `team-food.json` (project dir or `~/.claude/dd-cli/` — committable if the
  team shares a repo): the roster.

```json
{
  "members": {
    "dani":  { "hard": ["vegetarian"], "allergens": [{ "name": "peanut", "severity": "anaphylaxis" }], "favorites": ["Veggie burrito bowl"], "dislikes": ["cilantro"] },
    "bob":   { "hard": [], "allergens": [], "favorites": ["Spicy chicken sandwich"], "dislikes": [] }
  }
}
```

- `.dd/round-<date>.json` — the active round's ledger:

```json
{
  "date": "2026-07-19",
  "cart_uuid": "...",
  "restaurant": "...",
  "orders": {
    "dani": [{ "item": "Veggie bowl", "cart_item_id": "41", "price": 12.5 }],
    "bob":  [{ "item": "Spicy chicken sandwich", "cart_item_id": "42", "price": 11.0 }]
  }
}
```

- `.dd/rounds.jsonl` — history, one line per completed round:
  `{"date": "...", "order_uuid": "...", "payer": "dani", "split": {"dani": 14.1, "bob": 12.4}}`

## Flow 1 — Build a round

"Order lunch for the team":

1. **Roster check**: load `team-food.json`; missing members → quick
   interview (hard constraints, allergens + severity, a favorite, dislikes).
2. **Restaurant**: intersect hard constraints (a vegetarian on the roster =
   only places with real vegetarian options). `dd-cli search --query "..."`
   → shortlist of 2-3 → let the human pick.
3. **Per-member choice**: use their `favorites` when the restaurant matches;
   otherwise ask ONE question per member (or take answers from a pasted
   thread — Flow 2). Never guess for someone with allergens.
4. **Build the cart**: `dd-cli cart add-items ...` per member's items (via
   the dd-guard wrapper when doordash-spend-guard is installed). After each add,
   run `dd-cli cart show --cart-uuid <X>` and record which cart-item-id
   belongs to whom in `.dd/round-<date>.json`. This ledger is what makes
   "quita lo de Bob" resolvable later.
5. **Review**: show the cart grouped by person with per-person subtotals.
6. **Checkout**: emit the checkout URL (through dd-guard if installed). The
   group gate hook independently re-checks allergens (see below).
7. **Close the round**: after the human confirms they ordered, pull the
   order_uuid from `dd-cli order history`, compute the split, append to
   `.dd/rounds.jsonl`, and print a share-ready split table.

## Flow 2 — Paste-a-thread intake

The user pastes a Slack/chat thread ("who wants what"). Parse it into the
round file: person → requested items. Unknown people → ask if they should
join the roster. Ambiguous requests ("something spicy") → one clarifying
question, or their favorite if the restaurant matches. Then continue Flow 1
from step 4.

## Flow 3 — Edits by person

"Bob canceló" / "cambia lo de Sam": look up the person's `cart_item_id`s in
the round ledger, `dd-cli cart remove-item --cart-uuid X --cart-item-id N`
for each, update the ledger, re-show the grouped cart.

## Cost split

- Item subtotals per person from the round ledger.
- Fees/tip/tax are only final on the payment page: split the known subtotal
  now, and offer the post-payment fallback — "tell me the final total and
  I'll prorate the difference by each person's share."
- `split` = per-person items + prorated share of (final_total − subtotal)
  when provided.

## /whose-turn

Read `.dd/rounds.jsonl`: sum what each member has paid vs. consumed across
rounds; the next payer is the member with the largest (consumed − paid)
balance. Show the balances so the answer explains itself.

## Rules

- Anyone with an `anaphylaxis` allergen gets the same vetting the
  doordash-allergy-shield skill applies — check their items against hidden-source
  synonyms, and never guess their order.
- cart-item-ids come only from real `cart show` output.
- The round ledger is the source of truth for attribution — keep it updated
  on every cart mutation, or person-level edits break.
- Add `.dd/` to `.gitignore` unless the team explicitly wants round history
  committed (it reveals eating habits).
