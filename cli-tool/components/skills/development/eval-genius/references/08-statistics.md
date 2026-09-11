# Statistics: is the delta real

An eval score is a sample statistic. The items are a draw from a larger population of
possible items, and the model's output on each is itself a draw. Treat the score the
way any other measurement is treated: with an interval, a paired design, and a sample
size chosen before the run.

## Report an interval with every number

A point estimate without spread is not a result. The minimum is a standard error or a
95% interval next to every aggregate, computed from the per-item records.

For a pass rate p over n independent items, the standard error is roughly
sqrt(p(1-p)/n). Table for orientation, 95% interval half-width:

| n | p = 0.5 | p = 0.9 |
|---|---|---|
| 50 | ±0.14 | ±0.08 |
| 200 | ±0.07 | ±0.04 |
| 1000 | ±0.03 | ±0.02 |

A "+2 points" improvement on 200 items is inside the noise. Say so.

## Paired comparisons

When two arms run on the same items, compare per item and analyze the differences.
Paired analysis removes item difficulty from the noise and is far more powerful than
comparing two unpaired means. The per-item records the harness already emits are the
input.

`scripts/paired_bootstrap.py` takes two per-item files, matches on id, and reports the
mean delta with a bootstrap 95% interval and the count of items that improved,
regressed, and held. The decision rule from the pre-registration is applied to the
interval, not to the point estimate.

## Clustering

Items are often not independent: several questions per document, several tasks per
repository, several turns per conversation. Naive standard errors on clustered items
have been measured at a third of the true value. When items share a parent, compute
the interval over parents (cluster bootstrap: resample parents, not items) or report
the cluster count as the effective n.

## Sample size and minimum detectable effect

Decide the smallest effect worth acting on, then size the set so it can be seen. Rule
of thumb for a paired pass/fail comparison where items flip with rate f: to detect a
net shift of d with reasonable power, n is on the order of 8·f/d². A 2-point shift
with 10% of items flipping needs roughly 2000 items; a 10-point shift needs about 80.
If the set cannot be that large, either accept a coarser detectable effect in writing
or repeat runs and pool.

## Repeated runs

The same prompt twice is a noisy measurement (`06-harness-design.md`). For any judged
or sampled layer:

- Run the same commit k times before trusting a delta; the run-to-run spread is the
  noise floor. A delta smaller than the noise floor is not a result.
- Report per-run aggregates and their spread, not only the pooled mean.
- For agents, report pass^k (all k trials succeed) next to pass@k (any succeeds). The
  first is what a user experiences.

## Multiple comparisons and "run until green"

Testing many variants, many metrics, or the same variant many times inflates the
chance that something looks significant by luck. Mitigations:

- Pre-register the primary metric and treat the others as secondary.
- When many comparisons are unavoidable, tighten the threshold (divide the significance
  level by the number of comparisons, or report which of many the winner was).
- Repeating a noisy gate until one run passes is the same inflation by another name.
  It is prohibited in `07-gates-and-ci.md`.

## Aggregation rules

- **Mean** for pass rates and scores where every item weighs equally.
- **Median** and **p95** for latency and cost; means hide tails.
- **Per-stratum reporting** whenever the fixture is stratified; a flat mean over
  unequal strata is weighted by whatever the sampling happened to be.
- **Outlier rule** from the pre-registration, applied as written: cap, exclude with
  disclosure, or report separately. Never decided after seeing which item dominates.
- **Per-layer**, always. Deterministic and judged scores are never blended.

## What "significant" buys

An interval excluding zero means the delta is unlikely to be noise on this fixture.
It says nothing about whether the fixture measures the promise (`01-foundation.md`),
whether the labels are right (`05-dataset-construction.md`), or whether the effect
will hold on live traffic. Statistical significance is the entry ticket, not the
verdict.

## Output of this file

Every reported number carries an interval; every two-arm comparison is paired with a
bootstrap interval and per-item flip counts; clustered items are handled; the sample
size was chosen from a stated minimum detectable effect; repeated runs establish the
noise floor before any delta is claimed.
