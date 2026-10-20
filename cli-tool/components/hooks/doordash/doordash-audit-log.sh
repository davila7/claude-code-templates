#!/usr/bin/env bash
# PostToolUse hook (matcher: Bash) — dd-cli audit logger.
#
# Appends one versioned JSON line per dd-cli / dd-guard invocation to
# ~/.claude/dd-guard/audit.jsonl. Passive observation only: never blocks,
# never modifies anything, exits 0 on every path. Event types are derived
# from the command text itself, so this hook is self-contained.
#
# Line schema (v1):
#   {"v":1, "ts":"...", "session_id":"...", "cwd":"...", "command":"...",
#    "event_type":"search|cart_mutation|checkout_url|history|login|other",
#    "cart_uuid":"...?", "order_uuid":"...?", "exit_ok":true|false|null}

set -uo pipefail   # no -e: a logging hook must never break the session
command -v python3 >/dev/null 2>&1 || exit 0

PAYLOAD=$(cat || true)

python3 - "$PAYLOAD" <<'PYEOF' || true
import json, os, re, sys
from datetime import datetime

try:
    payload = json.loads(sys.argv[1])
except (ValueError, IndexError):
    sys.exit(0)

cmd = (payload.get("tool_input") or {}).get("command") or ""
if "dd-cli" not in cmd and "dd-guard" not in cmd:
    sys.exit(0)

# Strip obvious secrets before persisting (tokens, bearer headers, env vars).
clean = re.sub(r'(?i)(--?(?:token|api-?key|password|secret)[=\s]+)\S+', r'\1***', cmd)
clean = re.sub(r'(?i)(authorization:\s*bearer\s+)\S+', r'\1***', clean)
clean = re.sub(r'\b([A-Z_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Z_]*)=\S+', r'\1=***', clean)

def classify(c):
    if re.search(r'dd-cli\s+search\b', c): return "search"
    if re.search(r'dd-cli\s+cart\s+(add-items|remove-item)\b|dd-guard\.sh\s+add-items\b', c): return "cart_mutation"
    if re.search(r'dd-cli\s+order\s+checkout-url\b|dd-guard\.sh\s+checkout\b', c): return "checkout_url"
    if re.search(r'dd-cli\s+order\s+(history|reorder)\b', c): return "history"
    if re.search(r'dd-cli\s+login\b', c): return "login"
    return "other"

def find(pattern, c):
    m = re.search(pattern, c)
    return m.group(1) if m else None

response = payload.get("tool_response") or {}
exit_ok = None
if isinstance(response, dict):
    if "exit_code" in response:
        exit_ok = response.get("exit_code") == 0
    elif "success" in response:
        exit_ok = bool(response.get("success"))

line = {
    "v": 1,
    "ts": datetime.now().isoformat(timespec="seconds"),
    "session_id": payload.get("session_id") or "",
    "cwd": payload.get("cwd") or "",
    "command": clean[:500],
    "event_type": classify(cmd),
    "cart_uuid": find(r'--cart-uuid[=\s]+([A-Za-z0-9-]+)', cmd)
                 or find(r'dd-guard\.sh\s+checkout\s+([A-Za-z0-9-]+)', cmd),
    "order_uuid": find(r'--order-uuid[=\s]+([A-Za-z0-9-]+)', cmd),
    "exit_ok": exit_ok,
}

audit = os.path.expanduser(os.environ.get("DD_AUDIT_FILE", "~/.claude/dd-guard/audit.jsonl"))
os.makedirs(os.path.dirname(audit), exist_ok=True)
with open(audit, "a") as f:
    f.write(json.dumps(line) + "\n")

sys.exit(0)
PYEOF
exit 0
