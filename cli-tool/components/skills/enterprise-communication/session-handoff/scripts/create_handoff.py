#!/usr/bin/env python3
"""
Smart scaffold generator for handoff documents.

Creates a new handoff document with auto-detected metadata:
- Current timestamp
- Project path
- Git branch (if available)
- Recent git log
- Modified/staged files
- Handoff chain linking

Usage:
    python create_handoff.py [task-slug] [--continues-from <previous-handoff>]
    python create_handoff.py "implementing-auth"
    python create_handoff.py "auth-part-2" --continues-from 2024-01-15-auth.md
    python create_handoff.py  # auto-generates slug from timestamp
"""

import argparse
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def run_cmd(cmd: list[str], cwd: str = None) -> tuple[bool, str]:
    """Run a command and return (success, output)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=10
        )
        return result.returncode == 0, result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False, ""


def get_git_info(project_path: str) -> dict:
    """Gather git information from the project."""
    info = {
        "is_git_repo": False,
        "branch": None,
        "recent_commits": [],
        "modified_files": [],
        "staged_files": [],
    }

    # Check if git repo
    success, _ = run_cmd(["git", "rev-parse", "--git-dir"], cwd=project_path)
    if not success:
        return info

    info["is_git_repo"] = True

    # Get current branch
    success, branch = run_cmd(["git", "branch", "--show-current"], cwd=project_path)
    if success and branch:
        info["branch"] = branch

    # Get recent commits (last 5)
    success, log = run_cmd(
        ["git", "log", "--oneline", "-5", "--no-decorate"],
        cwd=project_path
    )
    if success and log:
        info["recent_commits"] = log.split("\n")

    # Get modified files (unstaged)
    success, modified = run_cmd(
        ["git", "diff", "--name-only"],
        cwd=project_path
    )
    if success and modified:
        info["modified_files"] = modified.split("\n")

    # Get staged files
    success, staged = run_cmd(
        ["git", "diff", "--name-only", "--cached"],
        cwd=project_path
    )
    if success and staged:
        info["staged_files"] = staged.split("\n")

    return info


def find_previous_handoffs(project_path: str) -> list[dict]:
    """Find existing handoffs in the project."""
    handoffs_dir = Path(project_path) / ".claude" / "handoffs"
    if not handoffs_dir.exists():
        return []

    handoffs = []
    for filepath in handoffs_dir.glob("*.md"):
        # Extract title from file
        try:
            content = filepath.read_text()
            match = re.search(r'^#\s+(?:Handoff:\s*)?(.+)$', content, re.MULTILINE)
            title = match.group(1).strip() if match else filepath.stem
        except Exception:
            title = filepath.stem

        # Parse date from filename
        date_match = re.match(r'(\d{4}-\d{2}-\d{2})-(\d{6})', filepath.name)
        if date_match:
            try:
                date = datetime.strptime(
                    f"{date_match.group(1)} {date_match.group(2)}",
                    "%Y-%m-%d %H%M%S"
                )
            except ValueError:
                date = None
        else:
            date = None

        handoffs.append({
            "filename": filepath.name,
            "path": str(filepath),
            "title": title,
            "date": date,
        })

    # Sort by date, most recent first
    handoffs.sort(key=lambda x: x["date"] or datetime.min, reverse=True)
    return handoffs


def get_previous_handoff_info(project_path: str, continues_from: str = None) -> dict:
    """Get information about the previous handoff for chaining."""
    handoffs = find_previous_handoffs(project_path)

    if continues_from:
        # Find specific handoff
        for h in handoffs:
            if continues_from in h["filename"]:
                return {
                    "exists": True,
                    "filename": h["filename"],
                    "title": h["title"],
                }
        return {"exists": False, "filename": continues_from, "title": "Not found"}

    elif handoffs:
        # Suggest most recent
        most_recent = handoffs[0]
        return {
            "exists": True,
            "filename": most_recent["filename"],
            "title": most_recent["title"],
            "suggested": True,
        }

    return {"exists": False}


def generate_handoff(
    project_path: str,
    slug: str = None,
    continues_from: str = None
) -> str:
    """Generate a handoff document with pre-filled metadata."""

    # Generate timestamp and filename
    now = datetime.now()
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
    file_timestamp = now.strftime("%Y-%m-%d-%H%M%S")

    if not slug:
        slug = "handoff"

    # Sanitize slug
    slug = slug.lower().replace(" ", "-").replace("_", "-")
    slug = "".join(c for c in slug if c.isalnum() or c == "-")

    filename = f"{file_timestamp}-{slug}.md"

    # Create handoffs directory
    handoffs_dir = Path(project_path) / ".claude" / "handoffs"
    handoffs_dir.mkdir(parents=True, exist_ok=True)

    filepath = handoffs_dir / filename

    # Gather git info
    git_info = get_git_info(project_path)

    # Get previous handoff info for chaining
    prev_handoff = get_previous_handoff_info(project_path, continues_from)

    # Build pre-filled sections
    branch_line = git_info["branch"] if git_info["branch"] else "[not a git repo or detached HEAD]"

    # Recent commits section
    if git_info["recent_commits"]:
        commits_section = "\n".join(f"  - {c}" for c in git_info["recent_commits"])
    else:
        commits_section = "  - [no recent commits or not a git repo]"

    # Modified files section
    all_modified = list(set(git_info["modified_files"] + git_info["staged_files"]))
    if all_modified:
        modified_section = "\n".join(f"| {f} | [describe changes] | [why changed] |" for f in all_modified[:10])
        if len(all_modified) > 10:
            modified_section += f"\n| ... and {len(all_modified) - 10} more files | | |"
    else:
        modified_section = "| [no modified files detected] | | |"

    # Handoff chain section
    if prev_handoff.get("exists"):
        chain_section = f"""## Handoff Chain

- **Continues from**: [{prev_handoff['filename']}](./{prev_handoff['filename']})
  - Previous title: {prev_handoff.get('title', 'Unknown')}
- **Supersedes**: [list any older handoffs this replaces, or "None"]

> Review the previous handoff for full context before filling this one."""
    else:
        chain_section = """## Handoff Chain

- **Continues from**: None (fresh start)
- **Supersedes**: None

> This is the first handoff for this task."""

    # Generate the document
    content = f"""# Handoff: [TASK_TITLE - replace this]

## Session Metadata
- Created: {timestamp}
- Project: {project_path}
- Branch: {branch_line}
- Session duration: [estimate how long you worked]

### Recent Commits (for context)
{commits_section}

{chain_section}

## Current State Summary

[TODO: Write one paragraph describing what was being worked on, current status, and where things left off]

## Codebase Understanding

### Architecture Overview

[TODO: Document key architectural insights discovered during this session]

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| [TODO: Add critical files] | | |

### Key Patterns Discovered

[TODO: Document important patterns, conventions, or idioms found in this codebase]

## Work Completed

### Tasks Finished

- [ ] [TODO: List completed tasks]

### Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
{modified_section}

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| [TODO: Document key decisions] | | |

## Pending Work

### Immediate Next Steps

1. [TODO: Most critical next action]
2. [TODO: Second priority]
3. [TODO: Third priority]

### Blockers/Open Questions

- [ ] [TODO: List any blockers or open questions]

### Deferred Items

- [TODO: Items deferred and why]

## Context for Resuming Agent

### Important Context

[TODO: This is the MOST IMPORTANT section - write critical information the next agent MUST know]

### Assumptions Made

- [TODO: List assumptions made during this session]

### Potential Gotchas

- [TODO: Document things that might trip up a new agent]

## Environment State

### Tools/Services Used

- [TODO: List relevant tools and their configuration]

### Active Processes

- [TODO: Note any running processes, servers, etc.]

### Environment Variables

- [TODO: List relevant env var NAMES only - NEVER include actual values/secrets]

## Related Resources

- [TODO: Add links to relevant docs and files]

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
"""

    # Write the file
    filepath.write_text(content)

    return str(filepath)


def main():
    parser = argparse.ArgumentParser(
        description="Create a new handoff document with smart scaffolding"
    )
    parser.add_argument(
        "slug",
        nargs="?",
        default=None,
        help="Short identifier for the handoff (e.g., 'implementing-auth')"
    )
    parser.add_argument(
        "--continues-from",
        dest="continues_from",
        help="Filename of previous handoff this continues from"
    )

    args = parser.parse_args()

    # Get project path (current working directory)
    project_path = os.getcwd()

    # Check for existing handoffs to suggest chaining
    if not args.continues_from:
        prev_handoffs = find_previous_handoffs(project_path)
        if prev_handoffs:
            print(f"Found {len(prev_handoffs)} existing handoff(s).")
            print(f"Most recent: {prev_handoffs[0]['filename']}")
            print(f"Use --continues-from <filename> to link handoffs.\n")

    # Generate handoff
    filepath = generate_handoff(project_path, args.slug, args.continues_from)

    print(f"Created handoff document: {filepath}")
    print(f"\nNext steps:")
    print(f"1. Open {filepath}")
    print(f"2. Replace [TODO: ...] placeholders with actual content")
    print(f"3. Focus especially on 'Important Context' and 'Immediate Next Steps'")
    print(f"4. Run: python validate_handoff.py {filepath}")
    print(f"   (Checks for completeness and accidental secrets)")

    return filepath


if __name__ == "__main__":
    main()
