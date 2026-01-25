#!/usr/bin/env python3
"""
Check staleness of a handoff document compared to current project state.

Analyzes:
- Time since handoff was created
- Git commits since handoff
- Files that changed since handoff
- Branch divergence
- Modified files status

Usage:
    python check_staleness.py <handoff-file>
    python check_staleness.py .claude/handoffs/2024-01-15-143022-auth.md
"""

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


def parse_handoff_metadata(filepath: str) -> dict:
    """Extract metadata from a handoff file."""
    content = Path(filepath).read_text()
    metadata = {
        "created": None,
        "branch": None,
        "project_path": None,
        "modified_files": [],
    }

    # Parse Created timestamp
    match = re.search(r'Created:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})', content)
    if match:
        try:
            metadata["created"] = datetime.strptime(match.group(1), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass

    # Parse Branch
    match = re.search(r'Branch:\s*(\S+)', content)
    if match:
        branch = match.group(1)
        if branch and not branch.startswith('['):
            metadata["branch"] = branch

    # Parse Project path
    match = re.search(r'Project:\s*(.+?)(?:\n|$)', content)
    if match:
        metadata["project_path"] = match.group(1).strip()

    # Parse modified files from table
    table_matches = re.findall(r'\|\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)\s*\|', content)
    for f in table_matches:
        if '/' in f and not f.startswith('['):
            metadata["modified_files"].append(f)

    return metadata


def get_commits_since(timestamp: datetime, project_path: str) -> list[str]:
    """Get list of commits since a given timestamp."""
    if not timestamp:
        return []

    iso_time = timestamp.strftime("%Y-%m-%dT%H:%M:%S")
    success, output = run_cmd(
        ["git", "log", f"--since={iso_time}", "--oneline", "--no-decorate"],
        cwd=project_path
    )

    if success and output:
        return output.split("\n")
    return []


def get_current_branch(project_path: str) -> str | None:
    """Get current git branch."""
    success, branch = run_cmd(
        ["git", "branch", "--show-current"],
        cwd=project_path
    )
    return branch if success else None


def get_changed_files_since(timestamp: datetime, project_path: str) -> list[str]:
    """Get files that changed since timestamp."""
    if not timestamp:
        return []

    iso_time = timestamp.strftime("%Y-%m-%dT%H:%M:%S")
    success, output = run_cmd(
        ["git", "diff", "--name-only", f"--since={iso_time}", "HEAD"],
        cwd=project_path
    )

    # Fallback: get files changed in commits since timestamp
    if not output:
        success, output = run_cmd(
            ["git", "log", f"--since={iso_time}", "--name-only", "--pretty=format:"],
            cwd=project_path
        )

    if success and output:
        files = [f.strip() for f in output.split("\n") if f.strip()]
        return list(set(files))  # Deduplicate
    return []


def check_files_exist(files: list[str], project_path: str) -> tuple[list[str], list[str]]:
    """Check which files from handoff still exist."""
    existing = []
    missing = []

    for f in files:
        full_path = Path(project_path) / f
        if full_path.exists():
            existing.append(f)
        else:
            missing.append(f)

    return existing, missing


def calculate_staleness_level(
    days_old: float,
    commits_since: int,
    files_changed: int,
    branch_matches: bool,
    files_missing: int
) -> tuple[str, str, list[str]]:
    """Calculate staleness level and provide recommendations.

    Staleness scoring rationale:
    - Each factor adds 1-3 points based on severity
    - Thresholds based on typical development patterns:
      - Age: 1 day (active work), 7 days (sprint), 30 days (stale)
      - Commits: 5 (minor changes), 20 (feature work), 50 (major changes)
      - Files: 5 (localized), 20 (widespread changes)
    - Final score: 0=FRESH, 1-2=SLIGHTLY_STALE, 3-4=STALE, 5+=VERY_STALE
    """
    issues = []

    # Scoring
    staleness_score = 0

    # Age thresholds: 1 day = active, 7 days = sprint boundary, 30 days = likely stale
    if days_old > 30:
        staleness_score += 3  # Over a month: high risk of outdated context
        issues.append(f"Handoff is {int(days_old)} days old")
    elif days_old > 7:
        staleness_score += 2  # Over a week: moderate staleness
        issues.append(f"Handoff is {int(days_old)} days old")
    elif days_old > 1:
        staleness_score += 1  # Over a day: minor staleness

    # Commit thresholds: 5 = routine, 20 = feature work, 50 = major development
    if commits_since > 50:
        staleness_score += 3  # Major changes likely invalidate handoff context
        issues.append(f"{commits_since} commits since handoff - significant changes")
    elif commits_since > 20:
        staleness_score += 2  # Substantial work done since handoff
        issues.append(f"{commits_since} commits since handoff")
    elif commits_since > 5:
        staleness_score += 1  # Some changes, worth reviewing

    # Branch mismatch: likely working on different feature/context
    if not branch_matches:
        staleness_score += 2  # Different branch = different context
        issues.append("Current branch differs from handoff branch")

    # Missing files: 5+ suggests significant restructuring
    if files_missing > 5:
        staleness_score += 2  # Many refs broken = codebase restructured
        issues.append(f"{files_missing} referenced files no longer exist")
    elif files_missing > 0:
        staleness_score += 1  # Some refs broken
        issues.append(f"{files_missing} referenced file(s) missing")

    # Changed files: 5 = localized, 20 = widespread
    if files_changed > 20:
        staleness_score += 2  # Widespread changes affect handoff relevance
        issues.append(f"{files_changed} files changed since handoff")
    elif files_changed > 5:
        staleness_score += 1  # Some files changed

    # Staleness levels: 0=fresh, 1-2=slight, 3-4=stale, 5+=very stale
    if staleness_score == 0:
        level = "FRESH"
        recommendation = "Safe to resume - minimal changes since handoff"
    elif staleness_score <= 2:
        level = "SLIGHTLY_STALE"
        recommendation = "Generally safe to resume - review changes before continuing"
    elif staleness_score <= 4:
        level = "STALE"
        recommendation = "Proceed with caution - significant changes may affect context"
    else:
        level = "VERY_STALE"
        recommendation = "Consider creating new handoff - too many changes since original"

    return level, recommendation, issues


def check_staleness(handoff_path: str) -> dict:
    """Run staleness check on a handoff file."""
    path = Path(handoff_path)

    if not path.exists():
        return {"error": f"Handoff file not found: {handoff_path}"}

    # Parse handoff
    metadata = parse_handoff_metadata(handoff_path)

    # Determine project path
    project_path = metadata.get("project_path")
    if not project_path or not Path(project_path).exists():
        # Fallback: assume handoff is in .claude/handoffs/ within project
        project_path = str(path.parent.parent.parent)

    # Check if git repo
    success, _ = run_cmd(["git", "rev-parse", "--git-dir"], cwd=project_path)
    is_git_repo = success

    result = {
        "handoff_file": str(path),
        "project_path": project_path,
        "is_git_repo": is_git_repo,
        "created": metadata["created"],
        "handoff_branch": metadata["branch"],
    }

    # Calculate age
    if metadata["created"]:
        age = datetime.now() - metadata["created"]
        result["days_old"] = age.total_seconds() / 86400
        result["hours_old"] = age.total_seconds() / 3600
    else:
        result["days_old"] = None
        result["hours_old"] = None

    if is_git_repo:
        # Git-based checks
        result["current_branch"] = get_current_branch(project_path)
        result["branch_matches"] = (
            result["current_branch"] == metadata["branch"]
            if metadata["branch"] else True
        )

        commits = get_commits_since(metadata["created"], project_path)
        result["commits_since"] = len(commits)
        result["recent_commits"] = commits[:5]  # Show first 5

        changed_files = get_changed_files_since(metadata["created"], project_path)
        result["files_changed_count"] = len(changed_files)
        result["files_changed"] = changed_files[:10]  # Show first 10

        # Check if handoff's modified files still exist
        existing, missing = check_files_exist(metadata["modified_files"], project_path)
        result["referenced_files_exist"] = len(existing)
        result["referenced_files_missing"] = missing

        # Calculate staleness
        level, recommendation, issues = calculate_staleness_level(
            result.get("days_old", 0) or 0,
            result["commits_since"],
            result["files_changed_count"],
            result["branch_matches"],
            len(missing)
        )
        result["staleness_level"] = level
        result["recommendation"] = recommendation
        result["issues"] = issues
    else:
        # Non-git checks (limited)
        result["staleness_level"] = "UNKNOWN"
        result["recommendation"] = "Not a git repo - unable to detect changes"
        result["issues"] = ["Project is not a git repository"]

    return result


def print_report(result: dict):
    """Print staleness report."""
    if "error" in result:
        print(f"Error: {result['error']}")
        return

    print(f"\n{'='*60}")
    print(f"Handoff Staleness Report")
    print(f"{'='*60}")
    print(f"File: {result['handoff_file']}")
    print(f"Project: {result['project_path']}")

    if result["created"]:
        print(f"Created: {result['created'].strftime('%Y-%m-%d %H:%M:%S')}")
        if result["days_old"] is not None:
            if result["days_old"] < 1:
                print(f"Age: {result['hours_old']:.1f} hours")
            else:
                print(f"Age: {result['days_old']:.1f} days")

    print(f"\n{'='*60}")
    print(f"Staleness Level: {result['staleness_level']}")
    print(f"{'='*60}")
    print(f"\nRecommendation: {result['recommendation']}")

    if result.get("issues"):
        print(f"\nIssues detected:")
        for issue in result["issues"]:
            print(f"  - {issue}")

    if result.get("is_git_repo"):
        print(f"\n--- Git Status ---")
        print(f"Handoff branch: {result.get('handoff_branch', 'Unknown')}")
        print(f"Current branch: {result.get('current_branch', 'Unknown')}")
        print(f"Branch matches: {'Yes' if result.get('branch_matches') else 'No'}")
        print(f"Commits since handoff: {result.get('commits_since', 0)}")
        print(f"Files changed: {result.get('files_changed_count', 0)}")

        if result.get("recent_commits"):
            print(f"\nRecent commits:")
            for commit in result["recent_commits"][:5]:
                print(f"  {commit}")

        if result.get("referenced_files_missing"):
            print(f"\nMissing referenced files:")
            for f in result["referenced_files_missing"][:5]:
                print(f"  - {f}")

    print(f"\n{'='*60}")

    # Color-coded verdict (using text indicators)
    level = result.get("staleness_level", "UNKNOWN")
    if level == "FRESH":
        print("Verdict: [OK] Safe to resume")
    elif level == "SLIGHTLY_STALE":
        print("Verdict: [OK] Review changes, then resume")
    elif level == "STALE":
        print("Verdict: [CAUTION] Verify context before resuming")
    elif level == "VERY_STALE":
        print("Verdict: [WARNING] Consider creating fresh handoff")
    else:
        print("Verdict: [UNKNOWN] Manual verification needed")


def main():
    if len(sys.argv) < 2:
        print("Usage: python check_staleness.py <handoff-file>")
        print("Example: python check_staleness.py .claude/handoffs/2024-01-15-auth.md")
        sys.exit(1)

    handoff_path = sys.argv[1]
    result = check_staleness(handoff_path)
    print_report(result)

    # Exit code based on staleness
    level = result.get("staleness_level", "UNKNOWN")
    if level in ["FRESH", "SLIGHTLY_STALE"]:
        sys.exit(0)
    elif level == "STALE":
        sys.exit(1)
    else:
        sys.exit(2)


if __name__ == "__main__":
    main()
