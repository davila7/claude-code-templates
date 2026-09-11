#!/usr/bin/env python3
"""Compare a treatment run against a baseline run, per item, with a three-way outcome.

Exit codes (CI must honor all three):
  0  PASS            bar met on the same fixture with a live treatment arm
  1  FAIL            ran correctly, bar not met
  2  CANNOT-MEASURE  fingerprint mismatch, missing items, error budget blown,
                     liveness failed, negative control passed, bad input

Input: two files, each JSON {"manifest": {...}, "items": [{"id", "verdict", ...}]} or
JSONL whose first line is {"manifest": {...}} followed by one item record per line.
  manifest.fixture_hash        required, must match between runs
  manifest.liveness            required on treatment: "passed" | "failed" | "not-applicable"
  manifest.negative_control_id required unless --no-negative-control; both manifests must
                               name the same id, which must fail in both runs
  items[].id                   required non-empty string, unique within each run
  items[].verdict              "pass" | "fail" | "error"

Usage:
  check_gate.py --baseline base.json --treatment treat.json [--tolerance 0.0]
                [--error-budget 0.02] [--max-regressions 0] [--layer deterministic]
                [--no-negative-control]
  --tolerance          allowed drop in pass rate (0.0 = no aggregate regression)
  --max-regressions N  fail if more than N items flip pass->fail (default 0)
  --no-negative-control  waive the mandatory negative control (record the reason
                       in the pre-registration)

Behavior changes (stricter than earlier versions; each is CANNOT-MEASURE, never a
silent PASS, so an archived pair can flip from scored to refused):
  - the error budget applies to BOTH arms; a baseline over budget is refused too.
  - negative_control_id must match between the two manifests (a one-sided control
    is no longer honored).
  - duplicate item ids are refused; ids must be unique within each run.
"""
import argparse
import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

PASS, FAIL, CANNOT = 0, 1, 2


def die(msg, code=CANNOT):
    print(f"CANNOT-MEASURE: {msg}" if code == CANNOT else msg, file=sys.stderr)
    sys.exit(code)


def load(path, role):
    try:
        with open(path, encoding="utf-8") as handle:
            text = handle.read().strip()
    except FileNotFoundError:
        die(f"{role} file not found: {path}. Pass the per-item results JSON written by the scorer.")
    except (OSError, UnicodeError) as exc:
        die(f"cannot read {role} file {path} as UTF-8 ({exc}).")
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        try:
            lines = [json.loads(line) for line in text.splitlines() if line.strip()]
            first = lines[0]
            if not isinstance(first, dict):
                raise TypeError("first JSONL record must be an object")
            data = {"manifest": first.get("manifest", first), "items": lines[1:]}
        except (json.JSONDecodeError, ValueError, IndexError, TypeError, AttributeError) as exc:
            die(f"{role} file {path} is neither JSON {{'manifest','items'}} nor JSONL (manifest line then item lines) ({exc}).")
    if not isinstance(data, dict) or "manifest" not in data or "items" not in data:
        die(f"{role} file {path} must be an object with 'manifest' and 'items' keys.")
    if not isinstance(data["manifest"], dict):
        die(f"{role} manifest must be an object.")
    if not isinstance(data["items"], list):
        die(f"{role} items must be an array.")
    if "fixture_hash" not in data["manifest"]:
        die(f"{role} manifest has no 'fixture_hash'. Every run must record the fixture content hash; a run without one cannot be compared.")
    fixture_hash = data["manifest"]["fixture_hash"]
    if not isinstance(fixture_hash, str) or not fixture_hash.strip():
        die(f"{role} fixture_hash must be a non-empty string.")
    seen = set()
    for item in data["items"]:
        if not isinstance(item, dict):
            die(f"{role} item {item!r} must be an object.")
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id.strip():
            die(f"{role} item {item!r} needs a non-empty string 'id'.")
        if item.get("verdict") not in ("pass", "fail", "error"):
            die(f"{role} item {item!r} needs a verdict in pass|fail|error.")
        if item_id in seen:
            die(f"{role} contains duplicate item id {item_id!r}. Duplicate ids make per-item comparison ambiguous.")
        seen.add(item_id)
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--treatment", required=True)
    parser.add_argument("--tolerance", type=float, default=0.0)
    parser.add_argument("--max-regressions", type=int, default=0)
    parser.add_argument("--error-budget", type=float, default=0.02)
    parser.add_argument("--layer", default=None, help="only compare items whose 'layer' field equals this")
    parser.add_argument("--no-negative-control", action="store_true", help="waive the mandatory negative control (state the reason in the pre-registration)")
    args = parser.parse_args()

    if not 0.0 <= args.tolerance <= 1.0:
        die("--tolerance must be between 0 and 1.")
    if args.max_regressions < 0:
        die("--max-regressions must be zero or greater.")
    if not 0.0 <= args.error_budget <= 1.0:
        die("--error-budget must be between 0 and 1.")

    base, treat = load(args.baseline, "baseline"), load(args.treatment, "treatment")
    baseline_hash = base["manifest"]["fixture_hash"]
    treatment_hash = treat["manifest"]["fixture_hash"]
    if baseline_hash != treatment_hash:
        die(f"fixture fingerprint mismatch: baseline={baseline_hash} treatment={treatment_hash}. Runs on different fixtures are not comparable; re-run both on one fixture.")

    live = treat["manifest"].get("liveness")
    if live not in ("passed", "not-applicable"):
        die(f"treatment liveness is {live!r}; must be 'passed' or 'not-applicable'. Assert the arm under test is active before scoring.")

    # If a judged layer is present, the two runs must share the same judge instrument.
    # Comparing runs graded by different judge prompts or models is fixture drift in
    # the grader. Checked only when both manifests declare the field; absent = skip.
    base_judge = base["manifest"].get("judge") or {}
    treat_judge = treat["manifest"].get("judge") or {}
    for field in ("prompt_hash", "model_snapshot"):
        b_val, t_val = base_judge.get(field), treat_judge.get(field)
        if b_val is not None and t_val is not None and b_val != t_val:
            die(f"judge {field} differs: baseline={b_val!r} treatment={t_val!r}. "
                "Re-grade both arms with one pinned judge before comparing the judged layer.")

    baseline_all = {item["id"]: item for item in base["items"]}
    treatment_all = {item["id"]: item for item in treat["items"]}
    baseline_control = base["manifest"].get("negative_control_id")
    treatment_control = treat["manifest"].get("negative_control_id")
    if baseline_control != treatment_control:
        die(f"negative_control_id mismatch: baseline={baseline_control!r} treatment={treatment_control!r}. Both arms must exercise the same control.")
    control = baseline_control
    if not control and not args.no_negative_control:
        die("no negative_control_id in either manifest. Every gate run must include a known-bad item that the scorer fails; add one, or pass --no-negative-control to waive it with a written reason in the pre-registration.")
    if control:
        if not isinstance(control, str) or not control.strip():
            die("negative_control_id must be a non-empty string.")
        if control not in baseline_all or control not in treatment_all:
            die(f"negative control item {control!r} must be present in both runs.")
        if baseline_all[control]["verdict"] != "fail" or treatment_all[control]["verdict"] != "fail":
            die(f"negative control {control!r} did not fail (baseline={baseline_all[control]['verdict']}, treatment={treatment_all[control]['verdict']}). The scorer is not catching a known-bad case; nothing else in this run is trusted.")

    baseline_items = {item_id: item for item_id, item in baseline_all.items()
                      if item_id != control and (args.layer is None or item.get("layer") == args.layer)}
    treatment_items = {item_id: item for item_id, item in treatment_all.items()
                       if item_id != control and (args.layer is None or item.get("layer") == args.layer)}
    if not baseline_items or not treatment_items:
        die("no scored items remain to compare (check --layer and the negative control).")
    if set(baseline_items) != set(treatment_items):
        only_base = sorted(set(baseline_items) - set(treatment_items))[:5]
        only_treat = sorted(set(treatment_items) - set(baseline_items))[:5]
        die(f"item id sets differ (baseline-only e.g. {only_base}, treatment-only e.g. {only_treat}). Both runs must cover the same items.")

    item_count = len(treatment_items)
    baseline_errors = sum(item["verdict"] == "error" for item in baseline_items.values())
    treatment_errors = sum(item["verdict"] == "error" for item in treatment_items.values())
    for role, errors in (("baseline", baseline_errors), ("treatment", treatment_errors)):
        if errors / item_count > args.error_budget:
            die(f"{errors}/{item_count} {role} items errored ({errors/item_count:.1%}) > error budget {args.error_budget:.1%}. Fix the harness; a run with holes is not a scored run.")

    improved = sorted(item_id for item_id in treatment_items
                      if baseline_items[item_id]["verdict"] != "pass" and treatment_items[item_id]["verdict"] == "pass")
    regressed = sorted(item_id for item_id in treatment_items
                       if baseline_items[item_id]["verdict"] == "pass" and treatment_items[item_id]["verdict"] != "pass")
    baseline_rate = sum(item["verdict"] == "pass" for item in baseline_items.values()) / item_count
    treatment_rate = sum(item["verdict"] == "pass" for item in treatment_items.values()) / item_count

    print(f"fixture {treatment_hash}  items {item_count}  errors baseline {baseline_errors} treatment {treatment_errors}")
    print(f"pass rate  baseline {baseline_rate:.4f}  treatment {treatment_rate:.4f}  delta {treatment_rate-baseline_rate:+.4f}")
    print(f"improved {len(improved)}  regressed {len(regressed)}  held {item_count-len(improved)-len(regressed)}")
    if regressed:
        print("regressed ids: " + ", ".join(regressed[:20]) + (" ..." if len(regressed) > 20 else ""))
    if len(regressed) > args.max_regressions:
        print(f"FAIL: {len(regressed)} regressions > allowed {args.max_regressions}")
        sys.exit(FAIL)
    if treatment_rate < baseline_rate - args.tolerance:
        print(f"FAIL: pass rate dropped {baseline_rate-treatment_rate:.4f} > tolerance {args.tolerance}")
        sys.exit(FAIL)
    print("PASS")
    sys.exit(PASS)


if __name__ == "__main__":
    main()
