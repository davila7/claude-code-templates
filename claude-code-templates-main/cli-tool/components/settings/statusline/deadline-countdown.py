#!/usr/bin/env python3
"""
Deadline Countdown Statusline
Shows git branch, changed files count, and countdown to deadline.
Color-coded urgency: green >2h, yellow 1-2h, red <1h, blinking <30min.
Configure with DEADLINE_TIME (HH:MM, default 15:30) env var.
"""

import json
import os
import subprocess
import sys
from datetime import datetime


def get_git_info():
    """Get git branch and change count for statusline."""
    try:
        subprocess.check_output(
            ["git", "rev-parse", "--git-dir"], stderr=subprocess.DEVNULL
        )

        branch = (
            subprocess.check_output(
                ["git", "branch", "--show-current"], stderr=subprocess.DEVNULL
            )
            .decode()
            .strip()
        )

        if not branch:
            return ""

        changes = (
            subprocess.check_output(
                ["git", "status", "--porcelain"], stderr=subprocess.DEVNULL
            )
            .decode()
            .splitlines()
        )

        change_count = len(changes)

        if change_count > 0:
            color = "\033[31m"  # Red = dirty
            suffix = f" ({change_count})"
        else:
            color = "\033[32m"  # Green = clean
            suffix = ""

        return f"{color}\u00b7 {branch}{suffix}\033[0m"

    except Exception:
        return ""


def get_countdown():
    """Calculate countdown to deadline with color-coded urgency."""
    deadline_str = os.environ.get("DEADLINE_TIME", "15:30")

    try:
        hour, minute = map(int, deadline_str.split(":"))
    except (ValueError, AttributeError):
        hour, minute = 15, 30

    now = datetime.now()
    deadline = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

    diff = deadline - now
    total_seconds = int(diff.total_seconds())

    reset = "\033[0m"

    if total_seconds <= 0:
        overtime_min = abs(total_seconds) // 60
        return f"\033[31;5m OVERTIME +{overtime_min}m{reset}"

    total_minutes = total_seconds // 60
    hours = total_minutes // 60
    minutes = total_minutes % 60

    # Format time remaining
    if hours > 0:
        time_str = f"{hours}h {minutes}m"
    else:
        time_str = f"{minutes}m"

    # Color coding based on urgency
    if total_minutes > 120:
        color = "\033[32m"  # Green >2h
    elif total_minutes > 60:
        color = "\033[33m"  # Yellow 1-2h
    elif total_minutes > 30:
        color = "\033[31m"  # Red <1h
    else:
        color = "\033[31;5m"  # Blinking red <30min

    return f"{color} {time_str}{reset}"


def main():
    try:
        data = json.load(sys.stdin)

        model_name = data.get("model", {}).get("display_name", "Claude")
        git_info = get_git_info()
        countdown = get_countdown()

        sep = " \033[90m|\033[0m "

        parts = [f"\033[94m[{model_name}]\033[0m"]

        if git_info:
            parts.append(git_info)

        parts.append(countdown)

        print(sep.join(parts))

    except Exception as e:
        print(f"\033[94m[Claude]\033[0m \033[31m[Error: {str(e)[:30]}]\033[0m")


if __name__ == "__main__":
    main()
