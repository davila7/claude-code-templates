#!/usr/bin/env python3
"""Query ownership-map outputs without loading everything into an LLM context."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Query ownership-map outputs with bounded JSON results."
    )
    parser.add_argument(
        "--data-dir",
        default="ownership-map-out",
        help="Directory containing people.csv, files.csv, edges.csv",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    people = subparsers.add_parser("people", help="List people")
    people.add_argument("--limit", type=int, default=20)
    people.add_argument("--sort", default="touches")
    people.add_argument("--email-contains", default=None)
    people.add_argument("--min-touches", type=int, default=0)
    people.add_argument("--min-sensitive", type=float, default=0.0)

    files = subparsers.add_parser("files", help="List files")
    files.add_argument("--limit", type=int, default=20)
    files.add_argument("--sort", default="sensitivity_score")
    files.add_argument("--path-contains", default=None)
    files.add_argument("--tag", default=None)
    files.add_argument("--bus-factor-max", type=int, default=None)
    files.add_argument("--sensitivity-min", type=float, default=0.0)

    person = subparsers.add_parser("person", help="Show person details and top files")
    person.add_argument("--person", required=True, help="Exact email or substring")
    person.add_argument("--limit", type=int, default=20)
    person.add_argument("--sort", default="touches")

    file_cmd = subparsers.add_parser("file", help="Show file details and top people")
    file_cmd.add_argument("--file", required=True, help="Exact path or substring")
    file_cmd.add_argument("--limit", type=int, default=20)
    file_cmd.add_argument("--sort", default="touches")

    cochange = subparsers.add_parser("cochange", help="List co-change neighbors for a file")
    cochange.add_argument("--file", required=True, help="Exact path or substring")
    cochange.add_argument("--limit", type=int, default=20)
    cochange.add_argument("--sort", default="jaccard")
    cochange.add_argument("--min-jaccard", type=float, default=0.0)
    cochange.add_argument("--min-count", type=int, default=1)

    tag = subparsers.add_parser("tag", help="Show top people/files for a sensitive tag")
    tag.add_argument("--tag", required=True)
    tag.add_argument("--limit", type=int, default=20)

    summary = subparsers.add_parser("summary", help="Show summary.json sections")
    summary.add_argument("--section", default=None)

    communities = subparsers.add_parser("communities", help="List communities")
    communities.add_argument("--limit", type=int, default=10)
    communities.add_argument("--id", type=int, default=None)

    community = subparsers.add_parser("community", help="Show community maintainers")
    community.add_argument("--id", type=int, required=True)
    community.add_argument("--include-files", action="store_true")
    community.add_argument("--file-limit", type=int, default=50)

    return parser.parse_args()


def to_int(value: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def to_float(value: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def read_csv(path: Path) -> Iterable[dict[str, str]]:
    with path.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        yield from reader


def load_people(data_dir: Path) -> list[dict[str, object]]:
    people_path = data_dir / "people.csv"
    people = []
    for row in read_csv(people_path):
        person = dict(row)
        person["touches"] = to_int(row.get("touches", "0"))
        person["commit_count"] = to_int(row.get("commit_count", "0"))
        person["sensitive_touches"] = to_float(row.get("sensitive_touches", "0"))
        people.append(person)
    return people


def load_files(data_dir: Path) -> list[dict[str, object]]:
    files_path = data_dir / "files.csv"
    files = []
    for row in read_csv(files_path):
        file_entry = dict(row)
        file_entry["touches"] = to_int(row.get("touches", "0"))
        file_entry["commit_count"] = to_int(row.get("commit_count", "0"))
        file_entry["bus_factor"] = to_int(row.get("bus_factor", "0"))
        file_entry["sensitivity_score"] = to_float(row.get("sensitivity_score", "0"))
        tags = row.get("sensitivity_tags", "")
        file_entry["sensitivity_tags"] = [tag for tag in tags.split(";") if tag]
        files.append(file_entry)
    return files


def load_summary(data_dir: Path) -> dict[str, object]:
    summary_path = data_dir / "summary.json"
    with summary_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_communities(data_dir: Path) -> list[dict[str, object]]:
    communities_path = data_dir / "communities.json"
    if not communities_path.exists():
        raise FileNotFoundError("communities.json not found; rerun build with --communities")
    with communities_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_cochange_edges(data_dir: Path) -> Iterable[dict[str, object]]:
    edges_path = data_dir / "cochange_edges.csv"
    if not edges_path.exists():
        raise FileNotFoundError("cochange_edges.csv not found; rerun build without --no-cochange")
    for row in read_csv(edges_path):
        yield {
            "file_a": row.get("file_a"),
            "file_b": row.get("file_b"),
            "cochange_count": to_int(row.get("cochange_count", "0")),
            "jaccard": to_float(row.get("jaccard", "0")),
        }


def select_single(records: list[dict[str, object]], key: str, query: str) -> dict[str, object]:
    exact = [record for record in records if str(record.get(key, "")) == query]
    if exact:
        return exact[0]
    contains = [record for record in records if query in str(record.get(key, ""))]
    if len(contains) == 1:
        return contains[0]
    if not contains:
        raise ValueError(f"No match for {query}")
    candidates = [str(record.get(key, "")) for record in contains[:10]]
    raise ValueError(f"Multiple matches for {query}: {', '.join(candidates)}")


def top_edges_for_person(data_dir: Path, person_id: str) -> list[dict[str, object]]:
    edges_path = data_dir / "edges.csv"
    results = []
    for row in read_csv(edges_path):
        if row.get("person_id") != person_id:
            continue
        results.append(
            {
                "file_id": row.get("file_id"),
                "touches": to_int(row.get("touches", "0")),
                "recency_weight": to_float(row.get("recency_weight", "0")),
                "sensitive_weight": to_float(row.get("sensitive_weight", "0")),
                "last_seen": row.get("last_seen"),
            }
        )
    return results


def top_edges_for_file(data_dir: Path, file_id: str) -> list[dict[str, object]]:
    edges_path = data_dir / "edges.csv"
    results = []
    for row in read_csv(edges_path):
        if row.get("file_id") != file_id:
            continue
        results.append(
            {
                "person_id": row.get("person_id"),
                "touches": to_int(row.get("touches", "0")),
                "recency_weight": to_float(row.get("recency_weight", "0")),
                "sensitive_weight": to_float(row.get("sensitive_weight", "0")),
                "last_seen": row.get("last_seen"),
            }
        )
    return results


def sort_records(records: list[dict[str, object]], key: str) -> list[dict[str, object]]:
    return sorted(records, key=lambda item: item.get(key, 0), reverse=True)


def handle_people(args: argparse.Namespace, data_dir: Path) -> None:
    people = load_people(data_dir)
    if args.email_contains:
        people = [p for p in people if args.email_contains in p.get("email", "")]
    people = [p for p in people if p["touches"] >= args.min_touches]
    people = [p for p in people if p["sensitive_touches"] >= args.min_sensitive]
    people = sort_records(people, args.sort)[: args.limit]
    payload = [
        {
            "person_id": p.get("person_id"),
            "name": p.get("name"),
            "email": p.get("email"),
            "touches": p.get("touches"),
            "commit_count": p.get("commit_count"),
            "sensitive_touches": p.get("sensitive_touches"),
            "primary_tz_offset": p.get("primary_tz_offset"),
        }
        for p in people
    ]
    print(json.dumps(payload, indent=2))


def handle_files(args: argparse.Namespace, data_dir: Path) -> None:
    files = load_files(data_dir)
    if args.path_contains:
        files = [f for f in files if args.path_contains in f.get("path", "")]
    if args.tag:
        files = [f for f in files if args.tag in f.get("sensitivity_tags", [])]
    if args.bus_factor_max is not None:
        files = [f for f in files if f["bus_factor"] <= args.bus_factor_max]
    files = [f for f in files if f["sensitivity_score"] >= args.sensitivity_min]
    files = sort_records(files, args.sort)[: args.limit]
    payload = [
        {
            "file_id": f.get("file_id"),
            "path": f.get("path"),
            "touches": f.get("touches"),
            "bus_factor": f.get("bus_factor"),
            "sensitivity_score": f.get("sensitivity_score"),
            "sensitivity_tags": f.get("sensitivity_tags"),
            "last_seen": f.get("last_seen"),
        }
        for f in files
    ]
    print(json.dumps(payload, indent=2))


def handle_person(args: argparse.Namespace, data_dir: Path) -> None:
    people = load_people(data_dir)
    person = select_single(people, "person_id", args.person)
    files = load_files(data_dir)
    file_map = {f["file_id"]: f for f in files}
    edges = top_edges_for_person(data_dir, person["person_id"])
    edges = sort_records(edges, args.sort)[: args.limit]
    payload = {
        "person": {
            "person_id": person.get("person_id"),
            "name": person.get("name"),
            "email": person.get("email"),
            "touches": person.get("touches"),
            "commit_count": person.get("commit_count"),
            "sensitive_touches": person.get("sensitive_touches"),
            "primary_tz_offset": person.get("primary_tz_offset"),
            "timezone_offsets": person.get("timezone_offsets"),
        },
        "top_files": [
            {
                "file_id": edge.get("file_id"),
                "path": file_map.get(edge.get("file_id"), {}).get("path"),
                "touches": edge.get("touches"),
                "recency_weight": edge.get("recency_weight"),
                "sensitive_weight": edge.get("sensitive_weight"),
                "last_seen": edge.get("last_seen"),
                "sensitivity_tags": file_map.get(edge.get("file_id"), {}).get("sensitivity_tags"),
            }
            for edge in edges
        ],
    }
    print(json.dumps(payload, indent=2))


def handle_file(args: argparse.Namespace, data_dir: Path) -> None:
    files = load_files(data_dir)
    file_entry = select_single(files, "file_id", args.file)
    people = load_people(data_dir)
    people_map = {p["person_id"]: p for p in people}
    edges = top_edges_for_file(data_dir, file_entry["file_id"])
    edges = sort_records(edges, args.sort)[: args.limit]
    payload = {
        "file": {
            "file_id": file_entry.get("file_id"),
            "path": file_entry.get("path"),
            "touches": file_entry.get("touches"),
            "bus_factor": file_entry.get("bus_factor"),
            "sensitivity_score": file_entry.get("sensitivity_score"),
            "sensitivity_tags": file_entry.get("sensitivity_tags"),
            "last_seen": file_entry.get("last_seen"),
        },
        "top_people": [
            {
                "person_id": edge.get("person_id"),
                "name": people_map.get(edge.get("person_id"), {}).get("name"),
                "email": people_map.get(edge.get("person_id"), {}).get("email"),
                "touches": edge.get("touches"),
                "recency_weight": edge.get("recency_weight"),
                "sensitive_weight": edge.get("sensitive_weight"),
                "primary_tz_offset": people_map.get(edge.get("person_id"), {}).get(
                    "primary_tz_offset"
                ),
            }
            for edge in edges
        ],
    }
    print(json.dumps(payload, indent=2))


def handle_cochange(args: argparse.Namespace, data_dir: Path) -> None:
    files = load_files(data_dir)
    file_entry = select_single(files, "file_id", args.file)

    neighbors = []
    for row in load_cochange_edges(data_dir):
        file_a = row.get("file_a")
        file_b = row.get("file_b")
        if file_a == file_entry["file_id"]:
            other = file_b
        elif file_b == file_entry["file_id"]:
            other = file_a
        else:
            continue

        if row["cochange_count"] < args.min_count:
            continue
        if row["jaccard"] < args.min_jaccard:
            continue

        neighbors.append(
            {
                "file_id": other,
                "path": other,
                "cochange_count": row["cochange_count"],
                "jaccard": row["jaccard"],
            }
        )

    neighbors = sort_records(neighbors, args.sort)[: args.limit]
    payload = {
        "file": {
            "file_id": file_entry.get("file_id"),
            "path": file_entry.get("path"),
        },
        "neighbors": neighbors,
    }
    print(json.dumps(payload, indent=2))


def handle_tag(args: argparse.Namespace, data_dir: Path) -> None:
    files = load_files(data_dir)
    tagged_files = [f for f in files if args.tag in f.get("sensitivity_tags", [])]
    tagged_ids = {f["file_id"] for f in tagged_files}

    person_touch = defaultdict(int)
    edges_path = data_dir / "edges.csv"
    for row in read_csv(edges_path):
        if row.get("file_id") not in tagged_ids:
            continue
        person_touch[row.get("person_id")] += to_int(row.get("touches", "0"))

    people = load_people(data_dir)
    people_map = {p["person_id"]: p for p in people}
    top_people = [
        {
            "person_id": person_id,
            "name": people_map.get(person_id, {}).get("name"),
            "email": people_map.get(person_id, {}).get("email"),
            "touches": touches,
        }
        for person_id, touches in person_touch.items()
    ]
    top_people = sorted(top_people, key=lambda item: item.get("touches", 0), reverse=True)[
        : args.limit
    ]

    top_files = sorted(tagged_files, key=lambda item: item.get("touches", 0), reverse=True)[
        : args.limit
    ]

    payload = {
        "tag": args.tag,
        "top_people": top_people,
        "top_files": [
            {
                "file_id": entry.get("file_id"),
                "path": entry.get("path"),
                "touches": entry.get("touches"),
                "bus_factor": entry.get("bus_factor"),
            }
            for entry in top_files
        ],
    }
    print(json.dumps(payload, indent=2))


def handle_summary(args: argparse.Namespace, data_dir: Path) -> None:
    summary = load_summary(data_dir)
    if args.section:
        if args.section not in summary:
            raise ValueError(f"Section not found: {args.section}")
        payload = summary[args.section]
    else:
        payload = summary
    print(json.dumps(payload, indent=2))


def handle_communities(args: argparse.Namespace, data_dir: Path) -> None:
    communities = load_communities(data_dir)
    if args.id is not None:
        matches = [entry for entry in communities if entry.get("id") == args.id]
        if not matches:
            raise ValueError(f"Community id not found: {args.id}")
        payload = matches[0]
    else:
        payload = sorted(communities, key=lambda item: item.get("size", 0), reverse=True)[
            : args.limit
        ]
    print(json.dumps(payload, indent=2))


def handle_community(args: argparse.Namespace, data_dir: Path) -> None:
    communities = load_communities(data_dir)
    matches = [entry for entry in communities if entry.get("id") == args.id]
    if not matches:
        raise ValueError(f"Community id not found: {args.id}")
    entry = dict(matches[0])
    files = entry.pop("files", [])
    payload = entry
    if args.include_files:
        payload["files"] = files[: args.file_limit]
        payload["files_truncated"] = len(files) > args.file_limit
    print(json.dumps(payload, indent=2))


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"Data directory not found: {data_dir}", file=sys.stderr)
        return 1

    try:
        if args.command == "people":
            handle_people(args, data_dir)
        elif args.command == "files":
            handle_files(args, data_dir)
        elif args.command == "person":
            handle_person(args, data_dir)
        elif args.command == "file":
            handle_file(args, data_dir)
        elif args.command == "cochange":
            handle_cochange(args, data_dir)
        elif args.command == "tag":
            handle_tag(args, data_dir)
        elif args.command == "summary":
            handle_summary(args, data_dir)
        elif args.command == "communities":
            handle_communities(args, data_dir)
        elif args.command == "community":
            handle_community(args, data_dir)
        else:
            raise ValueError(f"Unknown command: {args.command}")
    except (FileNotFoundError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
