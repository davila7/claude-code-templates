# LLM-as-judge: an instrument that needs calibration

A model judge is useful and biased. It is never an oracle. It is a ruler, and a ruler
with no markings measures nothing. This file is the procedure for putting markings on
it, checking they stay put, and being honest about what the ruler certifies.

## When a judge is legitimate

Only after every deterministic move in `02-grading-and-metrics.md` has been tried. The
judge grades the residue: tone, helpfulness, faithfulness where a fact list cannot be
built, "would a domain expert accept this." If a judge is grading whether a string is
present, that is a bug, not a judgment.

## The biases inherited for free

| Bias | Effect | Mitigation |
|---|---|---|
| **Position** | Prefers whichever answer appears first (or last) regardless of quality; a judge can be highly self-consistent and still position-biased, so test-retest stability is not evidence against it | Run both orderings and count a win only when both agree; otherwise record a tie |
| **Verbosity** | Rewards longer answers even when shorter is correct | State how length is treated in the rubric; report length alongside score; spot-check top-scored long answers |
| **Self-preference** | Inflates outputs from its own model family | Judge with a different model family than the one under test |
| **Authority / style** | Rewards confident tone, headers, and lists over correctness | Rubric grades substance items explicitly; strip formatting before judging when the task is not about formatting |
| **Rubric-author** | The rubric encodes what its author, usually the system's builder, already believes matters | Have someone who did not build the system author or review half the rubric items; blind-swap rubric authorship across teams when possible |

De-biasing a judge is not the same as validating that it measures what is claimed. A
perfectly de-biased comprehension judge can still be measuring "text present" rather
than "understood." Classify each instrument honestly: deterministic, calibrated model
proxy, or human, and be precise about what it certifies.

## Rubric design

- **Anchored scale.** Describe what a 1, a 3, and a 5 look like with concrete examples.
  A bare "rate 1-10" produces a judge that drifts run to run.
- **Binary where possible.** "Does the answer state the deadline?" beats "how good is
  the answer" on every reliability metric. Decompose a holistic score into binary
  checks and let the aggregate be arithmetic, not judgment.
- **Reason before score.** The judge writes its rationale first, then the score. Score
  first and the rationale becomes a justification of a guess.
- **Pairwise for preference, pointwise for gates.** Pairwise ("which is better, A or B")
  is more reliable than absolute scores but only yields relative results and needs both
  orderings. Gates need a pointwise pass/fail against a fixed bar.
- **Blind it.** The judge sees no system names, no version labels, no "new" vs "old."

## Calibration procedure

Calibration is a measurement with its own pre-registration.

1. **Build the human set.** Sample items from the same distribution the judge will
   grade. Stratify by expected difficulty and include the negative space. Size: enough
   that an agreement statistic has a usable interval; a few hundred binary labels is a
   reasonable floor, fewer than fifty is anecdote.
2. **Label with two or more humans.** Write a labeling guideline first. Measure
   inter-annotator agreement (Cohen's kappa for two raters, Krippendorff's alpha for
   more). If humans do not agree with each other, the judge cannot be expected to agree
   with them; fix the guideline before continuing.
3. **Run the judge** on the same set, blinded, with the exact prompt and model that
   will be used in production, at the same temperature and settings.
4. **Compute agreement** judge-vs-human with a chance-corrected statistic (kappa or
   alpha), never raw agreement. Raw agreement is inflated by class imbalance; large
   judge studies have found it overstating chance-corrected agreement by 30 to 40
   percentage points. Also compute precision and recall of the judge's PASS against
   the human PASS, because a judge that agrees 90% by always saying PASS on a 90%-PASS
   set is useless.
5. **Set the bar before step 4.** One floor table applies to humans-vs-humans and
   judge-vs-humans alike: kappa or alpha at or above 0.67 for tentative or diagnostic
   use, 0.8 for a gate or a headline claim, 0.9 where a wrong grade costs a user
   something. Below the floor, the judge is a diagnostic, not a
   grader, and the report says so.
6. **Inspect disagreements.** Every disagreement is either a rubric defect, a label
   defect, or a judge failure. Sort them. Fix the rubric or the guideline, then
   re-run from step 3. Iterating the judge prompt against the calibration set makes
   the set a training set; hold out a slice that is never used for prompt iteration
   and report agreement on that slice.

`scripts/judge_agreement.py` computes kappa, agreement rate, and the PASS precision /
recall from two label files.

## Pin the instrument

A judge is part of the fixture. The run manifest records:

- judge model identifier and snapshot / version string
- judge prompt hash
- temperature and any sampling settings
- calibration set version and the agreement achieved

When any of these changes, the judge is a new instrument and calibration re-runs.
Scores from different judge versions are never placed side by side without that note.

## Measuring disagreement as signal

For high-stakes calls, run two judges (different families) or two prompt variants.
Where they agree, there is a signal. Where they disagree, there is not; route those
items to a human or report them as undetermined. Never average away a disagreement.

## Cost discipline

Judge tokens are eval cost. Report them separately from system cost. A judged layer
that costs more than the deterministic layer catches is a candidate for decomposition
into more binary checks.

## Output of this file

A calibrated judge: rubric with anchors, blinded and order-randomized protocol, a human
calibration set with inter-annotator agreement, judge-vs-human agreement above a
pre-set floor on a held-out slice, and the judge pinned in the run manifest.
