#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) — doordash-allergy-shield checkout gate.
#
# On `dd-cli order checkout-url` (direct or via dd-guard.sh):
#   BLOCK (exit 2) when:
#     - a dietary profile with anaphylaxis-tier allergens exists AND
#       (no vetted dump for this cart | dump stale vs last mutation |
#        dump text matches an anaphylaxis allergen or its hidden synonyms)
# On cart mutations (add-items / remove-item / reorder):
#   record a mutation timestamp so dump staleness is verifiable. Never blocks.
#
# No profile, or no anaphylaxis entries -> allow (the skill's softer tiers
# are conversational, only the unforgivable tier gets deterministic teeth).

set -euo pipefail
command -v python3 >/dev/null 2>&1 || exit 0

PAYLOAD=$(cat || true)

python3 - "$PAYLOAD" <<'PYEOF'
import json, os, re, sys, time

PROFILE_DIR = os.path.expanduser(os.environ.get("DD_PROFILE_DIR", "~/.claude/doordash-profile"))
DIETARY = os.path.join(PROFILE_DIR, "dietary.json")
VETTED = os.path.join(PROFILE_DIR, "vetted")
MUTATIONS = os.path.join(PROFILE_DIR, "mutations")

# Hidden-source synonyms for anaphylaxis-tier matching. Subset of the skill's
# references/allergen-synonyms.md — keep the two in sync when editing.
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
if "dd-cli" not in cmd and "dd-guard" not in cmd:
    sys.exit(0)

def cart_uuid_from(cmd):
    m = re.search(r'--cart-uuid[=\s]+([A-Za-z0-9-]+)', cmd)
    if m:
        return m.group(1)
    # dd-guard.sh checkout <uuid> form
    m = re.search(r'dd-guard\.sh\s+checkout\s+([A-Za-z0-9-]+)', cmd)
    return m.group(1) if m else None

# --- Record cart mutations (never blocks) -----------------------------------
if re.search(r'dd-cli\s+cart\s+(add-items|remove-item)\b|dd-cli\s+order\s+reorder\b|dd-guard\.sh\s+add-items\b', cmd):
    uuid = cart_uuid_from(cmd)
    if uuid:
        os.makedirs(MUTATIONS, exist_ok=True)
        with open(os.path.join(MUTATIONS, uuid), "w") as f:
            f.write(str(time.time()))
    sys.exit(0)

# --- Gate checkouts ----------------------------------------------------------
is_checkout = bool(re.search(r'dd-cli\s+order\s+checkout-url\b|dd-guard\.sh\s+checkout\b', cmd))
if not is_checkout:
    sys.exit(0)

if not os.path.exists(DIETARY):
    sys.exit(0)  # no profile -> shield not in use

try:
    profile = json.load(open(DIETARY))
except ValueError:
    print("doordash-allergy-shield: dietary.json is corrupt — fix it via /doordash-profile before checkout.", file=sys.stderr)
    sys.exit(2)

severe = []
for person in (profile.get("people") or {}).values():
    for a in person.get("allergens") or []:
        if a.get("severity") == "anaphylaxis" and a.get("name"):
            severe.append(a["name"].lower())

if not severe:
    sys.exit(0)  # only soft tiers -> conversational handling suffices

def block(reason):
    print(f"Blocked by doordash-allergy-shield: {reason}\n"
          "Re-vet the cart (run 'dd-cli cart show', check items against the profile, "
          "write the vetted dump) as described in the doordash-allergy-shield skill.", file=sys.stderr)
    sys.exit(2)

uuid = cart_uuid_from(cmd)
if not uuid:
    block("could not identify the cart-uuid in this checkout command.")

dump_path = os.path.join(VETTED, f"{uuid}.json")
if not os.path.exists(dump_path):
    block(f"no vetted-cart dump found for cart {uuid} (profile has anaphylaxis-tier allergens).")

mut_path = os.path.join(MUTATIONS, uuid)
if os.path.exists(mut_path) and os.path.getmtime(mut_path) > os.path.getmtime(dump_path):
    block(f"vetted dump for cart {uuid} is STALE — the cart changed after vetting.")

dump_text = open(dump_path, errors="replace").read().lower()
keywords = set()
for name in severe:
    keywords.add(name)
    for key, syns in SYNONYMS.items():
        if key in name or name in key:
            keywords.update(syns)

hits = sorted(k for k in keywords if k in dump_text)
if hits:
    block(f"anaphylaxis-tier match in vetted cart {uuid}: {', '.join(hits)}. "
          "Remove the item(s) with 'dd-cli cart remove-item' and re-vet.")

sys.exit(0)
PYEOF
