#!/usr/bin/env python3
"""
Change Logger Hook
Logs every file mutation (Edit, Write, Bash) to a CSV file for demo prep and session review.
Output: .claude/critical_log_changes.csv
"""

import csv
import json
import os
import sys
from datetime import datetime

# Read-only commands that should not be logged
READONLY_COMMANDS = {
    "cat", "head", "tail", "less", "more",
    "ls", "dir", "tree", "pwd", "which", "where", "whereis",
    "echo", "printf",
    "grep", "rg", "find", "fd", "ag",
    "git status", "git log", "git diff", "git show", "git branch",
    "git remote", "git stash list", "git tag",
    "node -e", "python -c", "ruby -e",
    "type", "file", "wc", "du", "df",
}

CSV_PATH = ".claude/critical_log_changes.csv"
CSV_HEADERS = ["timestamp", "tool", "file_path", "action", "details"]


def is_readonly_command(command):
    """Check if a bash command is read-only and should be skipped."""
    cmd_stripped = command.strip()
    for ro_cmd in READONLY_COMMANDS:
        if cmd_stripped.startswith(ro_cmd):
            return True
    return False


def log_change(tool_name, file_path, action, details=""):
    """Append a row to the CSV change log."""
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)

    write_header = not os.path.exists(CSV_PATH)

    with open(CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        if write_header:
            writer.writerow(CSV_HEADERS)
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            tool_name,
            file_path,
            action,
            details[:200],
        ])


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})

    if tool_name in ("Edit", "MultiEdit"):
        file_path = tool_input.get("file_path", "unknown")
        log_change(tool_name, file_path, "modified")

    elif tool_name == "Write":
        file_path = tool_input.get("file_path", "unknown")
        log_change(tool_name, file_path, "created")

    elif tool_name == "Bash":
        command = tool_input.get("command", "")
        if command and not is_readonly_command(command):
            log_change(tool_name, "-", "executed", command[:200])

    # Never block tool execution
    sys.exit(0)


if __name__ == "__main__":
    main()
