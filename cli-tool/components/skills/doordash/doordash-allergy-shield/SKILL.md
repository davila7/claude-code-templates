---
name: doordash-allergy-shield
description: Persistent dietary safety layer for DoorDash CLI (dd-cli) ordering. Stores a personal/household dietary profile (allergens with severity tiers, diets, dislikes) that every cart is vetted against before checkout, with a deterministic tripwire — the vetting step saves the full cart contents to a vetted-cart dump, and a PreToolUse hook re-greps that dump against the anaphylaxis-severity allergen list before any checkout URL is allowed. Use when the user mentions allergies or dietary restrictions, when ordering food for someone with restrictions, or on every dd-cli cart flow while this skill is installed. A tripwire, not medical-grade — the human checkout page is the final check.
allowed-tools: Bash(dd-cli:*), Bash(command -v:*), Bash(mkdir:*), Bash(cat:*), Bash(jq:*), Read, Write, Edit
tags: [DoorDash, Allergies, Dietary Restrictions, Safety, Guardrails, CLI]
---

# DoorDash Allergy Shield

Claude has no cross-session memory: tell it "I'm allergic to peanuts" today
and tomorrow it happily adds pad thai. This skill persists a dietary profile
and makes cart vetting mandatory — with a deterministic hook double-checking
the highest-severity allergens before any checkout URL is emitted.

> Unofficial community skill built on DoorDash's `doordash-oss/doordash-cli`.

## Honest limits (state these to the user on first use)

- Matching is **heuristic**, against item names/descriptions from
  `cart show` output plus a synonyms table. It cannot see full ingredient
  lists and knows nothing about cross-contamination in the kitchen.
- It is a **tripwire against agent mistakes**, not a medical device. The
  DoorDash payment page — where the human reviews the real order — is the
  documented final check.
- False positives are accepted by design: blocking a safe ponzu bowl is
  cheap; the reverse is not. Hook matching is substring-based (short
  allergen names like "oat" can match inside "goat cheese") — annoying,
  never dangerous.
- The `references/allergen-synonyms.md` table is intentionally broader than
  the compact synonym subset hardcoded in the checkout-gate hooks; adding a
  synonym to the reference doc alone does not change what the hooks enforce.

## Components in this bundle

| Piece | Role |
|---|---|
| this skill | vetting protocol + profile management |
| `references/allergen-synonyms.md` | hidden-allergen lookup table |
| hook `doordash/doordash-allergy-checkout-gate` | deterministic re-check at checkout |
| command `/doordash-profile` | manage the dietary profile interactively |

## State

- `~/.claude/doordash-profile/dietary.json` — the profile. Structure:

```json
{
  "people": {
    "me": {
      "allergens": [
        { "name": "peanut", "severity": "anaphylaxis" },
        { "name": "shellfish", "severity": "avoid" }
      ],
      "diets": ["vegetarian"],
      "dislikes": ["cilantro"]
    },
    "sam": { "allergens": [{ "name": "egg", "severity": "avoid" }], "diets": [], "dislikes": [] }
  }
}
```

Severity tiers: `anaphylaxis` (hook-enforced, never overridable in-session),
`avoid` (requires explicit human acknowledgment to keep the item),
`preference` (mention it, don't gate on it).

- `~/.claude/doordash-profile/vetted/<cart-uuid>.json` — one dump per vetted cart:
  the **full raw `cart show` output** plus your verdict and a timestamp. The
  checkout hook greps this artifact — it trusts the dump, not your claim.

## Protocol

### Session start

Read `dietary.json`. Missing → offer to create it interactively (or via
`/doordash-profile`). If the user is ordering for others ("lunch for me and Sam"),
make sure each eater exists in the profile or ask for their restrictions.

### After EVERY cart mutation (add-items / remove-item / reorder)

1. Run `dd-cli cart show --cart-uuid <X>` and capture the full output.
2. Check every line against each relevant eater's profile — direct matches
   AND hidden sources from `references/allergen-synonyms.md` (satay→peanut,
   aioli→egg, ponzu→soy+fish, …).
3. On a conflict:
   - `anaphylaxis` → remove the item (`dd-cli cart remove-item`) and tell
     the user why. Do not offer to keep it.
   - `avoid` → present the conflict; keep only with explicit acknowledgment.
   - `preference` → mention it in passing.
4. Items whose name is too opaque to judge ("Chef's Special #3") → mark
   **UNVERIFIED** and require the user's explicit sign-off for eaters with
   `anaphylaxis` entries.
5. Write the vetted dump: full `cart show` output + verdict + ISO timestamp
   to `~/.claude/doordash-profile/vetted/<cart-uuid>.json`. Without this file the
   checkout hook blocks — vetting is not optional.

### At checkout

Just run `dd-cli order checkout-url --cart-uuid <X>` (or the dd-guard
wrapper when doordash-spend-guard is installed — the two gates compose). The hook
independently verifies: dump exists, is newer than the last cart mutation it
saw, and contains no anaphylaxis-tier keyword. If it blocks, do NOT try to
work around it — fix the cart, re-vet, and explain to the user what tripped.

## Rules

- Never edit `dietary.json` from the shell; profile changes go through
  `/doordash-profile` (interactive, confirmed).
- Never write a vetted dump without actually running `cart show` fresh — the
  dump IS the audit artifact.
- When in doubt about an ingredient, doubt is a conflict.
