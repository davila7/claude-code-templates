---
allowed-tools: Bash(cat:*), Bash(mkdir:*), Bash(jq:*), Read, Write, Edit
argument-hint: [show | add <person> | edit <person> | rm <person>]
description: Manage the dietary profile (allergens with severity tiers, diets, dislikes) used by doordash-allergy-shield to vet DoorDash carts
---

# Dietary Profile Manager

Manage the doordash-allergy-shield dietary profile: **$ARGUMENTS**

State: `~/.claude/doordash-profile/dietary.json`. This command is the sanctioned
way to edit it — the vetting flows treat the profile as human-confirmed
input, so every change here must be explicitly confirmed by the user.

## Current State

- Profile: !`cat ~/.claude/doordash-profile/dietary.json 2>/dev/null || echo "(no profile yet)"`

## Task

Parse `$ARGUMENTS` and run the matching subcommand:

### `show` (default when no arguments)

Render the profile as a table per person: allergens (with severity),
diets, dislikes. Explain the severity tiers:
- `anaphylaxis` — hook-enforced at checkout, never overridable in-session
- `avoid` — conflicts require explicit acknowledgment
- `preference` — mentioned, not gated

### `add <person>`

Interview the user for the new person:
1. Allergens — for each, ask the severity tier explicitly. Never assume
   severity; if the user says "allergic to X" without qualifying, ask
   "would exposure be dangerous (anaphylaxis-tier) or is it avoid-level?"
2. Diets (vegetarian, vegan, halal, kosher, gluten-free, ...).
3. Dislikes.
4. Read back the complete entry and confirm before writing.

### `edit <person>`

Show the person's current entry, ask what to change, confirm the final
entry before writing. Severity downgrades of an `anaphylaxis` entry require
the user to type the allergen name back explicitly — make deliberate
friction for the dangerous direction.

### `rm <person>`

Show the entry, confirm, remove.

## Rules

- Keep the JSON schema exactly as doordash-allergy-shield documents it
  (`people.<name>.allergens[].{name,severity}`, `diets[]`, `dislikes[]`) —
  the checkout-gate hook parses this file.
- Read-modify-write the whole file; never append or shell-redirect into it.
- Never invent or infer allergens from past orders — this file is
  human-declared only.
- After any change, remind the user that already-vetted carts were vetted
  against the OLD profile; re-vet before checking out.
