#!/usr/bin/env python3
"""Markdown-based task manager for task-execution-engine.

Manages tasks directly in markdown files using checkbox syntax:
- [ ] uncompleted task
- [x] completed task
"""

import argparse
import json
import re
import sys
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Task:
    """Represents a task parsed from markdown."""
    title: str
    status: str  # pending, completed, failed
    priority: int = 5
    phase: str = "implementation"
    dependencies: list = field(default_factory=list)
    files: list = field(default_factory=list)
    criteria: list = field(default_factory=list)
    criteria_status: list = field(default_factory=list)  # True/False for each criterion
    line_number: int = 0
    failure_reason: str = ""


def parse_task_line(line: str) -> Optional[dict]:
    """Parse a task line like: - [ ] **Task Title** `priority:1` `phase:model`"""

    # Match checkbox task
    match = re.match(r'^- \[([ xX])\] \*\*(.+?)\*\*(.*)$', line.strip())
    if not match:
        return None

    checkbox, title, rest = match.groups()
    status = "completed" if checkbox.lower() == 'x' else "pending"

    # Check for failure marker
    if "❌" in rest or "FAILED" in rest:
        status = "failed"

    # Parse inline attributes
    priority = 5
    phase = "implementation"
    dependencies = []

    # Extract priority
    priority_match = re.search(r'`priority:(\d+)`', rest)
    if priority_match:
        priority = int(priority_match.group(1))

    # Extract phase
    phase_match = re.search(r'`phase:(\w+)`', rest)
    if phase_match:
        phase = phase_match.group(1)

    # Extract dependencies
    deps_match = re.search(r'`deps:([^`]+)`', rest)
    if deps_match:
        dependencies = [d.strip() for d in deps_match.group(1).split(',')]

    return {
        "title": title.strip(),
        "status": status,
        "priority": priority,
        "phase": phase,
        "dependencies": dependencies
    }


def parse_tasks_from_markdown(content: str) -> list[Task]:
    """Parse all tasks from markdown content."""

    lines = content.split('\n')
    tasks = []
    current_task = None
    in_task_section = False

    for i, line in enumerate(lines):
        # Check if we're in the Implementation Tasks section
        if re.match(r'^##\s+Implementation\s+Tasks', line, re.IGNORECASE):
            in_task_section = True
            continue

        # Exit task section on next ## header
        if in_task_section and re.match(r'^##\s+[^#]', line) and 'Implementation' not in line:
            in_task_section = False
            continue

        if not in_task_section:
            continue

        # Parse main task line
        task_data = parse_task_line(line)
        if task_data:
            if current_task:
                tasks.append(current_task)

            current_task = Task(
                title=task_data["title"],
                status=task_data["status"],
                priority=task_data["priority"],
                phase=task_data["phase"],
                dependencies=task_data["dependencies"],
                line_number=i + 1
            )
            continue

        # Parse task details (indented lines under a task)
        if current_task and line.strip().startswith('- '):
            stripped = line.strip()

            # Files line
            if stripped.startswith('- files:'):
                files_str = stripped.replace('- files:', '').strip()
                current_task.files = [f.strip() for f in files_str.split(',') if f.strip()]

            # Criterion line (checkbox)
            elif re.match(r'^- \[([ xX])\] ', stripped):
                checkbox_match = re.match(r'^- \[([ xX])\] (.+)$', stripped)
                if checkbox_match:
                    is_done = checkbox_match.group(1).lower() == 'x'
                    criterion = checkbox_match.group(2).strip()
                    current_task.criteria.append(criterion)
                    current_task.criteria_status.append(is_done)

            # Failure reason
            elif stripped.startswith('- reason:') or stripped.startswith('- error:'):
                current_task.failure_reason = stripped.split(':', 1)[1].strip()

    # Don't forget the last task
    if current_task:
        tasks.append(current_task)

    return tasks


def get_next_task(tasks: list[Task]) -> Optional[Task]:
    """Get the next task to execute based on priority and dependencies."""

    completed_titles = {t.title for t in tasks if t.status == "completed"}

    # Find pending tasks with satisfied dependencies
    available = []
    for task in tasks:
        if task.status != "pending":
            continue

        # Check dependencies
        deps_satisfied = all(dep in completed_titles for dep in task.dependencies)
        if deps_satisfied:
            available.append(task)

    if not available:
        return None

    # Sort by priority (lower number = higher priority)
    available.sort(key=lambda t: t.priority)
    return available[0]


def update_task_status(content: str, task_title: str, new_status: str, reason: str = "") -> str:
    """Update a task's status in the markdown content."""

    lines = content.split('\n')
    result = []
    in_target_task = False
    task_indent = 0

    for line in lines:
        # Check if this is the target task
        task_data = parse_task_line(line)
        if task_data and task_data["title"] == task_title:
            in_target_task = True
            task_indent = len(line) - len(line.lstrip())

            # Update the checkbox
            if new_status == "completed":
                line = re.sub(r'^(\s*- )\[[ ]\]', r'\1[x]', line)
                # Add completion marker if not present
                if "✅" not in line:
                    line = line.rstrip() + " ✅"
            elif new_status == "failed":
                line = re.sub(r'^(\s*- )\[[ ]\]', r'\1[x]', line)
                # Add failure marker
                if "❌" not in line:
                    line = line.rstrip() + " ❌"
            elif new_status == "pending":
                line = re.sub(r'^(\s*- )\[[xX]\]', r'\1[ ]', line)
                # Remove markers
                line = line.replace(" ✅", "").replace(" ❌", "")

            result.append(line)
            continue

        # Check if we've moved to a different task
        if task_data and task_data["title"] != task_title:
            in_target_task = False

        # Update criteria checkboxes within the task
        if in_target_task and re.match(r'^\s*- \[[ xX]\] ', line):
            current_indent = len(line) - len(line.lstrip())
            if current_indent > task_indent:
                if new_status == "completed":
                    line = re.sub(r'^(\s*- )\[[ ]\]', r'\1[x]', line)
                elif new_status == "pending":
                    line = re.sub(r'^(\s*- )\[[xX]\]', r'\1[ ]', line)

        result.append(line)

        # Add failure reason after the task line if failed
        if in_target_task and task_data and new_status == "failed" and reason:
            indent = "  " * (task_indent // 2 + 1)
            # Check if next line already has a reason
            result.append(f"{indent}- reason: {reason}")
            in_target_task = False  # Prevent adding reason multiple times

    return '\n'.join(result)


def get_status_summary(tasks: list[Task]) -> dict:
    """Get a summary of task statuses."""

    summary = {
        "total": len(tasks),
        "completed": 0,
        "pending": 0,
        "failed": 0,
        "blocked": 0
    }

    completed_titles = {t.title for t in tasks if t.status == "completed"}

    for task in tasks:
        if task.status == "completed":
            summary["completed"] += 1
        elif task.status == "failed":
            summary["failed"] += 1
        elif task.status == "pending":
            # Check if blocked by dependencies
            deps_satisfied = all(dep in completed_titles for dep in task.dependencies)
            if deps_satisfied:
                summary["pending"] += 1
            else:
                summary["blocked"] += 1

    return summary


def cmd_next(args):
    """Get the next task to execute."""
    content = Path(args.file).read_text()
    tasks = parse_tasks_from_markdown(content)

    next_task = get_next_task(tasks)

    if args.json:
        if next_task:
            print(json.dumps({
                "status": "found",
                "task": asdict(next_task)
            }, indent=2))
        else:
            summary = get_status_summary(tasks)
            print(json.dumps({
                "status": "no_tasks",
                "summary": summary,
                "message": "No pending tasks available"
            }, indent=2))
    else:
        if next_task:
            print(f"Next task: {next_task.title}")
            print(f"Priority: {next_task.priority} | Phase: {next_task.phase}")
            if next_task.files:
                print(f"Files: {', '.join(next_task.files)}")
            if next_task.criteria:
                print("Criteria:")
                for c in next_task.criteria:
                    print(f"  - {c}")
        else:
            print("No pending tasks available")


def cmd_done(args):
    """Mark a task as completed."""
    file_path = Path(args.file)
    content = file_path.read_text()

    updated = update_task_status(content, args.task, "completed")
    file_path.write_text(updated)

    if args.json:
        print(json.dumps({"status": "success", "task": args.task, "new_status": "completed"}))
    else:
        print(f"✅ Marked '{args.task}' as completed")


def cmd_fail(args):
    """Mark a task as failed."""
    file_path = Path(args.file)
    content = file_path.read_text()

    updated = update_task_status(content, args.task, "failed", args.reason or "")
    file_path.write_text(updated)

    if args.json:
        print(json.dumps({"status": "success", "task": args.task, "new_status": "failed", "reason": args.reason}))
    else:
        print(f"❌ Marked '{args.task}' as failed")
        if args.reason:
            print(f"   Reason: {args.reason}")


def cmd_status(args):
    """Show status summary."""
    content = Path(args.file).read_text()
    tasks = parse_tasks_from_markdown(content)
    summary = get_status_summary(tasks)

    if args.json:
        print(json.dumps({
            "file": args.file,
            "summary": summary,
            "tasks": [asdict(t) for t in tasks]
        }, indent=2))
    else:
        total = summary["total"]
        completed = summary["completed"]
        pct = round(completed / total * 100, 1) if total > 0 else 0

        print(f"File: {args.file}")
        print(f"Progress: {completed}/{total} ({pct}%)")
        print()
        print(f"  Completed: {summary['completed']}")
        print(f"  Pending:   {summary['pending']}")
        print(f"  Blocked:   {summary['blocked']}")
        print(f"  Failed:    {summary['failed']}")

        # Show next task
        next_task = get_next_task(tasks)
        if next_task:
            print(f"\nNext: {next_task.title}")


def cmd_list(args):
    """List all tasks."""
    content = Path(args.file).read_text()
    tasks = parse_tasks_from_markdown(content)

    if args.json:
        print(json.dumps([asdict(t) for t in tasks], indent=2))
    else:
        for task in tasks:
            status_icon = {"completed": "✅", "failed": "❌", "pending": "⬜"}.get(task.status, "?")
            print(f"{status_icon} [{task.priority}] {task.title}")


def main():
    parser = argparse.ArgumentParser(description="Markdown task manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # next command
    next_parser = subparsers.add_parser("next", help="Get next task")
    next_parser.add_argument("--file", required=True, help="Markdown file path")
    next_parser.add_argument("--json", action="store_true", help="Output as JSON")
    next_parser.set_defaults(func=cmd_next)

    # done command
    done_parser = subparsers.add_parser("done", help="Mark task as completed")
    done_parser.add_argument("--file", required=True, help="Markdown file path")
    done_parser.add_argument("--task", required=True, help="Task title")
    done_parser.add_argument("--json", action="store_true", help="Output as JSON")
    done_parser.set_defaults(func=cmd_done)

    # fail command
    fail_parser = subparsers.add_parser("fail", help="Mark task as failed")
    fail_parser.add_argument("--file", required=True, help="Markdown file path")
    fail_parser.add_argument("--task", required=True, help="Task title")
    fail_parser.add_argument("--reason", default="", help="Failure reason")
    fail_parser.add_argument("--json", action="store_true", help="Output as JSON")
    fail_parser.set_defaults(func=cmd_fail)

    # status command
    status_parser = subparsers.add_parser("status", help="Show status summary")
    status_parser.add_argument("--file", required=True, help="Markdown file path")
    status_parser.add_argument("--json", action="store_true", help="Output as JSON")
    status_parser.set_defaults(func=cmd_status)

    # list command
    list_parser = subparsers.add_parser("list", help="List all tasks")
    list_parser.add_argument("--file", required=True, help="Markdown file path")
    list_parser.add_argument("--json", action="store_true", help="Output as JSON")
    list_parser.set_defaults(func=cmd_list)

    args = parser.parse_args()

    try:
        args.func(args)
    except FileNotFoundError:
        print(f"Error: File not found: {args.file}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
