#!/usr/bin/env python3
"""
ccx Handoff Statusline for Claude Code

Displays: model | Claude usage | Codex usage | link to Codex

For people who switch between Claude Code and Codex on the same task with
ccx (https://github.com/aaronwong1999/ccx, macOS). It asks the ccx command for
two things and prints one line:

- `ccx usage --json`: how much of Claude's and Codex's current window is used.
  Claude's comes from Claude Code's own `rate_limits` on stdin when present.
- `ccx info <session_id> --json`: whether this conversation is linked to a
  Codex thread, and whether it has progress Codex hasn't picked up yet.

When Claude is near its limit the line suggests /to-codex. Without ccx it
shows the model and a short install hint. Nothing is written to disk and
nothing goes over the network; each ccx call has a 2-second timeout.

Example output:
  🤖 Fable 5.1 | Claude 🟢 42% | Codex 🟢 18% | ⇄ linked
  🤖 Fable 5.1 | Claude 🔴 93% → /to-codex | Codex 🟢 18% | ⇄ Codex hasn't seen the latest
  🤖 Fable 5.1 | Claude 🟢 12% | Codex 🟡 81% | not linked to Codex
"""

import json
import os
import shutil
import subprocess
import sys


def find_ccx():
    """Return the ccx command path, or None when ccx is not installed."""
    found = shutil.which("ccx")
    if found:
        return found
    default = os.path.expanduser("~/.local/bin/ccx")
    return default if os.access(default, os.X_OK) else None


def run_ccx(ccx, *args):
    """Run ccx with --json and return the parsed object, or None on failure."""
    try:
        out = subprocess.check_output(
            [ccx, *args, "--json"], stderr=subprocess.DEVNULL, timeout=2
        )
        return json.loads(out.decode("utf-8", errors="replace"))
    except Exception:
        return None


def level_icon(pct):
    """Green below 70%, yellow below 90%, red from 90%."""
    if pct >= 90:
        return "🔴"
    if pct >= 70:
        return "🟡"
    return "🟢"


def claude_percent(data, usage):
    """Claude's 5-hour usage: Claude Code's stdin first, then ccx's reading."""
    five = (data.get("rate_limits") or {}).get("five_hour") or {}
    pct = five.get("used_percentage")
    if isinstance(pct, (int, float)):
        return pct
    pct = ((usage or {}).get("claude") or {}).get("used_percentage")
    return pct if isinstance(pct, (int, float)) else None


def codex_percent(usage):
    pct = ((usage or {}).get("codex") or {}).get("used_percentage")
    return pct if isinstance(pct, (int, float)) else None


def link_segment(info):
    """Describe this conversation's link to Codex from `ccx info`."""
    if not info:
        return None
    status = info.get("status")
    if status == "updated":
        return "⇄ Codex hasn't seen the latest"
    if status == "linked":
        return "⇄ linked"
    if status == "new":
        return "not linked to Codex"
    return None


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}

    model = (data.get("model") or {}).get("display_name") or "Claude"
    parts = [f"🤖 {model}"]

    ccx = find_ccx()
    if not ccx:
        parts.append("ccx not installed (github.com/aaronwong1999/ccx)")
        print(" | ".join(parts))
        return

    usage = run_ccx(ccx, "usage")
    claude = claude_percent(data, usage)
    if claude is not None:
        segment = f"Claude {level_icon(claude)} {claude:.0f}%"
        if claude >= 90:
            segment += " → /to-codex"
        parts.append(segment)
    codex = codex_percent(usage)
    if codex is not None:
        parts.append(f"Codex {level_icon(codex)} {codex:.0f}%")

    session_id = data.get("session_id")
    if session_id:
        link = link_segment(run_ccx(ccx, "info", session_id))
        if link:
            parts.append(link)

    print(" | ".join(parts))


if __name__ == "__main__":
    main()
