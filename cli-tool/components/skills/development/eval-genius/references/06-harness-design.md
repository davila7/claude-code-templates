# Harness design: the runner nobody has to trust

The harness is the instrument. Every rule here exists because a harness once produced a
confident number about something it never ran. Design it so that a wrong number is
structurally hard to produce and easy to detect.

## Architecture: four parts, one seam each

```
fixture  ->  runner  ->  scorer  ->  reporter
(items,      (calls the    (grades each   (aggregates, diffs
 labels,     system,       item, emits    against baseline,
 manifest)   captures      per-item       decides PASS / FAIL /
             raw output)   verdicts)      CANNOT-MEASURE)
```

- **Fixture** is data plus a manifest with a content hash. It is never mutated by a run.
- **Runner** produces raw outputs and a run manifest. It knows nothing about scoring.
- **Scorer** takes raw outputs and labels, emits one record per item. It knows nothing
  about the system under test.
- **Reporter** reads per-item records from two runs and produces the comparison. It
  knows nothing about how outputs were produced.

The separation means a scorer bug is fixed and re-applied to stored raw outputs without
re-running the system, and a runner change cannot quietly alter grading.

## Standardize the seams, not the harness

The four-part architecture is a contract, not a prescribed framework. A RAG eval may
need a frozen corpus and retrieval trace; a coding agent may need a disposable container
and hidden tests; a customer-support agent may need a simulated conversation and final
CRM state. Build the runner and scorer that exercise the real mechanism. Do not force
all three through one provider SDK or one generic text-in/text-out loop.

Whatever the use case, keep these portable seams:

- fixture items have stable, unique ids and an immutable content hash;
- the runner stores raw output, trace or state evidence before scoring;
- the scorer emits one record per id and can abstain or error without calling it a fail;
- the reporter consumes records rather than calling the system;
- baseline and treatment use the same adapter, budget, timeout and item order policy;
- cache mode, retries, concurrency and provider/model identity are explicit in the manifest.

Existing eval tools can implement any seam. Reuse their provider adapters, task
registries, metrics or trace capture when they fit; preserve this record contract around
them so the comparison and gate remain auditable.

## Per-item records, not aggregates

The scorer emits one record per item:

```json
{"id": "q-0042", "verdict": "pass", "score": 1.0, "layer": "deterministic",
 "expected": "...", "actual": "...", "latency_ms": 812, "tokens_in": 1930,
 "tokens_out": 74, "error": null}
```

Aggregates are computed by the reporter from these records. A mean without the
per-item records cannot be diffed, cannot be bisected, and cannot be audited. A gate
compares per-item, because an aggregate can hold steady while ten items collapse and
ten improve.

## Three-way outcome

Every run ends in exactly one of:

| Outcome | Meaning | Exit code |
|---|---|---|
| **PASS** | Ran on the intended fixture with the intended arm; bar met | 0 |
| **FAIL** | Ran correctly; bar not met | 1 |
| **CANNOT-MEASURE** | Anything that prevents a valid comparison | 2 |

CANNOT-MEASURE is raised for: harness crash, system crash on more than a pre-set
fraction of items, fixture fingerprint mismatch with the baseline, missing baseline,
treatment-arm liveness check failed, judge version mismatch, timeout on setup. It is
never collapsed into FAIL (which would block a good change for a broken gauge) and
never into PASS (which would ship a regression behind a crashed harness).

`scripts/check_gate.py` implements this contract over two per-item JSON files.

CI must treat exit 2 as "gate could not run" and surface it, not as green. A common
real-world failure: a runner exits 0 after a setup timeout, the pipeline reads green,
and a batch of errored tasks is reported as clean. Read the per-item error field, never
the runner's own "done" log.

## Fixture fingerprint

The run manifest records the fixture content hash. The reporter refuses to compare two
runs whose fingerprints differ, with a message naming both hashes. Comparing across
corpora, caches, or snapshots is the most common way teams see an effect that is
really a changed condition. A refused comparison is a feature.

## Treatment-arm liveness

Before the first item, the runner asserts that the arm under test is active: the flag
is set, the config is loaded, the model identifier in the response matches the
intended one, the feature's own instrumentation reports on. On failure the run ends
CANNOT-MEASURE. Silent misconfiguration produces a confident, fake comparison, and it
is common enough to deserve a dedicated check rather than a hope.

## The cache trap

Benchmarks are usually run against pre-built caches, indexes, or snapshots because
building them is slow. That means the write path is never exercised: a change that
corrupts what gets written (a zeroed vector, a dropped field) passes every cached
benchmark. Any gate protecting a system with a write path includes at least one
fresh-build run from raw inputs, on a schedule appropriate to its cost.

## Reproducibility

- **Temperature zero is not determinism.** On a shared inference server, output depends
  on batch composition through the order of floating-point reductions in the kernels.
  The same prompt run twice is itself a noisy measurement. Either pin the serving
  stack and batch configuration, or treat repeated runs as the unit and report spread.
- **Seeds.** Every random choice (sampling, split, item order, judge ordering) is
  seeded and the seed is in the manifest.
- **Fixed clock.** Any time-dependent logic (recency boosts, expiry) receives an
  injected clock during the run; wall-clock reads make yesterday's baseline
  incomparable.
- **Single-thread for equality runs.** When the check is bit-for-bit equality, disable
  parallelism that changes reduction or merge order.
- **Pinned everything.** Model snapshot string, judge snapshot string, harness version,
  dependency lockfile hash, hardware class.

## Run manifest

Written at the start of the run, completed at the end. Template in
`templates/run-manifest.json`. Minimum fields: run id, timestamp, fixture hash,
fixture version, arm name and liveness result, system version or commit, model
snapshot, judge snapshot and prompt hash, seeds, harness version, environment
summary, item count, error count, outcome, and cost/latency totals.

Without the manifest a number cannot be reproduced or audited, and an unreproducible
number is an anecdote.

## Timeouts and partial failure

- Per-item timeout, recorded as an item error, not as a fail-by-default score unless
  the pre-registration says timeouts count as failures (for agents it usually should).
- Setup timeout ends the run CANNOT-MEASURE.
- A pre-set error budget (say 2% of items) above which the run is CANNOT-MEASURE
  rather than a scored run with holes.

## Reporter checks before it prints a number

1. Fingerprints match.
2. Both runs have the same item ids.
3. Error counts within budget.
4. Liveness passed on the treatment run.
5. Judge versions match (if a judged layer exists).
6. The negative-control item (a known-bad case) failed on both runs. A scorer that
   passes the known-bad case is broken, and the run is CANNOT-MEASURE.

Then, and only then, the per-item diff and the aggregate.

## Output of this file

A harness where fixture, runner, scorer, and reporter are separate; per-item records;
a three-way exit; fingerprint refusal; a liveness assertion; a negative control; a
run manifest; and a fresh-build run somewhere in the schedule.
