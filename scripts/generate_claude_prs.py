#!/usr/bin/env python3
"""
Generate Claude Code PRs data.

Fetches all PRs from the GitHub API that were created from branches
starting with 'claude/' and writes a static JSON file for the dashboard.

Usage:
    python scripts/generate_claude_prs.py

Optionally set GITHUB_TOKEN env var to avoid rate limits.
"""

import json
import os
import requests
import time
from datetime import datetime, timezone

REPO = "davila7/claude-code-templates"
API_URL = f"https://api.github.com/repos/{REPO}/pulls"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "docs", "claude-prs", "data.json")


def fetch_prs(state="all", token=None):
    """Fetch all PRs with pagination."""
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    all_prs = []
    page = 1

    while True:
        url = f"{API_URL}?state={state}&per_page=100&page={page}&sort=created&direction=desc"
        print(f"  Fetching page {page}...")

        for attempt in range(3):
            try:
                resp = requests.get(url, headers=headers, timeout=30)
                break
            except requests.exceptions.RequestException as e:
                if attempt < 2:
                    wait = 2 ** (attempt + 1)
                    print(f"  Retry in {wait}s: {e}")
                    time.sleep(wait)
                else:
                    raise

        if resp.status_code == 403:
            print(f"  Rate limited. Set GITHUB_TOKEN env var to increase limits.")
            break

        if resp.status_code != 200:
            print(f"  Error {resp.status_code}: {resp.text[:200]}")
            break

        data = resp.json()
        if not data:
            break

        all_prs.extend(data)
        page += 1

        if len(data) < 100:
            break

    return all_prs


def is_claude_pr(pr):
    """Check if a PR was created by Claude Code (branch starts with claude/)."""
    ref = pr.get("head", {}).get("ref", "")
    return ref.startswith("claude/")


def extract_pr_data(pr):
    """Extract only the fields needed for the dashboard."""
    return {
        "number": pr["number"],
        "title": pr["title"],
        "state": pr["state"],
        "merged": pr.get("merged_at") is not None,
        "branch": pr["head"]["ref"],
        "created_at": pr["created_at"],
        "merged_at": pr.get("merged_at"),
        "closed_at": pr.get("closed_at"),
        "url": pr["html_url"],
        "user": pr.get("user", {}).get("login", "unknown"),
    }


def main():
    print("Generating Claude Code PRs data...")

    token = os.environ.get("GITHUB_TOKEN")
    if token:
        print("  Using GITHUB_TOKEN for authentication")
    else:
        print("  No GITHUB_TOKEN set (60 req/hr limit). Set it to avoid rate limits.")

    all_prs = fetch_prs(token=token)
    print(f"  Total PRs fetched: {len(all_prs)}")

    claude_prs = [extract_pr_data(pr) for pr in all_prs if is_claude_pr(pr)]
    print(f"  Claude Code PRs found: {len(claude_prs)}")

    # Sort by creation date descending
    claude_prs.sort(key=lambda p: p["created_at"], reverse=True)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repo": REPO,
        "total": len(claude_prs),
        "prs": claude_prs,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"  Written to {OUTPUT_FILE}")
    print("Done.")


if __name__ == "__main__":
    main()
