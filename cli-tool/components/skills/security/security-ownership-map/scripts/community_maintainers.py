#!/usr/bin/env python3
"""Report monthly maintainers for a file's community."""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compute maintainers for a file's community over time."
    )
    parser.add_argument(
        "--data-dir",
        default="ownership-map-out",
        help="Directory containing graph outputs",
    )
    parser.add_argument(
        "--repo",
        default=None,
        help="Git repo path (required if commits.jsonl is missing)",
    )
    parser.add_argument(
        "--file",
        default=None,
        help="File path (exact or substring) to locate community",
    )
    parser.add_argument(
        "--community-id",
        type=int,
        default=None,
        help="Community id to analyze",
    )
    parser.add_argument(
        "--since",
        default=None,
        help="Filter commits since date (ISO or 'YYYY-MM-DD')",
    )
    parser.add_argument(
        "--until",
        default=None,
        help="Filter commits until date (ISO or 'YYYY-MM-DD')",
    )
    parser.add_argument(
        "--identity",
        choices=("author", "committer"),
        default="author",
        help="Identity to attribute touches to",
    )
    parser.add_argument(
        "--date-field",
        choices=("author", "committer"),
        default="author",
        help="Date field to use for bucketing",
    )
    parser.add_argument(
        "--include-merges",
        action="store_true",
        help="Include merge commits (excluded by default)",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=5,
        help="Top maintainers per month",
    )
    parser.add_argument(
        "--bucket",
        choices=("month", "quarter"),
        default="month",
        help="Time bucket for grouping",
    )
    parser.add_argument(
        "--touch-mode",
        choices=("commit", "file"),
        default="commit",
        help="Count one touch per commit or one per file touched",
    )
    parser.add_argument(
        "--window-days",
        type=int,
        default=0,
        help="Use a rolling window of N days ending each month (0 = calendar month only)",
    )
    parser.add_argument(
        "--weight",
        choices=("touches", "recency"),
        default="touches",
        help="Weight touches by recency using exponential decay",
    )
    parser.add_argument(
        "--half-life-days",
        type=float,
        default=180.0,
        help="Half-life days for recency weighting",
    )
    parser.add_argument(
        "--min-share",
        type=float,
        default=0.0,
        help="Minimum share within a month to include a maintainer",
    )
    parser.add_argument(
        "--ignore-author-regex",
        default=None,
        help="Regex to skip authors by name or email (e.g., '(bot|dependabot)')",
    )
    parser.add_argument(
        "--min-touches",
        type=int,
        default=1,
        help="Minimum touches per month to include a maintainer",
    )
    return parser.parse_args()


def parse_date(value: str) -> dt.datetime:
    try:
        parsed = dt.datetime.fromisoformat(value)
    except ValueError:
        parsed = dt.datetime.fromisoformat(value + "T00:00:00")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed


def month_key(timestamp: dt.datetime) -> str:
    return timestamp.strftime("%Y-%m")


def quarter_key(timestamp: dt.datetime) -> str:
    quarter = (timestamp.month - 1) // 3 + 1
    return f"{timestamp.year}-Q{quarter}"


def month_end(timestamp: dt.datetime) -> dt.datetime:
    year = timestamp.year
    month = timestamp.month
    if month == 12:
        next_month = dt.datetime(year + 1, 1, 1, tzinfo=dt.timezone.utc)
    else:
        next_month = dt.datetime(year, month + 1, 1, tzinfo=dt.timezone.utc)
    return next_month - dt.timedelta(seconds=1)


def quarter_start(timestamp: dt.datetime) -> dt.datetime:
    quarter = (timestamp.month - 1) // 3
    start_month = quarter * 3 + 1
    return dt.datetime(timestamp.year, start_month, 1, tzinfo=dt.timezone.utc)


def quarter_end(timestamp: dt.datetime) -> dt.datetime:
    start = quarter_start(timestamp)
    end_month = start.month + 2
    end_year = start.year
    if end_month > 12:
        end_month -= 12
        end_year += 1
    end_anchor = dt.datetime(end_year, end_month, 1, tzinfo=dt.timezone.utc)
    return month_end(end_anchor)


def add_months(timestamp: dt.datetime, months: int) -> dt.datetime:
    year = timestamp.year + (timestamp.month - 1 + months) // 12
    month = (timestamp.month - 1 + months) % 12 + 1
    return dt.datetime(year, month, 1, tzinfo=dt.timezone.utc)


def recency_weight(age_days: float, half_life_days: float) -> float:
    if half_life_days <= 0:
        return 1.0
    return math.exp(-age_days / half_life_days)


def read_csv(path: Path) -> Iterable[dict[str, str]]:
    with path.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        yield from reader


def load_people(data_dir: Path) -> dict[str, dict[str, str]]:
    people_path = data_dir / "people.csv"
    people = {}
    for row in read_csv(people_path):
        people[row.get("person_id", "")] = {
            "name": row.get("name", ""),
            "email": row.get("email", ""),
            "primary_tz_offset": row.get("primary_tz_offset", ""),
        }
    return people


def load_graph_json(data_dir: Path) -> dict[str, object] | None:
    cochange_path = data_dir / "cochange.graph.json"
    ownership_path = data_dir / "ownership.graph.json"
    if cochange_path.exists():
        return json.loads(cochange_path.read_text(encoding="utf-8"))
    if ownership_path.exists():
        return json.loads(ownership_path.read_text(encoding="utf-8"))
    return None


def find_file_node(nodes: list[dict[str, object]], query: str) -> dict[str, object]:
    exact = [node for node in nodes if node.get("id") == query]
    if exact:
        return exact[0]
    contains = [node for node in nodes if query in str(node.get("id", ""))]
    if len(contains) == 1:
        return contains[0]
    if not contains:
        raise ValueError(f"File not found in graph: {query}")
    candidates = ", ".join(str(node.get("id")) for node in contains[:10])
    raise ValueError(f"Multiple matches for file {query}: {candidates}")


def load_community_files(
    data_dir: Path, file_query: str | None, community_id: int | None
) -> tuple[int, list[str]]:
    graph = load_graph_json(data_dir)
    if graph:
        nodes = graph.get("nodes", [])
        if file_query:
            node = find_file_node(nodes, file_query)
            community_id = int(node.get("community_id", -1))
        if community_id is None:
            raise ValueError("Provide --file or --community-id")
        files = [node.get("id") for node in nodes if node.get("community_id") == community_id]
        files = [entry for entry in files if entry]
        if not files:
            raise ValueError(f"No files found for community {community_id}")
        return community_id, files

    communities_path = data_dir / "communities.json"
    if not communities_path.exists():
        raise FileNotFoundError("Missing graph json and communities.json")
    communities = json.loads(communities_path.read_text(encoding="utf-8"))
    if file_query:
        for entry in communities:
            files = entry.get("files", [])
            if any(file_query == f or file_query in f for f in files):
                return int(entry.get("id", -1)), list(files)
        raise ValueError("File not found in communities.json (list may be truncated)")
    if community_id is None:
        raise ValueError("Provide --file or --community-id")
    for entry in communities:
        if int(entry.get("id", -1)) == community_id:
            return community_id, list(entry.get("files", []))
    raise ValueError(f"Community id not found: {community_id}")


def iter_commits_from_json(
    commits_path: Path,
    since: dt.datetime | None,
    until: dt.datetime | None,
    date_field: str,
) -> Iterable[dict[str, object]]:
    with commits_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            entry = json.loads(line)
            author_date = entry.get("author_date") or entry.get("date")
            committer_date = entry.get("committer_date")
            if author_date:
                author_dt = parse_date(author_date)
            else:
                author_dt = None
            if committer_date:
                committer_dt = parse_date(committer_date)
            else:
                committer_dt = None
            if date_field == "committer":
                commit_date = committer_dt or author_dt
            else:
                commit_date = author_dt or committer_dt
            if commit_date is None:
                continue
            if since and commit_date < since:
                continue
            if until and commit_date > until:
                continue
            yield {
                "hash": entry.get("hash", ""),
                "parents": entry.get("parents", []),
                "is_merge": entry.get("is_merge", False),
                "author_name": entry.get("author_name", ""),
                "author_email": entry.get("author_email", ""),
                "author_date": author_date,
                "committer_name": entry.get("committer_name", ""),
                "committer_email": entry.get("committer_email", ""),
                "committer_date": committer_date,
                "files": entry.get("files", []),
            }


def iter_commits_from_git(
    repo: str, since: str | None, until: str | None, include_merges: bool
) -> Iterable[dict[str, object]]:
    cmd = [
        "git",
        "-C",
        repo,
        "log",
        "--name-only",
        "--no-renames",
        "--date=iso-strict",
        "--format=---%n%H%n%P%n%an%n%ae%n%ad%n%cn%n%ce%n%cd",
    ]
    if not include_merges:
        cmd.append("--no-merges")
    if since:
        cmd.extend(["--since", since])
    if until:
        cmd.extend(["--until", until])

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert proc.stdout is not None

    block: list[str] = []
    for line in proc.stdout:
        line = line.rstrip("\n")
        if line == "---":
            if block:
                yield from parse_git_block(block)
                block = []
        else:
            block.append(line)
    if block:
        yield from parse_git_block(block)

    stderr = proc.stderr.read() if proc.stderr else ""
    exit_code = proc.wait()
    if exit_code != 0:
        raise RuntimeError(stderr.strip() or "git log failed")


def parse_git_block(block: list[str]) -> Iterable[dict[str, object]]:
    if len(block) < 8:
        return []
    commit_hash = block[0]
    parents = [entry for entry in block[1].split(" ") if entry]
    author_name = block[2]
    author_email = block[3]
    author_date = block[4]
    committer_name = block[5]
    committer_email = block[6]
    committer_date = block[7]
    files = [line for line in block[8:] if line]
    return [
        {
            "hash": commit_hash,
            "parents": parents,
            "is_merge": len(parents) > 1,
            "author_name": author_name,
            "author_email": author_email,
            "author_date": author_date,
            "committer_name": committer_name,
            "committer_email": committer_email,
            "committer_date": committer_date,
            "files": files,
        }
    ]


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"Data directory not found: {data_dir}", file=sys.stderr)
        return 1

    since = parse_date(args.since) if args.since else None
    until = parse_date(args.until) if args.until else None

    try:
        community_id, community_files = load_community_files(data_dir, args.file, args.community_id)
    except (ValueError, FileNotFoundError) as exc:
        print(str(exc), file=sys.stderr)
        return 2

    people = load_people(data_dir)

    ignore_re = re.compile(args.ignore_author_regex) if args.ignore_author_regex else None

    commits_path = data_dir / "commits.jsonl"
    if commits_path.exists():
        commit_iter = iter_commits_from_json(commits_path, since, until, args.date_field)
    else:
        if not args.repo:
            print("--repo is required when commits.jsonl is missing", file=sys.stderr)
            return 2
        commit_iter = iter_commits_from_git(args.repo, args.since, args.until, args.include_merges)

    commit_rows: list[tuple[dt.datetime, str, int, str, str]] = []
    for commit in commit_iter:
        if commit.get("is_merge") and not args.include_merges:
            continue
        files = commit.get("files", [])
        in_community = sum(1 for path in files if path in community_files)
        if in_community == 0:
            continue
        identity_name = commit.get(f"{args.identity}_name", "")
        identity_email = commit.get(f"{args.identity}_email", "")
        date_value = commit.get(f"{args.date_field}_date")
        if not date_value:
            print(
                "Missing committer fields in commits.jsonl. Re-run build or pass --repo.",
                file=sys.stderr,
            )
            return 2
        commit_date = parse_date(date_value)
        person_id = identity_email or identity_name
        if ignore_re and ignore_re.search(identity_name or ""):
            continue
        if ignore_re and ignore_re.search(identity_email or ""):
            continue
        touches = 1 if args.touch_mode == "commit" else in_community
        commit_rows.append((commit_date, person_id, touches, identity_name, identity_email))
        if person_id not in people:
            people[person_id] = {
                "name": identity_name,
                "email": identity_email,
                "primary_tz_offset": "",
            }

    if not commit_rows:
        print("No commits touching community files for the selected window.", file=sys.stderr)
        return 0

    commit_rows.sort(key=lambda row: row[0])
    period_counts: dict[str, Counter[str]] = defaultdict(Counter)
    period_totals: dict[str, float] = defaultdict(float)

    min_date = commit_rows[0][0]
    max_date = commit_rows[-1][0]
    if args.bucket == "quarter":
        period_cursor = quarter_start(min_date)
        period_end_anchor = quarter_start(max_date)
        step_months = 3
        key_func = quarter_key
        end_func = quarter_end
    else:
        period_cursor = dt.datetime(min_date.year, min_date.month, 1, tzinfo=dt.timezone.utc)
        period_end_anchor = dt.datetime(max_date.year, max_date.month, 1, tzinfo=dt.timezone.utc)
        step_months = 1
        key_func = month_key
        end_func = month_end

    while period_cursor <= period_end_anchor:
        bucket_end = end_func(period_cursor)
        bucket_key = key_func(bucket_end)
        if args.window_days > 0:
            window_start = bucket_end - dt.timedelta(days=args.window_days)

            def in_bucket(commit_date: dt.datetime) -> bool:
                return window_start <= commit_date <= bucket_end
        else:
            if args.bucket == "quarter":
                bucket_start = quarter_start(period_cursor)

                def in_bucket(commit_date: dt.datetime) -> bool:
                    return bucket_start <= commit_date <= bucket_end
            else:

                def in_bucket(commit_date: dt.datetime) -> bool:
                    return (
                        commit_date.year == bucket_end.year
                        and commit_date.month == bucket_end.month
                    )

        for commit_date, person_id, touches, _name, _email in commit_rows:
            if not in_bucket(commit_date):
                continue
            weight = 1.0
            if args.weight == "recency":
                age_days = (bucket_end - commit_date).total_seconds() / 86400.0
                weight = recency_weight(age_days, args.half_life_days)
            contribution = touches * weight
            period_counts[bucket_key][person_id] += contribution
            period_totals[bucket_key] += contribution

        period_cursor = add_months(period_cursor, step_months)

    writer = csv.writer(sys.stdout)
    writer.writerow(
        [
            "period",
            "rank",
            "name",
            "email",
            "primary_tz_offset",
            "community_touches",
            "touch_share",
        ]
    )

    for period in sorted(period_counts.keys()):
        total = period_totals[period]
        ranked = sorted(period_counts[period].items(), key=lambda item: item[1], reverse=True)
        rank = 0
        for person_id, touches in ranked:
            if touches < args.min_touches:
                continue
            share = touches / total if total else 0.0
            if share < args.min_share:
                continue
            rank += 1
            if rank > args.top:
                break
            person = people.get(person_id, {})
            if args.weight == "recency":
                touches_value = f"{touches:.4f}"
            else:
                touches_value = f"{touches:.0f}"
            writer.writerow(
                [
                    period,
                    rank,
                    person.get("name", ""),
                    person.get("email", person_id),
                    person.get("primary_tz_offset", ""),
                    touches_value,
                    f"{share:.4f}",
                ]
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
