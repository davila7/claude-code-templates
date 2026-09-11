# Eval report

## 1. Pre-registration (quoted verbatim)
> id, promise, lever, primary outcome, bar, falsifier, outlier rule, baseline

## 2. Runs
| Arm | Run id | Fixture hash | Liveness | Outcome | Errors / budget |
|---|---|---|---|---|---|
| baseline | | | | | |
| treatment | | | | | |

Negative control: failed on both runs (yes / no). If no, stop here: CANNOT-MEASURE.

## 3. Results, per layer (never blended)

**Deterministic layer**
| Metric | Baseline | Treatment | Paired delta | 95% interval | Improved / regressed / held (items) | n |
|---|---|---|---|---|---|---|

**Judged layer** (judge snapshot, prompt hash, human agreement on held-out slice)
| Metric | Baseline | Treatment | Paired delta | 95% interval | n |
|---|---|---|---|---|---|

**Cost and latency**
| Metric | Baseline | Treatment | Delta |
|---|---|---|---|
| tokens per item | | | |
| cost per pass | | | |
| p50 / p95 ms | | | |

**Per-stratum** (if stratified): one row per stratum for the primary metric.

## 4. Noise floor
Repeated runs on the same commit: k runs, spread of the primary metric.

## 5. Decision against the bar
Bar as written. Result. Decision: accept / reject / cannot measure. Falsifier
triggered: yes / no, and what was concluded.

## 6. Caveats that weaken the number
Self-run or independent. Subset, snapshot, sample size. Label-error ceiling. Judge
agreement. Anything the pre-registration said would matter.

## 7. Tier labels
Every number above is tagged measured / estimated / aspirational. List any estimated or
aspirational number here so none hides in a table.

## 8. Attack findings
What an independent reader tried in order to break this, and what they found.

## 9. What happens next
Baseline promotion (with reason) / system fix / gauge fix / retire benchmark.
