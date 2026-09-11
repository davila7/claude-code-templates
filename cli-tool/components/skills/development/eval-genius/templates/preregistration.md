# Pre-registration

Filled before the first run. Committed next to the fixture. Quoted verbatim at the top
of the report. Nothing below changes after a number has been seen; a change is a new
pre-registration with a new id.

- **Id:** prereg-YYYYMMDD-short-name
- **Author / date:**

## Promise
One plain sentence a non-expert understands. What does the system promise, and what
does "better" mean for it?

>

## Variables
| Kind | Name | Values / definition |
|---|---|---|
| Lever | | (exactly one per comparison) |
| Outcome (primary) | | metric, direction, unit |
| Outcome (secondary) | | |
| Outcome (cost/latency) | | tokens per item, cost per pass, p95 ms |
| Controls | | fixture hash, model snapshot, judge snapshot, seeds, clock, harness version |

## Placement and weight
- Where this measurement sits (decision point / risky seam / public claim):
- Instrument (spot check / eval / benchmark / monitor):
- Tier (smoke / gate / nightly / release):

## Baseline
- Baseline run id and manifest (if no run exists yet: "current production config,
  to be run first on this fixture", or the stated floor for a brand-new system):
- Fixture version and hash:

## Bar (acceptance rule)
Written as a rule the reporter can apply mechanically. Examples: "no per-item
regressions on the deterministic layer"; "paired 95% interval on primary delta excludes
values below -0.01"; "p95 latency not above baseline +10%".

>

## Falsifier
The result that would show the change is useless or harmful, and what will be
concluded and done if it appears.

>

## Outlier rule
How a single item that dominates the aggregate is handled (cap / exclude with
disclosure / report separately). Decided now.

>

## Noise floor
How many repeated runs on the same commit establish run-to-run spread before a delta
is claimed, and the minimum detectable effect the fixture size supports.

>

## Judged layer (if any)
- Judge model and snapshot:
- Rubric version and prompt hash:
- Calibration set version, human agreement, judge-vs-human agreement on held-out slice:
- Floor for the judge to count as a grader:

## Negative control
The known-bad case the gate must fail on every run.

>
