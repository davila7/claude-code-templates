#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) — doordash-spend-guard bypass protection.
#
# Blocks (exit 2):
#   1. Raw `dd-cli order checkout-url` / `dd-cli cart add-items` invocations
#      that do not go through the dd-guard.sh wrapper.
#   2. Command-line writes to the dd-guard policy file (limits.json) —
#      policy changes must go through the interactive /doordash-budget command.
#
# Reads the Claude Code hook payload (JSON) on stdin; the Bash command text
# is at .tool_input.command. Allows everything else (exit 0).

set -euo pipefail
command -v python3 >/dev/null 2>&1 || exit 0  # can't inspect -> don't break the session

# Capture the payload BEFORE the heredoc: `python3 -` reads its program from
# stdin, so the payload must travel via argv instead.
PAYLOAD=$(cat || true)

python3 - "$PAYLOAD" <<'PYEOF'
import json, re, sys

try:
    payload = json.loads(sys.argv[1])
except (ValueError, IndexError):
    sys.exit(0)

cmd = (payload.get("tool_input") or {}).get("command") or ""
if not cmd:
    sys.exit(0)

def block(reason):
    print(reason, file=sys.stderr)
    sys.exit(2)

# --- 1. Guarded dd-cli subcommands must go through dd-guard.sh -------------
guarded = re.compile(r'dd-cli\s+(order\s+checkout-url|cart\s+add-items)\b')
if guarded.search(cmd) and "dd-guard.sh" not in cmd:
    block(
        "Blocked by doordash-spend-guard: route this through the wrapper instead —\n"
        "  bash .claude/skills/doordash-spend-guard/scripts/dd-guard.sh checkout <cart-uuid>\n"
        "  bash .claude/skills/doordash-spend-guard/scripts/dd-guard.sh add-items <args...>\n"
        "The wrapper prices the cart and enforces the spending policy deterministically."
    )

# --- 2. Protect the policy file against non-interactive edits --------------
if "limits.json" in cmd and re.search(
    r'(>|>>|\btee\b|\bsed\b.*-i|\bmv\b|\bcp\b|\brm\b|\btruncate\b|\bpython3?\b.*limits\.json)', cmd
):
    block(
        "Blocked by doordash-spend-guard: limits.json is human-edited only.\n"
        "Use the /doordash-budget command to review and change the spending policy interactively."
    )

sys.exit(0)
PYEOF
