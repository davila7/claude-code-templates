---
name: agentic-audit
description: Audit a Python/pytest test suite as a verification tool. Does it catch broken code (mutants and deleted behaviour no test notices, tests that catch nothing)? Is it fast and deterministic enough to run after every change (slow, flaky and order-dependent tests)? Is it bloated (tests that can be removed together without losing any detection, checked on fresh mutants)? Use when the user asks to audit, review, speed up, prune or strengthen their tests, or asks which tests are useful. Report-only.
argument-hint: "quick | deep [--budget-minutes N] [--max-mutants N] [path]"
---

# Audit a test suite

Arguments: `$ARGUMENTS`. The first word is the mode: `quick` (default) or `deep`. Anything
else goes to the runner. To check a single change rather than the whole suite, use the
`agentic-verify` skill instead.

An agent can only be trusted as far as the checks it runs. This skill measures whether a test
suite is a good check: whether it would notice broken code, whether it is fast and stable enough
to run on every change, and which tests cost time without adding detection.

## Runner

```bash
AV='uvx --from git+https://github.com/timini/agentic-verification@v0.3.0#subdirectory=runner agentic-verification'
$AV quick|deep <path> [--budget-minutes N]
$AV prune-check <path> --tests-file <file> --from-run <run-dir>
$AV replay --run <run-dir> --mutant <id>
```

The runner works in a disposable copy and writes only to `.test-suite-audit/` in the project;
suggest adding that to `.gitignore`. It needs Python 3.12+ and `pytest-cov` in the project's
environment, and `pytest-randomly` for order checks. Use a Bash timeout of the budget plus 2
minutes. The last stdout line is JSON with the report paths.

## Rules

- The runner measures; you interpret. Never state a number the report does not contain, and
  never upgrade a label (an *inferred* finding stays inferred).
- Report-only. Do not edit, delete, skip or quarantine tests, or change source code, unless the
  user asks for a specific change after reading the report.
- Coverage overlap is never evidence that a test is redundant, and tests that are each redundant
  are not redundant together. Only a removal set that `prune-check` did not refute may be
  presented as removable, and even then as "not refuted", not "safe".
- A surviving mutant is a candidate gap, not proof of a bug. Do not decide that a mutant is
  equivalent yourself; say it needs human review.
- When the user pushes for one of these conclusions, explain the measured reason from
  [the study evidence](reference/evidence.md) instead of just declining.

## Steps

1. **Check the target.** Confirm it is a pytest project. Look for `test-suite-audit.toml`; if
   absent, the runner discovers source packages, test directories and the interpreter
   (`.venv/bin/python`, then `python3`). If discovery looks wrong (for example a monorepo),
   write a `test-suite-audit.toml` only after asking. Keys: `python`, `source`, `tests`,
   `pytest_args`, `env`, `workers`, `protected` (node ID prefixes or marker names of tests that
   must never be proposed for removal). If `pytest-cov` is missing, say coverage will be "not
   assessed" and offer the install command; do not install anything without asking.
2. **State the budget** before running. Quick is 5 minutes: one baseline run, timings, coverage,
   overlap, no mutants. Deep is 30 minutes by default: three file-order and three random-order
   runs, coverage, every deletion mutant, then a seeded sample of classical mutants until the
   budget ends. In our benchmark, 12 to 14 minutes completed deep audits of projects up to about
   3,300 executable lines; dateutil (about 3,600) and click (about 5,000) needed more.
3. **Run the audit** and read `report.json` (full evidence) and `report.md`. See
   [reading the report](reference/report.md) for statuses, labels and the detection rate.
4. **If the deep audit proposed removal candidates**, treat them as an upper bound: in our
   study such sets covered about 80% of each suite and every one lost kills on held-out mutants.
   Run `prune-check` on them with
   `--from-run <run-dir>`, so the check uses mutants the set was not chosen from. Give it at
   least 10 minutes. Report its verdict: `refuted` (with the kills or lines lost) or `not refuted`
   (with the number of killed mutants checked and the upper bound it gives).
   If it is refuted, keep the tests it names as sole killers, and say the rest is still
   unproven. Never present a refuted set as removable.
5. **Summarise under three headings**, findings in the report's order, each with its label,
   evidence and next validation step:
   - *Does it catch broken code?* Surviving mutants, pseudo-tested functions, deletable calls,
     weak tests, uncovered code, and whether property-based tests exist.
   - *Can an agent run it on every change?* Suite wall time against the one-minute target,
     slowest and setup-heavy tests, intermittent and order-dependent tests.
   - *Is it bloated?* The removal set and its prune-check verdict, with the time it would save.
     Overlap pairs are listed only as things to look at.
   Give the reproduction command for at least one mutant finding. List what was not assessed.
   Link `report.md`.
6. **Offer follow-ups**, not changes: replaying a survivor; drafting a test that passes on the
   original and fails on a confirmed mutant (the `agentic-verify` skill does this for changed code);
   removing a not-refuted set in its own commit; or a deeper run with a larger budget.

If the run is partial (budget or interruption), say so first and explain which steps are missing.
