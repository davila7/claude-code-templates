#!/usr/bin/env python3
"""
Git pre-push hook: Telegram notification on push.

Sends a Telegram message every time code is pushed to the remote,
regardless of the tool used (CLI, VS Code, Claude Code, GitHub Desktop, etc.).

Reads stdin lines provided by Git's pre-push hook protocol:
  <local_ref> <local_sha> <remote_ref> <remote_sha>

Required environment variables:
  TELEGRAM_BOT_TOKEN  - Bot token from @BotFather
  TELEGRAM_CHAT_ID    - Chat ID for notifications
"""

import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request


def get_repo_slug():
    """Extract owner/repo from the git remote URL."""
    try:
        url = subprocess.check_output(
            ["git", "remote", "get-url", "origin"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except Exception:
        return None

    # Match SSH or HTTPS patterns
    match = re.search(r"[/:]([^/:]+/[^/.]+?)(?:\.git)?$", url)
    return match.group(1) if match else None


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


def get_commit_summary(remote_sha, local_sha):
    """Get a short summary of the commits being pushed."""
    try:
        if remote_sha == "0" * 40:
            # New branch, show last 5 commits
            log_range = f"-5 {local_sha}"
        else:
            log_range = f"{remote_sha}..{local_sha}"

        output = subprocess.check_output(
            ["git", "log", "--oneline", "--no-decorate"] + log_range.split(),
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        return output
    except Exception:
        return None


def send_telegram(message):
    """Send a message via Telegram Bot API."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    if not token or not chat_id:
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
        print(f"Telegram notification failed: {e}", file=sys.stderr)
        return False


def main():
    branch = get_branch_name()
    repo_slug = get_repo_slug()

    # Parse stdin from Git pre-push protocol
    pushed_refs = []
    for line in sys.stdin:
        parts = line.strip().split()
        if len(parts) >= 4:
            pushed_refs.append(
                {
                    "local_ref": parts[0],
                    "local_sha": parts[1],
                    "remote_ref": parts[2],
                    "remote_sha": parts[3],
                }
            )

    if not pushed_refs:
        sys.exit(0)

    ref = pushed_refs[0]
    remote_sha = ref["remote_sha"]
    local_sha = ref["local_sha"]
    is_new_branch = remote_sha == "0" * 40

    # Build commit summary
    commits = get_commit_summary(remote_sha, local_sha)
    commit_lines = commits.splitlines() if commits else []
    commit_count = len(commit_lines)

    # Build message
    icon = "🆕" if is_new_branch else "📤"
    action = "New branch pushed" if is_new_branch else "Code pushed"

    lines = [
        f"<b>{icon} {action}</b>",
        "",
    ]

    if repo_slug:
        lines.append(f"<b>Repo:</b> <code>{repo_slug}</code>")

    if branch:
        lines.append(f"<b>Branch:</b> <code>{branch}</code>")

    if commit_count > 0:
        lines.append(f"<b>Commits:</b> {commit_count}")
        lines.append("")
        # Show up to 5 commits
        for c in commit_lines[:5]:
            lines.append(f"  <code>{c}</code>")
        if commit_count > 5:
            lines.append(f"  ... and {commit_count - 5} more")

    if repo_slug and branch:
        pr_url = f"https://github.com/{repo_slug}/compare/{branch}?expand=1"
        lines.append("")
        lines.append(f'<a href="{pr_url}">Create Pull Request</a>')

    message = "\n".join(lines)
    send_telegram(message)

    # Always allow the push to proceed
    sys.exit(0)


if __name__ == "__main__":
    main()
