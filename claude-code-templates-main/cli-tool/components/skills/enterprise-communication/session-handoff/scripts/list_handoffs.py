#!/usr/bin/env python3
"""
List available handoff documents in the current project.

Searches for handoff documents in .claude/handoffs/ and displays:
- Filename with date
- Title extracted from document
- Status (if marked complete)

Usage:
    python list_handoffs.py           # List handoffs in current project
    python list_handoffs.py /path     # List handoffs in specified path
"""

import os
import re
import sys
from datetime import datetime
from pathlib import Path


def extract_title(filepath: Path) -> str:
    """Extract the title from a handoff document."""
    try:
        content = filepath.read_text()
        # Look for first H1 header
        match = re.search(r'^#\s+(?:Handoff:\s*)?(.+)$', content, re.MULTILINE)
        if match:
            title = match.group(1).strip()
            # Clean up placeholder text
            if title.startswith("[") and title.endswith("]"):
                return "[Untitled - needs completion]"
            return title[:50] + "..." if len(title) > 50 else title
    except Exception:
        pass
    return "[Unable to read title]"


def check_completion_status(filepath: Path) -> str:
    """Check if handoff appears complete or has TODOs remaining."""
    try:
        content = filepath.read_text()
        todo_count = content.count("[TODO:")
        if todo_count == 0:
            return "Complete"
        elif todo_count <= 3:
            return f"In Progress ({todo_count} TODOs)"
        else:
            return f"Needs Work ({todo_count} TODOs)"
    except Exception:
        return "Unknown"


def parse_date_from_filename(filename: str) -> datetime | None:
    """Extract date from filename like 2024-01-15-143022-slug.md"""
    match = re.match(r'(\d{4}-\d{2}-\d{2})-(\d{6})', filename)
    if match:
        try:
            date_str = match.group(1)
            time_str = match.group(2)
            return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H%M%S")
        except ValueError:
            pass
    return None


def list_handoffs(project_path: str) -> list[dict]:
    """List all handoff documents in a project."""
    handoffs_dir = Path(project_path) / ".claude" / "handoffs"

    if not handoffs_dir.exists():
        return []

    handoffs = []
    for filepath in handoffs_dir.glob("*.md"):
        parsed_date = parse_date_from_filename(filepath.name)
        handoffs.append({
            "path": str(filepath),
            "filename": filepath.name,
            "title": extract_title(filepath),
            "status": check_completion_status(filepath),
            "date": parsed_date,
            "size": filepath.stat().st_size,
        })

    # Sort by date, most recent first
    handoffs.sort(key=lambda x: x["date"] or datetime.min, reverse=True)

    return handoffs


def format_date(dt: datetime | None) -> str:
    """Format datetime for display."""
    if dt is None:
        return "Unknown date"
    return dt.strftime("%Y-%m-%d %H:%M")


def main():
    # Get project path
    project_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()

    handoffs = list_handoffs(project_path)

    if not handoffs:
        print(f"No handoffs found in {project_path}/.claude/handoffs/")
        print("\nTo create a handoff, run: python create_handoff.py [task-slug]")
        return

    print(f"Found {len(handoffs)} handoff(s) in {project_path}/.claude/handoffs/\n")
    print("-" * 80)

    for h in handoffs:
        print(f"  Date: {format_date(h['date'])}")
        print(f"  Title: {h['title']}")
        print(f"  Status: {h['status']}")
        print(f"  File: {h['filename']}")
        print("-" * 80)

    print(f"\nTo resume from a handoff, read the document and follow the resume checklist.")
    print(f"Most recent: {handoffs[0]['path']}")


if __name__ == "__main__":
    main()
