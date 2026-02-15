#!/usr/bin/env python3
"""Build a security ownership map from git history."""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import fnmatch
import json
import math
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterable

DEFAULT_SENSITIVE_RULES: list[tuple[str, str, float]] = [
    ("**/auth/**", "auth", 1.0),
    ("**/oauth/**", "auth", 1.0),
    ("**/rbac/**", "auth", 1.0),
    ("**/session/**", "auth", 1.0),
    ("**/token/**", "auth", 1.0),
    ("**/crypto/**", "crypto", 1.0),
    ("**/tls/**", "crypto", 1.0),
    ("**/ssl/**", "crypto", 1.0),
    ("**/secrets/**", "secrets", 1.0),
    ("**/keys/**", "secrets", 1.0),
    ("**/*.pem", "secrets", 1.0),
    ("**/*.key", "secrets", 1.0),
    ("**/*.p12", "secrets", 1.0),
    ("**/*.pfx", "secrets", 1.0),
    ("**/iam/**", "auth", 1.0),
    ("**/sso/**", "auth", 1.0),
]

DEFAULT_AUTHOR_EXCLUDE_REGEXES = [
    "dependabot",
]

DEFAULT_COCHANGE_EXCLUDES = [
    "**/Cargo.lock",
    "**/Cargo.toml",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/go.sum",
    "**/go.mod",
    "**/Gemfile.lock",
    "**/Pipfile.lock",
    "**/poetry.lock",
    "**/composer.lock",
    "**/.github/**",
    "**/.gitignore",
    "**/.gitattributes",
    "**/.gitmodules",
    "**/.editorconfig",
    "**/.vscode/**",
    "**/.idea/**",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build ownership graphs and security ownership summaries from git history."
    )
    parser.add_argument("--repo", default=".", help="Path to the git repo (default: .)")
    parser.add_argument(
        "--out",
        default="ownership-map-out",
        help="Output directory for graph artifacts",
    )
    parser.add_argument("--since", default=None, help="Limit git log to commits since date")
    parser.add_argument("--until", default=None, help="Limit git log to commits until date")
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
        help="Date field to use for recency and bucketing",
    )
    parser.add_argument(
        "--include-merges",
        action="store_true",
        help="Include merge commits (excluded by default)",
    )
    parser.add_argument(
        "--half-life-days",
        type=float,
        default=180.0,
        help="Half life for recency weighting",
    )
    parser.add_argument(
        "--sensitive-config",
        default=None,
        help="CSV file with pattern,tag,weight for sensitive paths",
    )
    parser.add_argument(
        "--owner-threshold",
        type=float,
        default=0.5,
        help="Share threshold for hidden owner detection",
    )
    parser.add_argument(
        "--bus-factor-threshold",
        type=int,
        default=1,
        help="Bus factor threshold for hotspots",
    )
    parser.add_argument(
        "--stale-days",
        type=int,
        default=365,
        help="Days since last touch to consider stale",
    )
    parser.add_argument(
        "--min-touches",
        type=int,
        default=1,
        help="Minimum touches to keep an edge",
    )
    parser.add_argument(
        "--emit-commits",
        action="store_true",
        help="Write commit list to commits.jsonl",
    )
    parser.add_argument(
        "--author-exclude-regex",
        action="append",
        default=[],
        help="Regex for author name/email to exclude (repeatable)",
    )
    parser.add_argument(
        "--no-default-author-excludes",
        action="store_true",
        help="Disable default author excludes (dependabot)",
    )
    parser.add_argument(
        "--no-cochange",
        action="store_true",
        help="Disable co-change graph output",
    )
    parser.add_argument(
        "--cochange-max-files",
        type=int,
        default=50,
        help="Ignore commits touching more than this many files for co-change graph",
    )
    parser.add_argument(
        "--cochange-min-count",
        type=int,
        default=2,
        help="Minimum co-change count to keep file-file edge",
    )
    parser.add_argument(
        "--cochange-min-jaccard",
        type=float,
        default=0.05,
        help="Minimum Jaccard similarity to keep file-file edge",
    )
    parser.add_argument(
        "--cochange-exclude",
        action="append",
        default=[],
        help="Glob to exclude from co-change graph (repeatable)",
    )
    parser.add_argument(
        "--no-default-cochange-excludes",
        action="store_true",
        help="Disable default co-change excludes (lockfiles, .github, editor config)",
    )
    parser.add_argument(
        "--no-communities",
        dest="communities",
        action="store_false",
        help="Disable community detection (enabled by default, requires networkx)",
    )
    parser.add_argument(
        "--graphml",
        action="store_true",
        help="Emit ownership.graphml (requires networkx)",
    )
    parser.add_argument(
        "--max-community-files",
        type=int,
        default=50,
        help="Max files listed per community",
    )
    parser.add_argument(
        "--community-top-owners",
        type=int,
        default=5,
        help="Top maintainers saved per community",
    )
    parser.set_defaults(communities=True)
    return parser.parse_args()


def load_sensitive_rules(path: str | None) -> list[tuple[str, str, float]]:
    if not path:
        return list(DEFAULT_SENSITIVE_RULES)
    rules: list[tuple[str, str, float]] = []
    with open(path, "r", encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = [part.strip() for part in line.split(",")]
            if not parts:
                continue
            pattern = parts[0]
            tag = parts[1] if len(parts) > 1 and parts[1] else "sensitive"
            weight = float(parts[2]) if len(parts) > 2 and parts[2] else 1.0
            rules.append((pattern, tag, weight))
    return rules


def parse_date(value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed


def offset_minutes(timestamp: dt.datetime) -> int | None:
    offset = timestamp.utcoffset()
    if offset is None:
        return None
    return int(offset.total_seconds() / 60)


def format_offset(minutes: int) -> str:
    sign = "+" if minutes >= 0 else "-"
    minutes = abs(minutes)
    return f"{sign}{minutes // 60:02d}:{minutes % 60:02d}"


def recency_weighted(now: dt.datetime, when: dt.datetime, half_life_days: float) -> float:
    if half_life_days <= 0:
        return 1.0
    age_days = max(0.0, (now - when).total_seconds() / 86400.0)
    return math.exp(-math.log(2) * age_days / half_life_days)


def match_sensitive(path: str, rules: Iterable[tuple[str, str, float]]) -> dict[str, float]:
    tags: dict[str, float] = defaultdict(float)
    posix = path.replace("\\", "/")
    for pattern, tag, weight in rules:
        patterns = [pattern]
        if pattern.startswith("**/"):
            patterns.append(pattern[3:])
        for candidate in patterns:
            if fnmatch.fnmatchcase(posix, candidate):
                tags[tag] += weight
                break
    return tags


def matches_glob(path: str, pattern: str) -> bool:
    posix = path.replace("\\", "/")
    patterns = [pattern]
    if pattern.startswith("**/"):
        patterns.append(pattern[3:])
    return any(fnmatch.fnmatchcase(posix, candidate) for candidate in patterns)


def is_excluded(path: str, patterns: Iterable[str]) -> bool:
    return any(matches_glob(path, pattern) for pattern in patterns)


def author_excluded(name: str, email: str, patterns: Iterable[re.Pattern[str]]) -> bool:
    if not patterns:
        return False
    haystack = f"{name} {email}".strip()
    return any(pattern.search(haystack) for pattern in patterns)


def compute_community_owners(
    community_files: Iterable[str],
    people: dict[str, dict[str, object]],
    file_people_touches: dict[str, dict[str, int]],
    file_people_recency: dict[str, dict[str, float]],
    file_people_sensitive: dict[str, dict[str, float]],
    top_n: int,
) -> dict[str, object]:
    touches_by_person: dict[str, int] = defaultdict(int)
    recency_by_person: dict[str, float] = defaultdict(float)
    sensitive_by_person: dict[str, float] = defaultdict(float)

    for path in community_files:
        for person, touches in file_people_touches.get(path, {}).items():
            touches_by_person[person] += touches
        for person, recency in file_people_recency.get(path, {}).items():
            recency_by_person[person] += recency
        for person, weight in file_people_sensitive.get(path, {}).items():
            sensitive_by_person[person] += weight

    total_touches = sum(touches_by_person.values())
    total_recency = sum(recency_by_person.values())
    total_sensitive = sum(sensitive_by_person.values())

    ranked = sorted(touches_by_person.items(), key=lambda item: item[1], reverse=True)
    owners = []
    for person_id, touches in ranked[:top_n]:
        recency = recency_by_person.get(person_id, 0.0)
        sensitive = sensitive_by_person.get(person_id, 0.0)
        owners.append(
            {
                "person_id": person_id,
                "name": people.get(person_id, {}).get("name", person_id),
                "touches": touches,
                "touch_share": round(touches / total_touches, 4) if total_touches else 0.0,
                "recency_share": round(recency / total_recency, 4) if total_recency else 0.0,
                "sensitive_share": round(sensitive / total_sensitive, 4)
                if total_sensitive
                else 0.0,
                "primary_tz_offset": people.get(person_id, {}).get("primary_tz_offset", ""),
            }
        )

    return {
        "bus_factor": len(touches_by_person),
        "owner_count": len(touches_by_person),
        "totals": {
            "touches": total_touches,
            "recency_weight": round(total_recency, 6),
            "sensitive_weight": round(total_sensitive, 2),
        },
        "top_maintainers": owners,
    }


def run_git_log(
    repo: str, since: str | None, until: str | None, include_merges: bool
) -> Iterable[list[str]]:
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

    batch: list[str] = []
    for line in proc.stdout:
        batch.append(line.rstrip("\n"))
        if line.rstrip("\n") == "---" and len(batch) > 1:
            yield batch[:-1]
            batch = ["---"]

    if batch:
        yield batch

    stderr = proc.stderr.read() if proc.stderr else ""
    exit_code = proc.wait()
    if exit_code != 0:
        raise RuntimeError(stderr.strip() or "git log failed")


def iter_commits(lines: Iterable[list[str]]) -> Iterable[tuple[dict[str, object], list[str]]]:
    for chunk in lines:
        if not chunk or chunk[0] != "---":
            continue
        header = chunk[1:9]
        if len(header) < 8:
            continue
        parents = [entry for entry in header[1].split(" ") if entry]
        commit = {
            "hash": header[0],
            "parents": parents,
            "is_merge": len(parents) > 1,
            "author_name": header[2],
            "author_email": header[3],
            "author_date": header[4],
            "committer_name": header[5],
            "committer_email": header[6],
            "committer_date": header[7],
        }
        files = [line for line in chunk[9:] if line.strip()]
        yield commit, files


def ensure_out_dir(path: str) -> Path:
    out_dir = Path(path)
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


def write_csv(path: Path, header: list[str], rows: Iterable[list[str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)


def build_ownership_map(args: argparse.Namespace) -> Path:
    now = dt.datetime.now(dt.timezone.utc)
    rules = load_sensitive_rules(args.sensitive_config)
    out_dir = ensure_out_dir(args.out)

    people: dict[str, dict[str, object]] = {}
    files: dict[str, dict[str, object]] = {}
    edges: dict[tuple[str, str], dict[str, object]] = {}
    file_people_touches: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    file_people_recency: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    file_people_sensitive: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    tag_totals: dict[str, float] = defaultdict(float)
    tag_person_totals: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    person_timezone_counts: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    cochange_counts: dict[tuple[str, str], int] = defaultdict(int)
    cochange_file_commits: dict[str, int] = defaultdict(int)
    cochange_commits_used = 0
    cochange_commits_skipped = 0
    cochange_commits_filtered = 0
    cochange_files_excluded = 0

    commits_path = out_dir / "commits.jsonl"
    commit_handle = None
    if args.emit_commits:
        commit_handle = commits_path.open("w", encoding="utf-8")

    total_commits_seen = 0
    total_commits_included = 0
    commits_excluded_identities = 0
    commits_excluded_merges = 0
    total_edges = 0

    author_exclude_regexes = []
    if not args.no_default_author_excludes:
        author_exclude_regexes.extend(DEFAULT_AUTHOR_EXCLUDE_REGEXES)
    author_exclude_regexes.extend(args.author_exclude_regex)
    author_exclude_patterns = [
        re.compile(pattern, re.IGNORECASE) for pattern in author_exclude_regexes
    ]

    cochange_excludes = []
    if not args.no_default_cochange_excludes:
        cochange_excludes.extend(DEFAULT_COCHANGE_EXCLUDES)
    cochange_excludes.extend(args.cochange_exclude)

    log_lines = run_git_log(args.repo, args.since, args.until, args.include_merges)
    for commit, touched_files in iter_commits(log_lines):
        total_commits_seen += 1

        if commit.get("is_merge") and not args.include_merges:
            commits_excluded_merges += 1
            continue

        identity_name = commit.get(f"{args.identity}_name", "")
        identity_email = commit.get(f"{args.identity}_email", "")
        if author_excluded(
            identity_name,
            identity_email,
            author_exclude_patterns,
        ):
            commits_excluded_identities += 1
            continue

        if not touched_files:
            continue

        total_commits_included += 1
        if commit_handle:
            commit_handle.write(json.dumps({**commit, "files": touched_files}) + "\n")

        identity_name = commit.get(f"{args.identity}_name", "")
        identity_email = commit.get(f"{args.identity}_email", "") or identity_name
        commit_date = parse_date(commit.get(f"{args.date_field}_date", ""))
        recency = recency_weighted(now, commit_date, args.half_life_days)
        tz_minutes = offset_minutes(commit_date)
        if tz_minutes is not None:
            person_timezone_counts[identity_email][tz_minutes] += 1
        unique_files = sorted(set(touched_files))
        if not args.no_cochange and len(unique_files) > 1:
            if len(unique_files) > args.cochange_max_files:
                cochange_commits_skipped += 1
            else:
                filtered_files = [
                    path for path in unique_files if not is_excluded(path, cochange_excludes)
                ]
                excluded = len(unique_files) - len(filtered_files)
                if excluded:
                    cochange_files_excluded += excluded
                if len(filtered_files) < 2:
                    cochange_commits_filtered += 1
                if filtered_files:
                    for path in filtered_files:
                        cochange_file_commits[path] += 1
                if len(filtered_files) >= 2:
                    cochange_commits_used += 1
                    for idx, path in enumerate(filtered_files):
                        for other in filtered_files[idx + 1 :]:
                            cochange_counts[(path, other)] += 1

        person = people.setdefault(
            identity_email,
            {
                "name": identity_name,
                "email": identity_email,
                "first_seen": commit_date,
                "last_seen": commit_date,
                "commit_count": 0,
                "touches": 0,
                "sensitive_touches": 0.0,
            },
        )
        person["commit_count"] = int(person["commit_count"]) + 1
        person["first_seen"] = min(person["first_seen"], commit_date)
        person["last_seen"] = max(person["last_seen"], commit_date)

        for path in touched_files:
            file_entry = files.setdefault(
                path,
                {
                    "path": path,
                    "first_seen": commit_date,
                    "last_seen": commit_date,
                    "commit_count": 0,
                    "touches": 0,
                    "authors": set(),
                    "sensitive_tags": {},
                },
            )
            file_entry["commit_count"] = int(file_entry["commit_count"]) + 1
            file_entry["first_seen"] = min(file_entry["first_seen"], commit_date)
            file_entry["last_seen"] = max(file_entry["last_seen"], commit_date)
            file_entry["touches"] = int(file_entry["touches"]) + 1
            file_entry["authors"].add(identity_email)

            edge = edges.setdefault(
                (identity_email, path),
                {
                    "touches": 0,
                    "first_seen": commit_date,
                    "last_seen": commit_date,
                    "recency_weight": 0.0,
                    "sensitive_weight": 0.0,
                },
            )
            edge["touches"] = int(edge["touches"]) + 1
            edge["first_seen"] = min(edge["first_seen"], commit_date)
            edge["last_seen"] = max(edge["last_seen"], commit_date)
            edge["recency_weight"] = float(edge["recency_weight"]) + recency

            tags = match_sensitive(path, rules)
            if tags:
                file_entry["sensitive_tags"] = tags
                sensitive_weight = sum(tags.values())
                edge["sensitive_weight"] = float(edge["sensitive_weight"]) + sensitive_weight
                person["sensitive_touches"] = float(person["sensitive_touches"]) + sensitive_weight
                file_people_sensitive[path][identity_email] += sensitive_weight
                for tag, weight in tags.items():
                    tag_totals[tag] += weight
                    tag_person_totals[tag][identity_email] += weight

            person["touches"] = int(person["touches"]) + 1
            file_people_touches[path][identity_email] += 1
            file_people_recency[path][identity_email] += recency
            total_edges += 1

    if commit_handle:
        commit_handle.close()

    people_rows = []
    for email, person in sorted(people.items()):
        tz_counts = person_timezone_counts.get(email, {})
        primary_tz_offset = ""
        primary_tz_minutes = ""
        timezone_offsets = ""
        if tz_counts:
            primary_tz_minutes_value = max(tz_counts.items(), key=lambda item: (item[1], item[0]))[
                0
            ]
            primary_tz_offset = format_offset(primary_tz_minutes_value)
            primary_tz_minutes = str(primary_tz_minutes_value)
            timezone_offsets = ";".join(
                f"{format_offset(minutes)}:{count}"
                for minutes, count in sorted(tz_counts.items(), key=lambda item: item[0])
            )
            person["primary_tz_offset"] = primary_tz_offset
        people_rows.append(
            [
                email,
                str(person["name"]),
                email,
                person["first_seen"].isoformat(),
                person["last_seen"].isoformat(),
                str(person["commit_count"]),
                str(person["touches"]),
                f"{person['sensitive_touches']:.2f}",
                primary_tz_offset,
                primary_tz_minutes,
                timezone_offsets,
            ]
        )

    file_rows = []
    for path, file_entry in sorted(files.items()):
        authors = file_entry["authors"]
        bus_factor = len(authors)
        tags = file_entry["sensitive_tags"]
        tag_list = ";".join(sorted(tags.keys()))
        sensitivity_score = sum(tags.values()) if tags else 0.0
        file_rows.append(
            [
                path,
                path,
                file_entry["first_seen"].isoformat(),
                file_entry["last_seen"].isoformat(),
                str(file_entry["commit_count"]),
                str(file_entry["touches"]),
                str(bus_factor),
                f"{sensitivity_score:.2f}",
                tag_list,
            ]
        )

    edge_rows = []
    for (email, path), edge in edges.items():
        if int(edge["touches"]) < args.min_touches:
            continue
        edge_rows.append(
            [
                email,
                path,
                str(edge["touches"]),
                f"{edge['recency_weight']:.6f}",
                edge["first_seen"].isoformat(),
                edge["last_seen"].isoformat(),
                f"{edge['sensitive_weight']:.2f}",
            ]
        )

    cochange_rows: list[list[str]] = []
    if not args.no_cochange:
        for (file_a, file_b), count in cochange_counts.items():
            if count < args.cochange_min_count:
                continue
            commits_a = cochange_file_commits.get(file_a, 0)
            commits_b = cochange_file_commits.get(file_b, 0)
            denom = commits_a + commits_b - count
            if denom <= 0:
                continue
            jaccard = count / denom
            if jaccard < args.cochange_min_jaccard:
                continue
            cochange_rows.append([file_a, file_b, str(count), f"{jaccard:.6f}"])

    write_csv(
        out_dir / "people.csv",
        [
            "person_id",
            "name",
            "email",
            "first_seen",
            "last_seen",
            "commit_count",
            "touches",
            "sensitive_touches",
            "primary_tz_offset",
            "primary_tz_minutes",
            "timezone_offsets",
        ],
        people_rows,
    )
    write_csv(
        out_dir / "files.csv",
        [
            "file_id",
            "path",
            "first_seen",
            "last_seen",
            "commit_count",
            "touches",
            "bus_factor",
            "sensitivity_score",
            "sensitivity_tags",
        ],
        file_rows,
    )
    write_csv(
        out_dir / "edges.csv",
        [
            "person_id",
            "file_id",
            "touches",
            "recency_weight",
            "first_seen",
            "last_seen",
            "sensitive_weight",
        ],
        edge_rows,
    )
    if not args.no_cochange:
        write_csv(
            out_dir / "cochange_edges.csv",
            [
                "file_a",
                "file_b",
                "cochange_count",
                "jaccard",
            ],
            cochange_rows,
        )

    orphaned_sensitive_code = []
    bus_factor_hotspots = []
    for path, file_entry in files.items():
        tags = file_entry["sensitive_tags"]
        if not tags:
            continue
        bus_factor = len(file_entry["authors"])
        last_seen = file_entry["last_seen"]
        age_days = (now - last_seen).days
        top_owner = None
        if path in file_people_touches:
            top_owner = max(file_people_touches[path].items(), key=lambda item: item[1])[0]
        hotspot = {
            "path": path,
            "bus_factor": bus_factor,
            "last_touch": last_seen.isoformat(),
            "sensitivity_tags": sorted(tags.keys()),
            "top_owner": top_owner,
        }
        if bus_factor <= args.bus_factor_threshold:
            bus_factor_hotspots.append(hotspot)
            if age_days >= args.stale_days:
                orphaned_sensitive_code.append(
                    {
                        **hotspot,
                        "last_security_touch": last_seen.isoformat(),
                    }
                )

    hidden_owners = []
    for tag, total in tag_totals.items():
        if total <= 0:
            continue
        person_totals = tag_person_totals[tag]
        if not person_totals:
            continue
        top_email, top_value = max(person_totals.items(), key=lambda item: item[1])
        share = top_value / total
        if share >= args.owner_threshold:
            person_name = people.get(top_email, {}).get("name", top_email)
            hidden_owners.append(
                {
                    "person": top_email,
                    "name": person_name,
                    "controls": f"{share * 100:.0f}% of {tag} code",
                    "category": tag,
                    "share": round(share, 4),
                }
            )

    summary = {
        "generated_at": now.isoformat(),
        "repo": os.path.abspath(args.repo),
        "parameters": {
            "since": args.since,
            "until": args.until,
            "half_life_days": args.half_life_days,
            "bus_factor_threshold": args.bus_factor_threshold,
            "stale_days": args.stale_days,
            "owner_threshold": args.owner_threshold,
            "sensitive_config": args.sensitive_config,
            "identity": args.identity,
            "date_field": args.date_field,
            "include_merges": args.include_merges,
            "cochange_enabled": not args.no_cochange,
            "cochange_max_files": args.cochange_max_files,
            "cochange_min_count": args.cochange_min_count,
            "cochange_min_jaccard": args.cochange_min_jaccard,
            "cochange_default_excludes": not args.no_default_cochange_excludes,
            "cochange_excludes": cochange_excludes,
            "author_default_excludes": not args.no_default_author_excludes,
            "author_exclude_regexes": author_exclude_regexes,
            "community_top_owners": args.community_top_owners,
        },
        "orphaned_sensitive_code": orphaned_sensitive_code,
        "hidden_owners": hidden_owners,
        "bus_factor_hotspots": bus_factor_hotspots,
        "stats": {
            "commits": total_commits_included,
            "commits_seen": total_commits_seen,
            "commits_excluded_identities": commits_excluded_identities,
            "commits_excluded_merges": commits_excluded_merges,
            "edges": total_edges,
            "people": len(people),
            "files": len(files),
            "cochange_pairs_total": len(cochange_counts) if not args.no_cochange else 0,
            "cochange_edges": len(cochange_rows) if not args.no_cochange else 0,
            "cochange_commits_used": cochange_commits_used if not args.no_cochange else 0,
            "cochange_commits_skipped": cochange_commits_skipped if not args.no_cochange else 0,
            "cochange_commits_filtered": cochange_commits_filtered if not args.no_cochange else 0,
            "cochange_files_excluded": cochange_files_excluded if not args.no_cochange else 0,
        },
    }

    with (out_dir / "summary.json").open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)

    if args.communities or args.graphml:
        try:
            import networkx as nx
            from networkx.algorithms import bipartite
        except ImportError:
            raise RuntimeError(
                "networkx is required for communities/graphml output. Install with: pip install networkx"
            )
        else:
            graph_bipartite = None
            graph_cochange = None
            person_nodes = set()
            file_nodes = set()
            community_index: dict[str, int] = {}
            community_metadata: list[dict[str, object]] = []

            if args.graphml or (args.communities and (args.no_cochange or not cochange_rows)):
                graph_bipartite = nx.Graph()
                for (email, path), edge in edges.items():
                    if int(edge["touches"]) < args.min_touches:
                        continue
                    graph_bipartite.add_node(email, node_type="person")
                    graph_bipartite.add_node(path, node_type="file")
                    graph_bipartite.add_edge(email, path, weight=float(edge["touches"]))
                    person_nodes.add(email)
                    file_nodes.add(path)

            if not args.no_cochange and cochange_rows:
                graph_cochange = nx.Graph()
                for file_a, file_b, count, jaccard in cochange_rows:
                    graph_cochange.add_edge(
                        file_a,
                        file_b,
                        weight=float(jaccard),
                        count=int(count),
                    )

            if args.communities:
                communities_result = None
                if graph_cochange is not None:
                    communities_result = list(
                        nx.algorithms.community.greedy_modularity_communities(
                            graph_cochange, weight="weight"
                        )
                    )
                elif graph_bipartite is not None and file_nodes:
                    projected = bipartite.weighted_projected_graph(graph_bipartite, file_nodes)
                    communities_result = list(
                        nx.algorithms.community.greedy_modularity_communities(projected)
                    )

                if communities_result is not None:
                    serialized = []
                    for idx, community in enumerate(communities_result, start=1):
                        files_list = sorted(community)
                        owners = compute_community_owners(
                            files_list,
                            people,
                            file_people_touches,
                            file_people_recency,
                            file_people_sensitive,
                            args.community_top_owners,
                        )
                        for path in files_list:
                            community_index[path] = idx
                        entry = {
                            "id": idx,
                            "size": len(files_list),
                            "files": files_list[: args.max_community_files],
                            "maintainers": owners["top_maintainers"],
                            "bus_factor": owners["bus_factor"],
                            "owner_count": owners["owner_count"],
                            "totals": owners["totals"],
                        }
                        serialized.append(entry)
                        metadata = dict(entry)
                        metadata.pop("files", None)
                        community_metadata.append(metadata)
                    with (out_dir / "communities.json").open("w", encoding="utf-8") as handle:
                        json.dump(serialized, handle, indent=2)

            if args.communities:
                for node, community_id in community_index.items():
                    if graph_cochange is not None and node in graph_cochange:
                        graph_cochange.nodes[node]["community_id"] = community_id
                    if graph_bipartite is not None and node in graph_bipartite:
                        graph_bipartite.nodes[node]["community_id"] = community_id

                graph_for_json = graph_cochange or graph_bipartite
                if graph_for_json is not None:
                    try:
                        from networkx.readwrite import json_graph
                    except ImportError:
                        pass
                    else:
                        data = json_graph.node_link_data(graph_for_json, edges="edges")
                        data.setdefault("graph", {})
                        data["graph"]["community_maintainers"] = community_metadata
                        json_name = (
                            "cochange.graph.json"
                            if graph_for_json is graph_cochange
                            else "ownership.graph.json"
                        )
                        with (out_dir / json_name).open("w", encoding="utf-8") as handle:
                            json.dump(data, handle, indent=2)

            if args.graphml:
                if graph_bipartite is not None:
                    nx.write_graphml(graph_bipartite, out_dir / "ownership.graphml")
                if graph_cochange is not None:
                    nx.write_graphml(graph_cochange, out_dir / "cochange.graphml")

    return out_dir


def main() -> int:
    args = parse_args()
    try:
        out_dir = build_ownership_map(args)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(f"Ownership map written to {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
