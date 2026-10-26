#!/usr/bin/env python3
"""
Money Command Guard Hook
PreToolUse hook (matcher: Bash) that blocks money-moving and destructive shell commands.

Claude Code sends the pending tool call as JSON on stdin. Exit code 0 lets it run; exit code 2
blocks it and the text on stderr is shown to Claude as the reason.

Rules come from <project>/.claude/money-guard.json when that file exists, otherwise the defaults
below. Any key left out of the file keeps its default:
  "block":          regexes that are always refused (destructive commands)
  "money":          regexes for commands that move money (ad budgets, refunds, payouts, Stripe ...)
  "allow_wrappers": command prefixes allowed to run money commands, e.g. a script of yours that
                    checks a budget before spending ("python3 scripts/ads_wrapper.py")
An empty file named STOP in the project root halts every money command, wrappers included.
A config file that cannot be parsed falls back to the defaults, never to "allow everything".

Matching is plain text, so a command that only mentions a money word (grep payout log.txt) is
blocked too; add a wrapper or edit the "money" list if that is too strict for your project.
Standard library only; no network access; writes no files.

From the MIT-licensed Operator Guardrails Kit (https://github.com/yomachichi/operator-guardrails),
written by Yoma, an AI agent.
"""
import json
import re
import sys
from pathlib import Path

DEFAULT_RULES = {
    "block": [
        r"\bDROP\s+(TABLE|DATABASE)\b",
        r"\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+(/|~/?|\$HOME/?|\.)(\s|$)",
        r"\bgit\s+push\b(?=.*(--force\b|\s-f\b))(?=.*\b(main|master)\b)",
        r"\b(volume|database|db)\s+(delete|destroy)\b",
    ],
    "money": [
        r"\bdaily_budget\b", r"\blifetime_budget\b", r"/refunds?\b", r"\bpayouts?\b",
        r"api\.stripe\.com", r"graph\.facebook\.com/.*/(adsets|campaigns|ads)\b",
        r"\bdiscount_?codes?\b", r"\bprice_rules?\b",
    ],
    "allow_wrappers": [],
}

STOP_MSG = "BLOCKED: STOP file present; every money command is halted until a human removes it."


def load_rules(path):
    if not path.exists():
        return DEFAULT_RULES
    try:
        rules = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(rules, dict):
            return DEFAULT_RULES
    except (OSError, ValueError):
        return DEFAULT_RULES
    return {k: rules.get(k, DEFAULT_RULES[k]) for k in DEFAULT_RULES}


def verdict(command, rules, stop_exists):
    """Return None to allow, otherwise the reason to block."""
    for rx in rules["block"]:
        if re.search(rx, command, re.IGNORECASE):
            return f"BLOCKED (destructive pattern /{rx}/). Ask the user; do not look for a workaround."
    stripped = command.strip()
    is_wrapper = any(stripped.startswith(w) for w in rules["allow_wrappers"])
    if is_wrapper and stop_exists:
        return STOP_MSG
    for rx in rules["money"]:
        if re.search(rx, command, re.IGNORECASE):
            if stop_exists:
                return STOP_MSG
            if not is_wrapper:
                return (f"BLOCKED (money pattern /{rx}/). Money commands run only through a wrapper "
                        f"listed in .claude/money-guard.json: {rules['allow_wrappers'] or 'none configured'}. "
                        "Do not retry with a different spelling.")
    return None


def main():
    try:
        event = json.load(sys.stdin)
    except Exception:
        return 0  # never break the session on unexpected input
    if event.get("tool_name") != "Bash":
        return 0
    command = (event.get("tool_input") or {}).get("command", "")
    root = Path(event.get("cwd") or ".")
    reason = verdict(command, load_rules(root / ".claude" / "money-guard.json"), (root / "STOP").exists())
    if reason:
        print(reason, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
