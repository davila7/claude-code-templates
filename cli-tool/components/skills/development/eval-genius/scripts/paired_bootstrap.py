#!/usr/bin/env python3
"""Paired bootstrap interval on per-item deltas from two harness-agnostic result files.

Input: JSON {"items":[...]}, a JSON array, or JSONL. Records need a unique, non-empty
string ``id`` and a finite numeric ``score``. Optional ``cluster`` values must be JSON
scalars and must match between arms. Exit 0 on valid input and 1 on invalid input.
"""
import argparse
import json
import math
import random
import statistics
import sys

MAX_REPS = 100_000
MAX_RESAMPLED_UNITS = 10_000_000


def fail(message):
    print(f"error: {message}", file=sys.stderr)
    sys.exit(1)


def parse_records(text):
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            if "items" not in data:
                raise TypeError("JSON object needs an 'items' array")
            return data["items"]
        return data
    except (json.JSONDecodeError, ValueError):
        return [json.loads(line) for line in text.splitlines() if line.strip()]


def scalar(value):
    return isinstance(value, (str, int, float)) and not isinstance(value, bool) and (not isinstance(value, float) or math.isfinite(value))


def load(path):
    try:
        with open(path, encoding="utf-8") as handle:
            text = handle.read().strip()
    except FileNotFoundError:
        fail(f"file not found: {path}")
    except (OSError, UnicodeError) as exc:
        fail(f"cannot read {path} as UTF-8 ({exc})")
    try:
        items = parse_records(text)
    except (json.JSONDecodeError, ValueError, KeyError, TypeError) as exc:
        fail(f"{path} is not a per-item JSON/JSONL file ({exc}). Need records with 'id' and finite numeric 'score'.")
    if not isinstance(items, list):
        fail(f"{path} items must be an array.")
    result = {}
    for item in items:
        if not isinstance(item, dict):
            fail(f"record {item!r} in {path} must be an object.")
        item_id, score = item.get("id"), item.get("score")
        if not isinstance(item_id, str) or not item_id.strip():
            fail(f"record {item!r} in {path} needs a non-empty string 'id'.")
        try:
            finite_score = isinstance(score, (int, float)) and not isinstance(score, bool) and math.isfinite(score)
        except OverflowError:
            finite_score = False
        if not finite_score:
            fail(f"record {item!r} in {path} needs a finite numeric 'score'.")
        cluster = item.get("cluster", item_id)
        if not scalar(cluster):
            fail(f"record {item!r} in {path} needs a scalar string or number 'cluster'.")
        if item_id in result:
            fail(f"{path} contains duplicate item id {item_id!r}.")
        result[item_id] = item
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--a", required=True, help="baseline per-item file")
    parser.add_argument("--b", required=True, help="treatment per-item file")
    parser.add_argument("--reps", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    if not 1 <= args.reps <= MAX_REPS:
        fail(f"--reps must be between 1 and {MAX_REPS}.")

    a_items, b_items = load(args.a), load(args.b)
    if set(a_items) != set(b_items):
        fail(f"item ids differ ({len(set(a_items)-set(b_items))} only in a, {len(set(b_items)-set(a_items))} only in b). Paired analysis needs identical item sets.")
    ids = sorted(a_items)
    if len(ids) < 2:
        fail("need at least 2 paired items.")
    mismatches = [item_id for item_id in ids
                  if a_items[item_id].get("cluster", item_id) != b_items[item_id].get("cluster", item_id)]
    if mismatches:
        fail("cluster assignments differ between arms for ids: " + ", ".join(mismatches[:20]))

    deltas = {}
    for item_id in ids:
        delta = b_items[item_id]["score"] - a_items[item_id]["score"]
        if not math.isfinite(delta):
            fail(f"score delta for item {item_id!r} is not finite (values overflow or are too large).")
        deltas[item_id] = delta
    clusters = {}
    for item_id in ids:
        clusters.setdefault(a_items[item_id].get("cluster", item_id), []).append(deltas[item_id])
    units = list(clusters.values())
    if len(ids) * args.reps > MAX_RESAMPLED_UNITS:
        fail(f"requested bootstrap work is too large: {len(ids)} items x {args.reps} reps exceeds {MAX_RESAMPLED_UNITS} resampled item values. Reduce --reps or the evaluation set size.")
    unit_name = "clusters" if len(units) < len(ids) else "items"
    rng = random.Random(args.seed)
    means = []
    for _ in range(args.reps):
        flat = [delta for _unit in units for delta in rng.choice(units)]
        sample_mean = sum(flat) / len(flat)
        if not math.isfinite(sample_mean):
            fail("bootstrap sample overflowed; scores are too large.")
        means.append(sample_mean)
    means.sort()
    # Nearest-rank percentile: the 1-indexed rank ceil(p*reps) maps to the
    # 0-indexed value ceil(p*reps)-1. Using int() truncated toward the middle,
    # narrowing the interval (the anti-conservative direction) whenever p*reps
    # landed on an integer or fractional boundary.
    low = means[max(0, math.ceil(0.025 * args.reps) - 1)]
    high = means[min(args.reps - 1, max(0, math.ceil(0.975 * args.reps) - 1))]
    mean = statistics.fmean(deltas.values())
    if not math.isfinite(mean):
        fail("mean delta overflowed; scores are too large.")
    improved = sum(delta > 0 for delta in deltas.values())
    regressed = sum(delta < 0 for delta in deltas.values())
    print(f"n {len(ids)} items, resampled over {len(units)} {unit_name}, {args.reps} reps, seed {args.seed}")
    print(f"mean delta (b - a) {mean:+.4f}   95% interval [{low:+.4f}, {high:+.4f}]")
    print(f"improved {improved}  regressed {regressed}  held {len(ids)-improved-regressed}")
    print("interval includes zero: not distinguishable from noise on this fixture" if low <= 0 <= high else "interval excludes zero on this fixture (still subject to fixture validity and label error)")


if __name__ == "__main__":
    main()
