#!/usr/bin/env python3
"""Measure agreement between judge and human labels on a calibration set.

Input: JSON {"items":[{"id","label"}]}, JSONL, or CSV with id,label. IDs must be
unique non-empty strings. Labels must be strings in --labels (default pass,fail).
At least 50 shared IDs and 80% coverage of each file are required by default.

Exit 0 when kappa meets the floor, 1 when measured agreement is below it, and 2 when
the calibration cannot be measured safely.

Behavior change: labels are now restricted to the --labels set (default pass,fail);
a value outside it, or a non-string id, is CANNOT-MEASURE. For a multi-class rubric
pass every class via --labels (e.g. --labels A,B,C); for numeric ids, stringify them
in the file first (arbitrary numeric ids are no longer coerced silently).
"""
import argparse
import csv
import json
import math
import sys
from collections import Counter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")


def cannot(message):
    print(f"CANNOT-MEASURE: {message}", file=sys.stderr)
    sys.exit(2)


def load(path, allowed_labels):
    try:
        with open(path, encoding="utf-8-sig") as handle:
            text = handle.read().strip()
    except FileNotFoundError:
        cannot(f"file not found: {path}")
    except (OSError, UnicodeError) as exc:
        cannot(f"cannot read {path} as UTF-8 ({exc})")
    try:
        if text.lower().startswith("id,"):
            rows = list(csv.DictReader(text.splitlines()))
        else:
            try:
                data = json.loads(text)
                if isinstance(data, dict):
                    if "items" not in data:
                        raise TypeError("JSON object needs an 'items' array")
                    rows = data["items"]
                else:
                    rows = data
            except (json.JSONDecodeError, ValueError):
                rows = [json.loads(line) for line in text.splitlines() if line.strip()]
    except (json.JSONDecodeError, ValueError, KeyError, TypeError, csv.Error) as exc:
        cannot(f"{path} is not JSON/JSONL/CSV with id,label ({exc})")
    if not isinstance(rows, list):
        cannot(f"{path} items must be an array.")
    result = {}
    for row in rows:
        if not isinstance(row, dict):
            cannot(f"record {row!r} in {path} must be an object.")
        item_id, label = row.get("id"), row.get("label")
        if not isinstance(item_id, str) or not item_id.strip():
            cannot(f"record {row!r} in {path} needs a non-empty string 'id'.")
        if not isinstance(label, str) or label.strip().lower() not in allowed_labels:
            cannot(f"record {row!r} in {path} needs a string label in {sorted(allowed_labels)}.")
        if item_id in result:
            cannot(f"{path} contains duplicate item id {item_id!r}")
        result[item_id] = label.strip().lower()
    return result


def kappa(pairs):
    count = len(pairs)
    observed = sum(human == judge for human, judge in pairs) / count
    labels = set(human for human, _ in pairs) | set(judge for _, judge in pairs)
    human_counts = Counter(human for human, _ in pairs)
    judge_counts = Counter(judge for _, judge in pairs)
    expected = sum((human_counts[label] / count) * (judge_counts[label] / count) for label in labels)
    if math.isclose(expected, 1.0):
        cannot("Cohen's kappa is undefined because expected agreement is 1; the calibration labels are degenerate.")
    return observed, (observed - expected) / (1 - expected)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--human", required=True)
    parser.add_argument("--judge", required=True)
    parser.add_argument("--positive", default="pass")
    parser.add_argument("--labels", default="pass,fail", help="comma-separated allowed labels (default: pass,fail)")
    parser.add_argument("--floor", type=float, default=0.8, help="minimum Cohen's kappa (default: 0.8)")
    parser.add_argument("--min-coverage", type=float, default=0.8, help="minimum shared-ID fraction of each file (default: 0.8)")
    args = parser.parse_args()
    if not -1.0 <= args.floor <= 1.0:
        cannot("--floor must be between -1 and 1.")
    if not 0.0 < args.min_coverage <= 1.0:
        cannot("--min-coverage must be greater than 0 and at most 1.")
    allowed = {label.strip().lower() for label in args.labels.split(",") if label.strip()}
    if len(allowed) < 2:
        cannot("--labels must name at least two distinct labels.")
    positive = args.positive.strip().lower()
    if positive not in allowed:
        cannot("--positive must be one of --labels.")

    human, judge = load(args.human, allowed), load(args.judge, allowed)
    common = sorted(set(human) & set(judge))
    if len(common) < 50:
        cannot(f"only {len(common)} shared ids; a calibration set this small is anecdote, not agreement.")
    human_coverage = len(common) / len(human) if human else 0.0
    judge_coverage = len(common) / len(judge) if judge else 0.0
    if min(human_coverage, judge_coverage) < args.min_coverage:
        cannot(f"shared-id coverage is human {human_coverage:.1%}, judge {judge_coverage:.1%}; both must be at least {args.min_coverage:.1%}.")
    pairs = [(human[item_id], judge[item_id]) for item_id in common]
    if len({label for pair in pairs for label in pair}) < 2:
        cannot("calibration contains only one label; chance-corrected agreement is undefined.")
    observed, coefficient = kappa(pairs)
    true_positive = sum(h == positive and j == positive for h, j in pairs)
    false_positive = sum(h != positive and j == positive for h, j in pairs)
    false_negative = sum(h == positive and j != positive for h, j in pairs)
    precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else float("nan")
    recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else float("nan")
    missing = (set(human) | set(judge)) - set(common)
    print(f"n {len(common)} shared items" + (f" ({len(missing)} unmatched ids ignored after coverage check)" if missing else ""))
    print(f"coverage  human {human_coverage:.3f}   judge {judge_coverage:.3f}")
    print(f"human positive rate {sum(h == positive for h, _ in pairs)/len(pairs):.3f}   judge positive rate {sum(j == positive for _, j in pairs)/len(pairs):.3f}")
    print(f"raw agreement {observed:.3f}   (inflated by class imbalance; do not use for the decision)")
    print(f"Cohen's kappa {coefficient:.3f}   floor {args.floor}")
    print(f"judge PASS precision {precision:.3f}   recall {recall:.3f}   (vs human PASS)")
    disagreements = [item_id for item_id, pair in zip(common, pairs) if pair[0] != pair[1]]
    if disagreements:
        print("disagreements (first 20): " + ", ".join(disagreements[:20]))
    if coefficient >= args.floor:
        print("OK: judge meets the floor on this set; pin model + prompt hash in the manifest.")
        sys.exit(0)
    print("BELOW FLOOR: judge is a diagnostic, not a grader. Inspect disagreements, fix rubric or guideline, re-run on the held-out slice.")
    sys.exit(1)


if __name__ == "__main__":
    main()
