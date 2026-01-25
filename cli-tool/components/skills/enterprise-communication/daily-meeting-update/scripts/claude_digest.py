#!/usr/bin/env python3
"""
Get Claude Code conversation digest for daily standup integration.

Usage:
    claude_digest.py [--date DATE] [--project PATH] [--format json|text]

Examples:
    claude_digest.py                    # Yesterday's digest (default)
    claude_digest.py --date today       # Today's digest
    claude_digest.py --date 2026-01-20  # Specific date
    claude_digest.py --format json      # JSON output for parsing

Output (JSON format):
{
  "date": "2026-01-21",
  "session_count": 5,
  "sessions": [
    {
      "id": "abc123",
      "title": "Fix authentication bug",
      "project": "/home/user/my-app",
      "branch": "main",
      "files": ["auth.ts", "login.vue"],
      "commands_count": 3
    }
  ]
}
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional


@dataclass
class Session:
    """Represents a Claude Code session."""
    id: str
    title: str
    project: str
    branch: Optional[str]
    files: list
    commands_count: int
    timestamp: str


def get_claude_projects_dir() -> Path:
    """Get the Claude projects directory."""
    return Path.home() / '.claude' / 'projects'


def decode_project_path(encoded: str) -> str:
    """Decode encoded project path from directory name."""
    if encoded.startswith('-'):
        return '/' + encoded[1:].replace('-', '/')
    return encoded.replace('-', '/')


def parse_timestamp(timestamp: str) -> Optional[datetime]:
    """Parse ISO timestamp string to datetime."""
    if not timestamp:
        return None
    try:
        if 'T' in timestamp:
            timestamp = timestamp.split('+')[0].split('Z')[0]
            if '.' in timestamp:
                return datetime.strptime(timestamp[:26], '%Y-%m-%dT%H:%M:%S.%f')
            return datetime.strptime(timestamp[:19], '%Y-%m-%dT%H:%M:%S')
        return datetime.strptime(timestamp[:10], '%Y-%m-%d')
    except (ValueError, IndexError):
        return None


def extract_text_content(content) -> str:
    """Extract plain text from message content."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts = []
        for block in content:
            if isinstance(block, dict):
                if block.get('type') == 'text':
                    texts.append(block.get('text', ''))
        return '\n'.join(texts)
    return ''


def extract_tool_uses(content) -> list:
    """Extract tool_use blocks from message content."""
    if not isinstance(content, list):
        return []
    return [
        {'name': block.get('name'), 'input': block.get('input', {})}
        for block in content
        if isinstance(block, dict) and block.get('type') == 'tool_use'
    ]


def parse_session_file(file_path: Path) -> Optional[dict]:
    """Parse a JSONL session file."""
    messages = []
    summary = None
    session_id = file_path.stem
    project_path = decode_project_path(file_path.parent.name)
    git_branch = None
    first_timestamp = None
    first_user_message = None

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                entry_type = entry.get('type')

                if entry_type == 'summary':
                    summary = entry.get('summary')
                    continue

                if entry_type not in ('user', 'assistant'):
                    continue

                if git_branch is None:
                    git_branch = entry.get('gitBranch')

                timestamp = entry.get('timestamp', '')
                if first_timestamp is None:
                    first_timestamp = timestamp

                msg_data = entry.get('message', {})
                content = msg_data.get('content', '')
                text_content = extract_text_content(content)
                tool_uses = extract_tool_uses(content)

                if entry_type == 'user' and first_user_message is None and text_content:
                    # Skip tool results
                    if not text_content.startswith('[') and not text_content.startswith('{'):
                        first_user_message = text_content

                messages.append({
                    'role': entry_type,
                    'content': text_content,
                    'tool_uses': tool_uses
                })

    except Exception as e:
        print(f"Error parsing {file_path.name}: {e}", file=sys.stderr)
        return None

    if not messages:
        return None

    return {
        'session_id': session_id,
        'summary': summary,
        'messages': messages,
        'project_path': project_path,
        'git_branch': git_branch,
        'timestamp': first_timestamp or '',
        'first_user_message': first_user_message
    }


def extract_title(session_data: dict) -> str:
    """Extract a title from session data."""
    if session_data.get('summary'):
        return session_data['summary'][:80]

    if session_data.get('first_user_message'):
        msg = session_data['first_user_message'].strip()
        # Clean up and truncate
        msg = re.sub(r'\s+', ' ', msg)
        if len(msg) > 80:
            return msg[:77] + '...'
        return msg

    return 'Untitled session'


def extract_files(messages: list) -> list:
    """Extract files touched during session."""
    files = set()
    for msg in messages:
        for tool in msg.get('tool_uses', []):
            name = tool.get('name', '')
            inp = tool.get('input', {})

            if name in ('Read', 'Write', 'Edit'):
                path = inp.get('file_path', '')
                if path:
                    files.add(Path(path).name)

    return sorted(files)[:10]


def count_commands(messages: list) -> int:
    """Count bash commands executed."""
    count = 0
    for msg in messages:
        for tool in msg.get('tool_uses', []):
            if tool.get('name') == 'Bash':
                count += 1
    return count


def get_sessions_for_date(
    target_date: datetime,
    project_path: Optional[str] = None
) -> list:
    """Get all sessions for a specific date."""
    sessions = []
    projects_dir = get_claude_projects_dir()

    if not projects_dir.exists():
        return []

    start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    # Get project directories
    if project_path:
        project_path = str(Path(project_path).expanduser().resolve())
        encoded = '-' + project_path[1:].replace('/', '-')
        project_dirs = [projects_dir / encoded] if (projects_dir / encoded).exists() else []
    else:
        project_dirs = [d for d in projects_dir.iterdir() if d.is_dir()]

    for project_dir in project_dirs:
        for jsonl_file in project_dir.glob('*.jsonl'):
            if jsonl_file.name.startswith('agent-'):
                continue

            session_data = parse_session_file(jsonl_file)
            if session_data is None:
                continue

            # Check date range
            session_date = parse_timestamp(session_data['timestamp'])
            if session_date is None:
                continue

            if not (start <= session_date < end):
                continue

            session = Session(
                id=session_data['session_id'][:8],
                title=extract_title(session_data),
                project=session_data['project_path'],
                branch=session_data['git_branch'],
                files=extract_files(session_data['messages']),
                commands_count=count_commands(session_data['messages']),
                timestamp=session_data['timestamp']
            )
            sessions.append(session)

    # Sort by timestamp
    sessions.sort(key=lambda s: s.timestamp)
    return sessions


def parse_date_arg(date_arg: str) -> datetime:
    """Parse date argument."""
    today = datetime.now()

    if date_arg == 'today':
        return today
    elif date_arg == 'yesterday':
        return today - timedelta(days=1)
    else:
        try:
            return datetime.strptime(date_arg, '%Y-%m-%d')
        except ValueError:
            print(f"Invalid date: {date_arg}. Use 'today', 'yesterday', or YYYY-MM-DD", file=sys.stderr)
            sys.exit(1)


def format_text(sessions: list, target_date: datetime) -> str:
    """Format sessions as text."""
    date_str = target_date.strftime('%B %d, %Y')

    if not sessions:
        return f"No sessions found for {date_str}"

    lines = [f"## {date_str} - {len(sessions)} session{'s' if len(sessions) != 1 else ''}", ""]

    for i, s in enumerate(sessions, 1):
        lines.append(f"### {i}. {s.title}")
        lines.append(f"   Session: `{s.id}`")
        if s.branch:
            lines.append(f"   Branch: `{s.branch}`")
        if s.files:
            lines.append(f"   Files: {', '.join(s.files[:5])}")
        if s.commands_count:
            lines.append(f"   Commands: {s.commands_count} executed")
        lines.append("")

    return '\n'.join(lines)


def format_json(sessions: list, target_date: datetime) -> dict:
    """Format sessions as JSON."""
    return {
        'date': target_date.strftime('%Y-%m-%d'),
        'session_count': len(sessions),
        'sessions': [
            {
                'id': s.id,
                'title': s.title,
                'project': s.project,
                'branch': s.branch,
                'files': s.files,
                'commands_count': s.commands_count
            }
            for s in sessions
        ]
    }


def main():
    parser = argparse.ArgumentParser(
        description='Get Claude Code conversation digest for daily standup'
    )
    parser.add_argument('--date', '-d', default='yesterday',
                       help='Date to get digest for (today, yesterday, or YYYY-MM-DD). Default: yesterday')
    parser.add_argument('--project', '-p', help='Filter to specific project path')
    parser.add_argument('--format', '-f', choices=['text', 'json'], default='text',
                       help='Output format (default: text)')

    args = parser.parse_args()

    target_date = parse_date_arg(args.date)
    sessions = get_sessions_for_date(target_date, args.project)

    if args.format == 'json':
        print(json.dumps(format_json(sessions, target_date), indent=2))
    else:
        print(format_text(sessions, target_date))


if __name__ == '__main__':
    main()
