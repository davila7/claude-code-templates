#!/usr/bin/env python3
"""One-shot runner for building the security ownership map."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run build_ownership_map.py with sensible defaults."
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
        "--graphml",
        action="store_true",
        help="Emit GraphML outputs",
    )
    parser.add_argument(
        "--sensitive-config",
        default=None,
        help="CSV file with pattern,tag,weight for sensitive paths",
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
        "--community-top-owners",
        type=int,
        default=5,
        help="Top maintainers saved per community",
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
        "--owner-threshold",
        type=float,
        default=0.5,
        help="Share threshold for hidden owner detection",
    )
    parser.add_argument(
        "--no-cochange",
        action="store_true",
        help="Disable co-change graph output",
    )
    parser.add_argument(
        "--no-communities",
        action="store_true",
        help="Disable community detection (not recommended)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        import networkx  # noqa: F401
    except ImportError:
        print("networkx is required. Install with: pip install networkx", file=sys.stderr)
        return 2

    script_path = Path(__file__).resolve().parent / "build_ownership_map.py"
    cmd = [
        sys.executable,
        str(script_path),
        "--repo",
        args.repo,
        "--out",
        args.out,
        "--identity",
        args.identity,
        "--date-field",
        args.date_field,
        "--cochange-max-files",
        str(args.cochange_max_files),
        "--cochange-min-count",
        str(args.cochange_min_count),
        "--cochange-min-jaccard",
        str(args.cochange_min_jaccard),
        "--community-top-owners",
        str(args.community_top_owners),
        "--bus-factor-threshold",
        str(args.bus_factor_threshold),
        "--stale-days",
        str(args.stale_days),
        "--owner-threshold",
        str(args.owner_threshold),
    ]

    if args.since:
        cmd.extend(["--since", args.since])
    if args.until:
        cmd.extend(["--until", args.until])
    if args.include_merges:
        cmd.append("--include-merges")
    if args.emit_commits:
        cmd.append("--emit-commits")
    if args.graphml:
        cmd.append("--graphml")
    if args.sensitive_config:
        cmd.extend(["--sensitive-config", args.sensitive_config])
    if args.no_cochange:
        cmd.append("--no-cochange")
    if args.no_communities:
        cmd.append("--no-communities")
    if args.no_default_cochange_excludes:
        cmd.append("--no-default-cochange-excludes")
    for pattern in args.cochange_exclude:
        cmd.extend(["--cochange-exclude", pattern])
    if args.no_default_author_excludes:
        cmd.append("--no-default-author-excludes")
    for pattern in args.author_exclude_regex:
        cmd.extend(["--author-exclude-regex", pattern])

    result = subprocess.run(cmd, check=False)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
