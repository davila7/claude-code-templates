#!/usr/bin/env python3
"""Canonical content hash of a frozen fixture, for the manifest's fixture_hash.

Every gate/bootstrap run is refused without a fixture_hash, and two runs are only
comparable when their hashes match. This produces that hash the same way every time,
so two people (or two tools) hashing the same fixture get the same string instead of
each inventing a canonicalization and silently failing to compare.

Canonicalization: parse the fixture, re-serialize with sorted keys and no incidental
whitespace, UTF-8. Formatting, key order, and trailing newlines do not change the hash;
content does. Accepts a JSON document ({"items":[...]} or a bare array) or JSONL
(one record per line); both hash to the same value when they carry the same records.

Usage:
  hash_fixture.py path/to/fixture.json         # prints: sha256:<hex>
  hash_fixture.py --raw path/to/fixture.json   # prints just <hex>
Exit 0 on success, 2 on unreadable or non-JSON input.
"""
import argparse
import hashlib
import json
import sys


def die(msg):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(2)


def load_records(path):
    try:
        with open(path, encoding="utf-8") as handle:
            text = handle.read().strip()
    except FileNotFoundError:
        die(f"file not found: {path}")
    except (OSError, UnicodeError) as exc:
        die(f"cannot read {path} as UTF-8 ({exc})")
    if not text:
        die(f"{path} is empty.")
    try:
        data = json.loads(text)
        return data["items"] if isinstance(data, dict) and "items" in data else data
    except (json.JSONDecodeError, ValueError):
        try:
            return [json.loads(line) for line in text.splitlines() if line.strip()]
        except (json.JSONDecodeError, ValueError) as exc:
            die(f"{path} is neither a JSON document nor JSONL ({exc}).")


def canonical_hash(records):
    if not isinstance(records, list):
        die("fixture must be a list of records (or an object with an 'items' array).")
    # Sort records by id when present so record order does not change the hash;
    # a fixture is a set of items, not a sequence.
    try:
        ordered = sorted(records, key=lambda r: json.dumps(r.get("id") if isinstance(r, dict) else r,
                                                            sort_keys=True, ensure_ascii=False))
    except TypeError:
        ordered = records
    blob = json.dumps(ordered, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("fixture", help="path to the fixture (JSON or JSONL)")
    parser.add_argument("--raw", action="store_true", help="print the bare hex, no 'sha256:' prefix")
    args = parser.parse_args()
    digest = canonical_hash(load_records(args.fixture))
    print(digest if args.raw else f"sha256:{digest}")


if __name__ == "__main__":
    main()
