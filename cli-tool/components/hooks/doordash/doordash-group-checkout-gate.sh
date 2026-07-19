#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) — doordash-group-orders live checkout gate.
#
# Scope: only checkouts of carts that have a group round ledger
# (.dd/round-*.json with matching cart_uuid). For those, this hook:
#   1. Runs `dd-cli cart show --cart-uuid X` ITSELF (verifies reality, not a
#      flag file written earlier).
#   2. Joins cart lines to eaters via the round ledger's item names.
#   3. Greps each eater's lines against THEIR anaphylaxis-tier allergens
#      (name + hidden-source synonyms) from the team-food.json roster.
#   BLOCKS (exit 2) on a live match. Solo carts (no round ledger) pass —
#   they are doordash-allergy-shield territory.

set -euo pipefail
command -v python3 >/dev/null 2>&1 || exit 0

PAYLOAD=$(cat || true)

python3 - "$PAYLOAD" <<'PYEOF'
import glob, json, os, re, subprocess, sys

# Hidden-source synonyms for anaphylaxis-tier matching. Subset of the
# doordash-allergy-shield skill's references/allergen-synonyms.md — keep all three
# copies (this file, doordash-allergy-checkout-gate.sh, the reference doc) in sync.
SYNONYMS = {
    "peanut": ["satay", "pad thai", "kung pao", "gado-gado", "groundnut", "dan dan"],
    "tree nut": ["pesto", "praline", "marzipan", "frangipane", "baklava", "korma", "romesco"],
    "nut": ["pesto", "praline", "marzipan", "frangipane", "baklava", "korma", "romesco"],
    "egg": ["aioli", "mayo", "mayonnaise", "hollandaise", "carbonara", "meringue", "custard", "katsu", "tempura"],
    "milk": ["ghee", "paneer", "queso", "bechamel", "alfredo", "whey", "casein", "burrata"],
    "dairy": ["ghee", "paneer", "queso", "bechamel", "alfredo", "whey", "casein", "burrata"],
    "soy": ["ponzu", "teriyaki", "miso", "tempeh", "tofu", "edamame", "tamari", "hoisin"],
    "fish": ["ponzu", "worcestershire", "fish sauce", "nam pla", "dashi", "surimi", "anchovy", "puttanesca"],
    "shellfish": ["xo sauce", "shrimp paste", "belacan", "tom yum", "laksa", "bisque", "etouffee", "gumbo"],
    "shrimp": ["xo sauce", "shrimp paste", "belacan", "tom yum", "laksa", "bisque"],
    "wheat": ["seitan", "panko", "tempura", "udon", "ramen", "couscous", "semolina", "roux"],
    "gluten": ["seitan", "panko", "tempura", "udon", "ramen", "couscous", "semolina", "roux"],
    "sesame": ["tahini", "hummus", "halva", "za'atar", "gomashio", "furikake", "baba ganoush"],
}

try:
    payload = json.loads(sys.argv[1])
except (ValueError, IndexError):
    sys.exit(0)

cmd = (payload.get("tool_input") or {}).get("command") or ""
if not re.search(r'dd-cli\s+order\s+checkout-url\b|dd-guard\.sh\s+checkout\b', cmd):
    sys.exit(0)

m = re.search(r'--cart-uuid[=\s]+([A-Za-z0-9-]+)', cmd) or \
    re.search(r'dd-guard\.sh\s+checkout\s+([A-Za-z0-9-]+)', cmd)
if not m:
    sys.exit(0)
uuid = m.group(1)

cwd = payload.get("cwd") or os.getcwd()
dd_dir = os.environ.get("DD_ROUND_DIR", os.path.join(cwd, ".dd"))

round_data = None
for path in sorted(glob.glob(os.path.join(dd_dir, "round-*.json")), reverse=True):
    try:
        data = json.load(open(path))
    except ValueError:
        continue
    if data.get("cart_uuid") == uuid:
        round_data = data
        break
if not round_data:
    sys.exit(0)  # not a group cart

roster = None
for candidate in (os.path.join(cwd, "team-food.json"),
                  os.path.expanduser("~/.claude/dd-cli/team-food.json")):
    if os.path.exists(candidate):
        try:
            roster = json.load(open(candidate))
            break
        except ValueError:
            pass
if not roster:
    sys.exit(0)  # no roster to check against

def block(reason):
    print(f"Blocked by doordash-group-orders gate: {reason}", file=sys.stderr)
    sys.exit(2)

# Live cart contents — this hook verifies reality itself.
try:
    proc = subprocess.run(["dd-cli", "cart", "show", "--cart-uuid", uuid],
                          capture_output=True, text=True, timeout=30)
    live = (proc.stdout + proc.stderr).lower()
except (OSError, subprocess.TimeoutExpired):
    block(f"could not run 'dd-cli cart show' to verify group cart {uuid}. Fix dd-cli and retry.")
if proc.returncode != 0:
    block(f"'dd-cli cart show' failed for group cart {uuid}; cannot verify eater safety.")

members = roster.get("members") or {}
conflicts = []
for person, items in (round_data.get("orders") or {}).items():
    entry = members.get(person) or {}
    severe = [a["name"].lower() for a in entry.get("allergens") or []
              if a.get("severity") == "anaphylaxis" and a.get("name")]
    if not severe:
        continue
    keywords = set(severe)
    for name in severe:
        for key, syns in SYNONYMS.items():
            if key in name or name in key:
                keywords.update(syns)
    for item in items or []:
        item_name = (item.get("item") or "").lower()
        # The eater's ledger line itself, plus any live cart line mentioning it.
        texts = [item_name] + [ln for ln in live.splitlines()
                               if item_name and item_name[:12] in ln]
        for text in texts:
            hits = sorted(k for k in keywords if k in text)
            if hits:
                conflicts.append(f"{person}: '{item.get('item')}' matches {', '.join(hits)}")
                break

if conflicts:
    block("live anaphylaxis-tier conflict(s) —\n  " + "\n  ".join(conflicts) +
          "\nRemove the item(s) via the round ledger (dd-cli cart remove-item) and retry.")

sys.exit(0)
PYEOF
