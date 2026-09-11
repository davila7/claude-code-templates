# Reading results from scratch

For the reader holding their first output file. Read in order; each check gates the
next. The deeper material sits in `07-gates-and-ci.md` (triage) and `08-statistics.md`
(noise), and this file stays at the level of "what does this number let me say".

## 1. Did it run? (before the number means anything)

Every run ends one of three ways: **PASS**, **FAIL**, or **CANNOT-MEASURE**. A crash,
a timeout, an item that errored, a fixture that did not match, a treatment arm that was
not actually switched on: all CANNOT-MEASURE, which is a plumbing problem to fix and not
a verdict on the system. `scripts/check_gate.py` exits 2 for this; read that exit code
before reading any score. Also check the known-bad item failed. A verifier that passes
a plant grades nothing, and every green above it is meaningless.

## 2. Compare to the bar you wrote, not to your hopes

Open the pre-registration. The bar says what "better" means in numbers; the falsifier
says what "useless" looks like. Put the result next to those two lines. A result that
is above the bar is a candidate win; one below the falsifier is a rejected change; one
in between is "not established". Deciding the bar now, with the number in view, is the
single most common way a team ships noise, and the reason the bar was written first.

## 3. Is the difference bigger than the noise?

A pass rate on n items carries an error bar. Orientation, 95% half-width:

| n | around 50% pass | around 90% pass |
|---|---|---|
| 50 | about ±14 points | about ±8 points |
| 200 | about ±7 points | about ±4 points |
| 1000 | about ±3 points | about ±2 points |

So on 50 items, a 4-point rise is inside the noise. `scripts/paired_bootstrap.py`
gives the honest version: run both arms on the same items, it reports the mean delta
and a 95% interval. Plain reading: the interval is the range of true deltas the data is
consistent with. If it includes zero, the change may have done nothing; say "not
established", not "no effect". If it excludes zero and clears the bar, the delta is
real on this fixture. That is the entry ticket, not the verdict; it says nothing about
whether the items measure the promise.

Judged layers and anything with sampling are noisier than that table: run the same
version twice first. The spread between two identical runs is the noise floor, and a
delta smaller than it is not a result.

## 4. Look at the items, not the average

The per-item diff has three counts: improved, regressed, held. Read the regressions
before the total; an aggregate can climb while a category collapses. Ten flips in one
category is a real effect, in one direction. Ten flips scattered across categories on
a judged score is variance. Reproduce one flipped item by hand before believing any
of it; the reproduction is where most "wins" and most "regressions" turn out to be a
scorer that changed its mind.

## 5. Surprised? Suspect the harness first

A 0%, a 99%, a jump of thirty points from a one-line change: harness bug until proven
otherwise. Confirm the run used the fixture it claims, the version it claims, and the
arm it claims. The one forbidden move is changing the system until a suspect gauge
reads nicely; fix the gauge or stop.

## 6. Read the layers separately, then cost

Deterministic pass rate and judged score have different denominators and different
noise; one number that blends them hides which half moved. Then read tokens per item,
cost per pass, and p95 latency. A quality gain that doubled cost or tail latency is a
trade to state, not a win to announce.

## 7. What you are allowed to say

Three sentences, each tagged **measured** (from a run with a manifest), **estimated**
(derived or from a smaller sample), or **aspirational** (a target):

1. The bar, quoted, and whether it was met.
2. The primary delta with its interval and n, and the improved / regressed / held counts.
3. The caveat that most weakens the claim: sample size, subset, self-run, judge
   agreement, or a surprising number that was not fully explained.

Everything the report template asks for (`templates/eval-report.md`) is an expansion
of those three. A write-up with no third sentence reads as one where nobody looked.

## Worked example (hypothetical numbers)

Baseline 31 of 40 pass, treatment 34 of 40. Per item: 4 improved, 1 regressed, 35
held. Bar was "no regressions and pass rate up by at least 5 points". Reading:

- Ran cleanly, negative control failed: measurable.
- The bar's first clause fails on one regression; open that item before anything else.
- +7.5 points on 40 items sits inside a noise band of more than ten points; the
  paired interval will likely include zero. Verdict: **promising, not established**. Next
  step is more items or repeated runs, not a promotion of the baseline.

## Output of this file

A three-way outcome read before any score; the result placed against the written bar;
a delta with an interval and a stated noise floor; regressions inspected by hand;
layers and cost read separately; and three tagged sentences a hostile reader can check.
