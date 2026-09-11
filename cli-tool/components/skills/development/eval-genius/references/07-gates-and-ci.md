# Gates and CI: making the eval block the merge

A gate is an eval with the power to say no. That power is only worth having if the
gate is trusted, and a gate is trusted only when it is fast enough to run, honest about
when it could not run, and impossible to argue with after the fact.

## Tiers

| Tier | Runs on | Budget | Content | On failure |
|---|---|---|---|---|
| **Smoke** | Every commit | Under a minute, no paid calls | Deterministic subset, negative control, liveness | Block |
| **Gate** | Every pull request | Minutes, small paid budget | Full deterministic layer on the held-out set; judged layer on a fixed sample | Block |
| **Nightly** | Scheduled | Up to an hour, moderate budget | Full judged layer, repeated trials, fresh-build run, cost and latency | Alert, block release |
| **Release** | Before a version ships | Whatever it costs | Everything, plus any adopted public benchmark | Block ship |

Anything that cannot fit a tier's budget moves up a tier; nothing is dropped silently.
The tier a check runs in is written next to the check.

## What a gate compares

Per-item, against a committed baseline, on the same fixture fingerprint. The rule is
written in the pre-registration and looks like one of:

- **No regressions:** no item that passed in baseline fails now, tolerance zero. Strict
  and right for deterministic layers.
- **Aggregate with tolerance:** metric not below baseline minus a stated tolerance, and
  the per-item diff attached so a masked collapse is visible.
- **Interval rule:** the paired confidence interval on the delta excludes a regression
  larger than the stated tolerance (`08-statistics.md`).

A gate rule with no per-item diff is a gate that can be fooled by offsetting changes.

## Baseline lifecycle

- **Lives in the repo**, versioned, as per-item records plus the manifest, next to the
  fixture hash it was produced on.
- **Promotion** is a deliberate commit with a written reason: "baseline updated after
  change X; delta +0.031 recall@5, 0 regressions, manifest attached." Nobody promotes a
  baseline in the same change that needed it to pass.
- **Re-baseline** whenever the fixture, the judge, or the harness version changes,
  because the old numbers are no longer comparable. Say so in the commit.
- **Never edit** a baseline by hand.

## Flake policy

A flaky gate is a broken gate. Retries hide regressions and train people to ignore red.

1. Measure run-to-run variance on the same commit first (`08-statistics.md`). If the
   variance exceeds the tolerance, the gate is not yet a gate; move the noisy items to
   nightly with repeated trials, or widen the tolerance with a written reason.
2. Allow at most one automatic retry, only for CANNOT-MEASURE outcomes (infrastructure
   failures), never for FAIL.
3. Quarantine an item that flips on identical inputs, with an issue and a deadline.
   Quarantine is visible in the report, not silent.

## Verifier verification, wired in

Every gate run includes a negative control: an item known to be bad (a deliberately
wrong output, a corrupted fixture entry, a disabled feature). The gate must fail it. If
the negative control passes, the scorer is broken, the run is CANNOT-MEASURE, and
nothing else the run says is trusted. This is the cheapest check in the system and the
one that catches "the gate has been green for a month because it grades nothing."

## Triage when the gate fails

1. **Read the outcome.** CANNOT-MEASURE is an infrastructure or fixture problem; fix the
   gauge, do not touch the system.
2. **Read the per-item diff.** Which items flipped, in which direction, in which
   stratum. Ten flips in one category is a real effect; ten flips scattered at random
   on a noisy judge is variance.
3. **Reproduce one flipped item by hand** before believing the aggregate.
4. **Bisect** on the lever if the change contains more than one.
5. **Decide: fix the system, fix the gauge, or accept with a written reason and a
   baseline promotion.** Never the fourth option, which is loosening the bar until
   green.

## Cost and latency gates

Quality gates that ignore cost let a change ship that doubles the bill. Add:

- Tokens per item and cost per pass, with a tolerance.
- p95 latency, with a tolerance.

Both are per-item records already, so they ride the same diff.

## Anti-patterns specific to gates

- **Green by crash.** Runner exits 0 after a setup failure; CI reads green.
- **Retry until green.** Any retry of a FAIL.
- **Baseline drift.** Baseline promoted in the same PR that needed it.
- **Gate-set tuning.** Prompts iterated against the held-out set.
- **Silent tier drop.** A slow check removed from the gate and added nowhere.

## Output of this file

A gate definition: tier, fixture hash, comparison rule, tolerance, baseline location
and promotion rule, flake policy, negative control, cost/latency limits, and the exit
code contract CI honors.

## CI shell contract

A gate command has three meaningful exits. CI must preserve all of them even though
the job UI ultimately shows only success or failure:

```bash
set +e
python3 path/to/check_gate.py --baseline "$BASELINE" --treatment "$TREATMENT"
code=$?
set -e
case "$code" in
  0) echo "PASS: the measured bar was met" ;;
  1) echo "FAIL: the run was valid and the bar was missed"; exit 1 ;;
  2) echo "CANNOT-MEASURE: the instrument or comparison was invalid"; exit 2 ;;
  *) echo "CANNOT-MEASURE: unexpected gate exit $code"; exit 2 ;;
esac
```

In the project that integrates the gate, store the per-item records and manifest as CI
artifacts on every outcome. A red job without the records cannot distinguish a product
regression from a broken gauge. The skill repository's own workflow tests the utilities;
it does not produce system-under-test run artifacts.
