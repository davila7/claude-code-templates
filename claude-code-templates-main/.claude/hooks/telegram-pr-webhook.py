#!/usr/bin/env python3
"""
Telegram PR Webhook Hook
Sends a Telegram notification when a new PR is created via `gh pr create`.
Includes the PR URL and the Vercel preview URL.

Required environment variables:
  TELEGRAM_BOT_TOKEN  - Bot token from @BotFather
  TELEGRAM_CHAT_ID    - Chat ID for notifications

Optional environment variables:
  VERCEL_PROJECT_NAME - Vercel project name (for preview URL)
  VERCEL_TEAM_SLUG    - Vercel team slug (for preview URL)
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.parse


def get_input():
    try:
        return json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return {}


def extract_pr_url(text):
    """Extract GitHub PR URL from command output."""
    match = re.search(r"https://github\.com/[^\s]+/pull/\d+", text)
    return match.group(0) if match else None


def get_branch_name():
    """Get the current git branch name."""
    try:
        return subprocess.check_output(
            ["git", "branch", "--show-current"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except Exception:
        return None


def build_vercel_preview_url(branch):
    """Build Vercel preview URL from branch name and env vars."""
    project = os.environ.get("VERCEL_PROJECT_NAME", "")
    team = os.environ.get("VERCEL_TEAM_SLUG", "")

    if not project or not team:
        return None

    # Vercel slugifies branch names: lowercase, replace non-alphanumeric with -
    slug = re.sub(r"[^a-z0-9]+", "-", branch.lower()).strip("-")
    return f"https://{project}-git-{slug}-{team}.vercel.app"


def send_telegram(message):
    """Send a message via Telegram Bot API."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    if not token or not chat_id:
        print(
            "Telegram notification skipped: "
            "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID",
            file=sys.stderr,
        )
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode(
        {"chat_id": chat_id, "text": message, "parse_mode": "HTML"}
    ).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=data, method="POST")
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception as e:
        print(f"Failed to send Telegram notification: {e}", file=sys.stderr)
        return False


def main():
    input_data = get_input()

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    # Only act on gh pr create commands
    if tool_name != "Bash" or "gh pr create" not in command:
        sys.exit(0)

    # Extract PR URL from tool response
    tool_response = input_data.get("tool_response", "")
    if isinstance(tool_response, dict):
        tool_response = tool_response.get("stdout", "") or json.dumps(tool_response)

    pr_url = extract_pr_url(str(tool_response))
    if not pr_url:
        # No PR URL found — the command may have failed
        sys.exit(0)

    # Build Vercel preview URL
    branch = get_branch_name()
    vercel_url = build_vercel_preview_url(branch) if branch else None

    # Compose Telegram message
    lines = [
        "<b>New Pull Request Created</b>",
        "",
        f"<b>PR:</b> <a href=\"{pr_url}\">{pr_url}</a>",
    ]

    if vercel_url:
        lines.append(f"<b>Preview:</b> <a href=\"{vercel_url}\">{vercel_url}</a>")
    else:
        lines.append(
            "<b>Preview:</b> Check the PR checks tab for the Vercel deployment URL"
        )

    if branch:
        lines.append(f"<b>Branch:</b> <code>{branch}</code>")

    message = "\n".join(lines)
    send_telegram(message)


if __name__ == "__main__":
    main()
