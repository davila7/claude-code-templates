#!/usr/bin/env bash
# dd-guard — deterministic spending gate for DoorDash CLI (dd-cli).
#
# Subcommands:
#   status                 Print spend-to-date vs each cap.
#   checkout <cart-uuid>   Price the cart, enforce policy, then emit checkout URL.
#   add-items <args...>    Pass-through to `dd-cli cart add-items <args...>`,
#                          then re-price the cart against the per-order cap.
#
# Exit codes: 0 = allowed/done, 2 = BLOCKED by policy (reason on stdout/stderr),
#             3 = configuration or environment error.
#
# State: ~/.claude/dd-guard/limits.json (human-edited via /doordash-budget only)
#        ~/.claude/dd-guard/ledger.jsonl (append-only spend ledger)
#
# Design notes:
# - Caps apply to the pre-fee subtotal reported by `dd-cli cart show`.
# - If the subtotal cannot be parsed, dd-guard BLOCKS (conservative default).
# - Requires python3 (JSON + date math). No other dependencies.

set -euo pipefail

GUARD_DIR="${DD_GUARD_DIR:-$HOME/.claude/dd-guard}"
LIMITS="$GUARD_DIR/limits.json"
LEDGER="$GUARD_DIR/ledger.jsonl"

command -v dd-cli >/dev/null 2>&1 || { echo "dd-guard: dd-cli not on PATH" >&2; exit 3; }
command -v python3 >/dev/null 2>&1 || { echo "dd-guard: python3 required" >&2; exit 3; }

mkdir -p "$GUARD_DIR"
touch "$LEDGER"

# Seed a default policy on first run (user tunes it via /doordash-budget).
if [ ! -f "$LIMITS" ]; then
  cat > "$LIMITS" <<'EOF'
{
  "per_order_max": 40,
  "daily_max": 60,
  "weekly_max": 150,
  "monthly_max": 400,
  "cooldown_minutes": 45,
  "allowed_hours": { "start": 7, "end": 23 }
}
EOF
  echo "dd-guard: created default policy at $LIMITS (edit via /doordash-budget)"
fi

# ---------------------------------------------------------------------------
# parse_subtotal <cart-show-output>
# Prints the parsed subtotal, or nothing if unparseable (caller must block).
# ---------------------------------------------------------------------------
parse_subtotal() {
  python3 - "$1" <<'PYEOF'
import re, sys
text = sys.argv[1]
# Prefer an explicitly labeled subtotal; fall back to a labeled total.
for pattern in (r'(?i)\bsub\s*total\b[^0-9$]*\$?\s*([0-9]+(?:\.[0-9]{1,2})?)',
                r'(?i)^\s*total\b[^0-9$]*\$?\s*([0-9]+(?:\.[0-9]{1,2})?)'):
    matches = re.findall(pattern, text, flags=re.M)
    if len(matches) == 1:
        print(matches[0]); sys.exit(0)
    if len(matches) > 1:
        sys.exit(0)  # ambiguous -> unparseable -> caller blocks
sys.exit(0)
PYEOF
}

# ---------------------------------------------------------------------------
# check_policy <subtotal>
# Prints "OK" or "BLOCK <reason>". Reads limits + ledger.
# ---------------------------------------------------------------------------
check_policy() {
  python3 - "$1" "$LIMITS" "$LEDGER" <<'PYEOF'
import json, sys
from datetime import datetime, timedelta

subtotal = float(sys.argv[1])
limits = json.load(open(sys.argv[2]))
now = datetime.now()

entries = []
with open(sys.argv[3]) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            e = json.loads(line)
            e["_ts"] = datetime.fromisoformat(e["ts"])
            entries.append(e)
        except (ValueError, KeyError):
            continue  # tolerate a corrupt line; never crash the gate

spent = [e for e in entries if e.get("status") != "abandoned"]

def total_since(delta):
    cutoff = now - delta
    return sum(e.get("subtotal", 0) for e in spent if e["_ts"] >= cutoff)

hours = limits.get("allowed_hours") or {}
start, end = hours.get("start"), hours.get("end")
if start is not None and end is not None and not (start <= now.hour < end):
    print(f"BLOCK outside allowed hours ({start}:00-{end}:00, now {now.hour}:{now.minute:02d})")
    sys.exit(0)

cooldown = limits.get("cooldown_minutes")
if cooldown and spent:
    last = max(e["_ts"] for e in spent)
    mins = (now - last).total_seconds() / 60
    if mins < cooldown:
        print(f"BLOCK cooldown: last order {mins:.0f} min ago, policy requires {cooldown} min")
        sys.exit(0)

checks = [
    ("per_order_max", subtotal, "this order"),
    ("daily_max", total_since(timedelta(days=1)) + subtotal, "24h total"),
    ("weekly_max", total_since(timedelta(days=7)) + subtotal, "7-day total"),
    ("monthly_max", total_since(timedelta(days=30)) + subtotal, "30-day total"),
]
for key, value, label in checks:
    cap = limits.get(key)
    if cap is not None and value > cap:
        print(f"BLOCK {key}: {label} ${value:.2f} exceeds cap ${cap:.2f}")
        sys.exit(0)

print("OK")
PYEOF
}

ledger_append() {  # <cart_uuid> <subtotal>
  python3 - "$1" "$2" "$LEDGER" <<'PYEOF'
import json, sys
from datetime import datetime
line = {"ts": datetime.now().isoformat(timespec="seconds"),
        "cart_uuid": sys.argv[1], "subtotal": float(sys.argv[2]), "status": "intent"}
with open(sys.argv[3], "a") as f:
    f.write(json.dumps(line) + "\n")
PYEOF
}

price_cart() {  # <cart-uuid> -> sets CART_OUT and SUBTOTAL (may be empty)
  CART_OUT=$(dd-cli cart show --cart-uuid "$1" 2>&1) || {
    echo "dd-guard: 'dd-cli cart show' failed:" >&2
    echo "$CART_OUT" >&2
    exit 3
  }
  SUBTOTAL=$(parse_subtotal "$CART_OUT")
}

cmd="${1:-}"
case "$cmd" in
  status)
    python3 - "$LIMITS" "$LEDGER" <<'PYEOF'
import json, sys
from datetime import datetime, timedelta
limits = json.load(open(sys.argv[1]))
now = datetime.now()
entries = []
with open(sys.argv[2]) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            e = json.loads(line)
            e["_ts"] = datetime.fromisoformat(e["ts"])
            entries.append(e)
        except (ValueError, KeyError):
            continue
spent = [e for e in entries if e.get("status") != "abandoned"]
def total_since(days):
    cutoff = now - timedelta(days=days)
    return sum(e.get("subtotal", 0) for e in spent if e["_ts"] >= cutoff)
rows = [("daily_max", total_since(1)), ("weekly_max", total_since(7)), ("monthly_max", total_since(30))]
print("dd-guard status (pre-fee subtotals; intents included until reconciled)")
for key, used in rows:
    cap = limits.get(key)
    if cap is None:
        print(f"  {key:12s}  no cap  (spent ${used:.2f})")
    else:
        print(f"  {key:12s}  ${used:.2f} / ${cap:.2f}  (${cap - used:.2f} left)")
po = limits.get("per_order_max")
print(f"  per_order_max ${po:.2f}" if po is not None else "  per_order_max  no cap")
print(f"  entries: {len(entries)} ({sum(1 for e in entries if e.get('status')=='intent')} unreconciled intents)")
PYEOF
    ;;

  checkout)
    CART_UUID="${2:-}"
    [ -n "$CART_UUID" ] || { echo "usage: dd-guard checkout <cart-uuid>" >&2; exit 3; }
    price_cart "$CART_UUID"
    if [ -z "$SUBTOTAL" ]; then
      echo "BLOCKED: could not parse a unique subtotal from 'cart show' output." >&2
      echo "Raw output follows — confirm the total with the human before overriding:" >&2
      echo "$CART_OUT" >&2
      exit 2
    fi
    VERDICT=$(check_policy "$SUBTOTAL")
    if [ "$VERDICT" != "OK" ]; then
      echo "BLOCKED by spend policy: ${VERDICT#BLOCK }" >&2
      echo "Adjust the cart (dd-cli cart remove-item) or change policy via /doordash-budget." >&2
      exit 2
    fi
    dd-cli order checkout-url --cart-uuid "$CART_UUID"
    ledger_append "$CART_UUID" "$SUBTOTAL"
    echo "dd-guard: recorded intent \$${SUBTOTAL} for cart ${CART_UUID}" >&2
    ;;

  add-items)
    shift
    [ $# -gt 0 ] || { echo "usage: dd-guard add-items <dd-cli cart add-items args>" >&2; exit 3; }
    dd-cli cart add-items "$@"
    # Re-price against per-order cap when a cart uuid is identifiable.
    CART_UUID=$(printf '%s\n' "$@" | python3 -c 'import sys
args = sys.stdin.read().split("\n")
for i, a in enumerate(args):
    if a == "--cart-uuid" and i + 1 < len(args):
        print(args[i+1]); break')
    if [ -n "$CART_UUID" ]; then
      price_cart "$CART_UUID"
      if [ -n "$SUBTOTAL" ]; then
        VERDICT=$(check_policy "$SUBTOTAL")
        if [ "$VERDICT" != "OK" ]; then
          echo "WARNING: cart now violates policy — ${VERDICT#BLOCK } (checkout will be refused)" >&2
        fi
      fi
    fi
    ;;

  *)
    echo "usage: dd-guard {status | checkout <cart-uuid> | add-items <args...>}" >&2
    exit 3
    ;;
esac
