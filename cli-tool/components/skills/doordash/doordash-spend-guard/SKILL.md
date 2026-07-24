---
name: doordash-spend-guard
description: Hard spending policy for agent-driven DoorDash ordering through the DoorDash CLI (dd-cli). Per-order ceiling, daily/weekly/monthly caps, cooldown between orders, and blocked hours — enforced deterministically by routing every cart-mutation and checkout through the dd-guard wrapper script, which prices the cart, checks the policy against a persistent spend ledger, and refuses out-of-policy checkouts with exit code 2. Use when the user wants budget limits on agent food ordering, asks "how much have I spent on DoorDash", wants to set spending caps, or whenever building carts / checking out with dd-cli while this skill is installed. Pairs with a PreToolUse hook that denies raw dd-cli checkout calls that bypass the wrapper.
allowed-tools: Bash(dd-cli:*), Bash(bash .claude/skills/doordash-spend-guard/scripts/dd-guard.sh:*), Bash(command -v:*), Bash(mkdir:*), Bash(cat:*), Bash(jq:*), Read
tags: [DoorDash, Budget, Spending Limits, Guardrails, CLI, Safety]
---

# DoorDash Spend Guard

A budget stated in a prompt is advisory — the model can forget it mid-session
and prompt injection can override it. This skill makes the budget
**deterministic**: every checkout and cart mutation goes through one audited
wrapper (`dd-guard.sh`) that prices the cart, checks the policy, and refuses
out-of-policy actions with a machine exit code. The companion PreToolUse hook
(`doordash-spend-guard` hook component) denies raw `dd-cli order checkout-url` /
`dd-cli cart add-items` calls that try to bypass the wrapper.

> Unofficial community skill built on DoorDash's `doordash-oss/doordash-cli`.
> Requires `dd-cli` installed and logged in. Wrapper needs `python3`.

## Honest scope

- Caps apply to the **pre-fee subtotal** that `cart show` exposes; fees, tip
  and tax land on the DoorDash payment page. Documented headroom, not
  loopholes.
- The ledger records **intent** when a checkout URL is issued; the human may
  abandon the page. `/doordash-budget` reconciles intents against
  `dd-cli order history`, marking entries `paid` or `abandoned`.
- Enforcement teeth come from the hook + wrapper combo. Install both; the
  skill alone is guidance.

## Components in this bundle

| Piece | Role |
|---|---|
| this skill | protocol: always route through dd-guard, report headroom |
| `scripts/dd-guard.sh` → installs to `.claude/skills/doordash-spend-guard/scripts/dd-guard.sh` | the deterministic gate |
| hook `doordash/doordash-spend-guard` | denies bypasses of the wrapper |
| command `/doordash-budget` | view/edit policy, reconcile ledger |

## State (created on first run)

- `~/.claude/dd-guard/limits.json` — policy. **Human-edited only.** Never
  edit this file yourself; when the user asks for a change, direct them to
  `/doordash-budget` which confirms interactively.

```json
{
  "per_order_max": 40,
  "daily_max": 60,
  "weekly_max": 150,
  "monthly_max": 400,
  "cooldown_minutes": 45,
  "allowed_hours": { "start": 7, "end": 23 }
}
```

- `~/.claude/dd-guard/ledger.jsonl` — one line per priced action:
  `{"ts": "...", "cart_uuid": "...", "subtotal": 24.5, "status": "intent"}`
  (`status` becomes `paid` / `abandoned` after reconciliation).

## Protocol (follow ALWAYS while this skill is installed)

1. **Session start / before building a cart**: report headroom —
   `bash .claude/skills/doordash-spend-guard/scripts/dd-guard.sh status` prints spend-to-date vs each
   cap. Tell the user their remaining budget before adding items.
2. **Adding items**: route through the wrapper —
   `bash .claude/skills/doordash-spend-guard/scripts/dd-guard.sh add-items <the exact dd-cli cart add-items args>`
   The wrapper execs the real `dd-cli cart add-items ...` and re-prices the
   cart afterwards.
3. **Checkout**: NEVER call `dd-cli order checkout-url` directly. Use
   `bash .claude/skills/doordash-spend-guard/scripts/dd-guard.sh checkout <cart-uuid>`
   - exit 0 → it printed the checkout URL and appended a ledger intent line.
   - exit 2 → blocked; it printed a human-readable reason (which cap, by how
     much). Relay the reason verbatim, then help within policy — e.g. suggest
     a cheaper reorder from `dd-cli order history` or trimming the cart with
     `dd-cli cart remove-item`.
4. **When blocked, do not negotiate with the wrapper.** No editing
   limits.json, no retrying with a fresh cart to reset the cooldown, no
   splitting one order into several to duck the per-order cap. If the user
   wants a different policy, point them to `/doordash-budget`.
5. If the wrapper reports the cart subtotal as unparseable, it blocks by
   design (conservative default). Show the user the raw `cart show` output
   and ask them to confirm the total explicitly before any manual override.

## Reading the ledger

Answer "how much have I spent this week?" from the ledger, not memory:

```bash
bash .claude/skills/doordash-spend-guard/scripts/dd-guard.sh status
# or raw:
cat ~/.claude/dd-guard/ledger.jsonl | jq -s '[.[] | select(.status != "abandoned")] | map(.subtotal) | add'
```

Remind the user that subtotals exclude fees/tips and intents may not have
been paid — `/doordash-budget` reconciles.
