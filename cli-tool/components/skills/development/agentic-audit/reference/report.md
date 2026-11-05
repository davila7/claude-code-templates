# Reading the audit report

## Labels

| Label | Meaning |
|---|---|
| Measured | Observed directly in this run. |
| Inferred | Derived from measurements (for example coverage overlap). Needs review before acting. |
| Unverified | Based on one sample or incomplete evidence. |
| Not assessed | No evidence collected (mode, budget, or missing tooling). |

## Mutant statuses

| Status | Meaning |
|---|---|
| killed | A test that passed in every baseline run failed or errored with the mutant applied. |
| survived | The mutant compiled, its first line executed (activation check), and no covering test failed. |
| uncovered | No in-scope test covers the mutated lines; not executed. |
| not_activated | Tests ran but the mutated line never executed (mocks, alternative imports, subprocesses). Not a gap. |
| invalid | Does not compile, or tests cannot be collected/imported. Not a kill. |
| timeout | Ran longer than 10x the expected time plus 10 s. |
| infrastructure_failure | pytest crashed or returned an unexpected exit code. |
| activation_unknown | The activation monitor was unavailable. |

## Populations

- **classical**: mutmut's operators (comparisons, constants, arithmetic, arguments).
- **deletion**: whole-function body replaced with `return None` or a constant matching the
  return annotation (`body:<value>`), and single call statements replaced with `pass`
  (`call-delete`).

The two are reported separately and never combined into one score.

## Detection rate

`K / (K + S + U)`: killed over killed, survived and uncovered. Other statuses are excluded
from the ratio and counted beside it. The rate describes this sample of mutants only. It is
not a percentage of real bugs caught.

## Candidate pseudo-tested function

Every body replacement of the function ran, executed, and survived, under the tests that
cover it. One surviving replacement alone does not earn this label. A function whose body
replacements were all killed can still contain calls that nobody checks: see the
`removed-calls` finding.

## Weak tests

A test that ran against at least five valid, activated mutants and failed on none of them. It
executes code without checking what that code does, or checks only things the mutants did not
change. *Inferred*, because the mutants are a sample.

## Removal candidates and prune-check

The deep audit picks, jointly, a set of tests whose removal keeps every observed kill and every
covered line: for each killed mutant one of its killers stays, and for each covered line one
test that runs it stays, preferring fast tests. The set is fitted to the audit's own mutants, so
it is *inferred*. `prune-check` then runs mutants on every line the set's tests run, excluding
the audit's mutants, against the whole suite:

- `refuted`: some mutant is killed only by tests in the set, or some line is run only by them.
- `not refuted`: no kill lost among K killed mutants. The approximate 95% upper bound on the
  share of kills the removal loses is 3/K. This is evidence, not proof.

Tests marked `protected` in `test-suite-audit.toml` are never proposed.

## Verify verdicts

| Verdict | Meaning |
|---|---|
| verified | Every changed executable line ran under a test, and every mutant on the changed lines was killed. Relative to these mutants only. |
| gaps | Changed lines not run, surviving mutants, or a suite that failed, varied or depended on order. |
| incomplete | The budget ended before every mutant of the changed lines ran. |
| no change | No source line changed since the base revision. |

## Findings you should not make from this report

- "Tests A and B are redundant" from overlap alone.
- "This mutant is equivalent" without human review.
- "The suite catches N% of bugs."
- Savings from summing test durations. Only paired wall-time runs show a speed-up.
- "These tests are safe to delete." At most: "prune-check did not refute removing them".
- "This change is correct." At most: "the tests catch every mutant of the changed lines".
