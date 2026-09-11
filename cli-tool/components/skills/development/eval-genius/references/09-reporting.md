# Reporting: honesty is the deliverable

The report is where the eval becomes a claim. A report that flatters is worse than no
report, because it will be believed. Write the report that survives the hostile reader.

## Pre-registration is the first half of the report

The report begins by quoting the pre-registration verbatim (`templates/preregistration.md`):
promise, variables, placement, weight, bar, falsifier, outlier rule, baseline. Then it
shows the result against that bar. A reader can see at once whether the goalposts
moved.

## Tier every number

| Tier | Meaning | Example |
|---|---|---|
| **Measured** | Produced by a run with a manifest | "recall@5 0.71 ± 0.03, n=400, manifest r-2031" |
| **Estimated** | Derived, extrapolated, or from a smaller sample | "roughly 30% cost reduction, from 20 sampled items" |
| **Aspirational** | A target, not a result | "aiming for p95 under 1.5 s" |

Never sum or average across tiers. A measured number and an estimated number in the
same sentence get their labels.

## Separate the layers

Deterministic pass rate and judged score are reported in separate lines with separate
denominators, intervals, and n. Cost and latency get their own lines. A blended
"quality score" is a refusal to say which half moved.

## Disclose what weakens the number

- The conservative setup, older snapshot, small sample, or subset used.
- Whether the benchmark is **self-run** or independent. Self-run benchmarks are
  evidence, not market validation.
- The harder metric, even when the easier one looks better.
- Label-error ceiling of the fixture, so the reader knows the cap.
- Judge agreement with humans, so the reader knows how much the judged layer means.
- Anything the falsifier said would matter, and whether it happened.

The disclosure is what makes the number believable. A report with no caveats reads as
a report where nobody looked.

## Comparability rule

Two numbers may sit side by side only when fixture hash, harness version, judge
version, and metric definition match. Otherwise they appear in separate tables with a
note, or the older one is re-run.

## Negative and null results

A change that did nothing is a result. Report it with the same manifest and interval,
and record what was concluded from the falsifier. Null results retired in silence get
re-attempted by the next person.

## Retiring a benchmark

A benchmark is retired when it saturates (leading systems near the ceiling), when its
label-error ceiling is found to be above the deltas being chased, when it is
contaminated, or when the promise it measured no longer matters. Retirement is a
written note: what it measured, why it stopped being useful, what replaces it, and the
last comparable numbers. Kill darlings on evidence, in writing.

## Attack it before shipping it

Before a number goes public, someone who did not build the system tries to break the
benchmark's logic: find an item that passes for the wrong reason, an offset regression
the aggregate hides, a fixture drift, a judge bias. Findings go in the report. A
number that has survived an attack is worth more than one that has only been admired.

## Template

`templates/eval-report.md` carries the structure: pre-registration quoted, manifest
reference, per-layer results with intervals, per-item flip summary, cost and latency,
caveats, tier labels, decision, and what happens next.

## Output of this file

A report where the reader can find the bar before the result, the tier of every
number, the layers separated, the caveats that weaken the claim, and a decision that
follows from the pre-registered rule.
