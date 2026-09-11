# Dataset construction: items, labels, negatives, splits, contamination

A benchmark is only as honest as its items. Famous public benchmarks have been
re-audited and found to carry label-error rates near 10% overall and above 50% in
some subsets, which means a perfect system could not score 100% and any delta under
the error rate is noise. Homemade sets are not better by default; they are just
un-audited.

## Sourcing items

- **From the real distribution.** Sample from real traffic, real documents, real tasks.
  Synthetic items are allowed for coverage of rare cases and are labeled as synthetic.
- **Stratify by difficulty and by category** before sampling, so the set does not
  quietly become "the easy cases we had lying around." Record the strata in the
  fixture manifest.
- **Size from the statistics, not from convenience.** Decide the minimum effect that
  matters, then size the set so that effect is detectable (`08-statistics.md`). A few
  hundred items is a typical floor for a gate; fewer than fifty is a smoke test.
- **Sample fifty items and grade them by hand** before trusting any source, including
  a well-known public one. This is how the label-error ceiling is found.

## Labeling

1. Write the **labeling guideline** first: what counts, what does not, the edge cases,
   worked examples of each label.
2. **Two or more labelers** on at least a stratified subset. Measure inter-annotator
   agreement with a chance-corrected statistic: Cohen's kappa for two raters,
   Krippendorff's alpha for more. Working floors: 0.67 for tentative use, 0.8 for a
   gate, 0.9 where a wrong label harms someone. Below the floor, the guideline is
   ambiguous; fix it and re-label. Do not average the disagreement away.
3. **Adjudicate** disagreements with a written reason, and feed the reason back into
   the guideline.
4. **Version the labels.** A relabel is a new fixture version with a new fingerprint.

## The four defect classes of task-style items

A large, human-verified re-curation of a coding benchmark found four recurring defects.
They generalize to any task-style item:

| Defect | What it looks like | Check |
|---|---|---|
| **Over-strict grader** | Tests enforce an implementation detail the task never stated | Would a correct alternative solution fail? |
| **Under-specified prompt** | Hidden checks demand something the prompt never asked for | Can a careful human pass from the prompt alone? |
| **Low-coverage grader** | The check passes solutions that miss the feature | Does a deliberately wrong solution fail? |
| **Misleading prompt** | The prompt points toward the wrong behavior | Does the prompt contradict the grader? |

Run all four on every item before it enters the set. The third check is the same
"verify the verifier" rule the harness enforces at run time.

## Negative space

A benchmark that only walks the happy path tests half a promise. Build, on purpose:

- **Benign negatives.** Inputs where the correct behavior is nothing: no trigger, no
  retrieval, no action. Measure the false-positive rate on them.
- **Verified-absent negatives.** For retrieval and memory, queries whose answer is
  provably not in the corpus. Generate them from a source outside the corpus and
  check absence mechanically; hand-written negatives leak into the corpus over time
  and turn into positives without anyone noticing.
- **Near-miss distractors.** Items that look like a positive but are not. These are
  where precision actually gets measured.
- **Refusal cases.** Where the right answer is "cannot" or "should not."

## Splits

- **Development set** for iterating on prompts, rubrics, and configs.
- **Held-out gate set** that nobody iterates against. Tuning on the gate set turns the
  gate into a training set and the number into fiction.
- **Calibration set** for judges, with its own held-out slice (`03-judge-calibration.md`).

Splits are random with a recorded seed, or by a pre-registered rule. Never by hand.

## Contamination

Public benchmarks leak into training data. The contaminated benchmark measures memory,
not capability.

Detection:

- **Overlap search.** Look for long n-gram overlaps between benchmark items and any
  corpus the system could have trained on. Published practice has used 13-gram
  overlap, 50-character overlap, and 8-gram overlap above 80% coverage as flags.
- **Canary strings.** Embed a unique random token in the dataset text. A system that
  can reproduce the canary has seen the set.
- **Date gating.** Tag every item with a creation date. Score systems only on items
  created after their known training cutoff, and compare pre- and post-cutoff scores;
  a large gap is contamination made visible.
- **Rephrase probe.** A system that scores far higher on verbatim items than on
  meaning-preserving rephrasings has memorized rather than understood.

Prevention:

- Keep a **private held-out set** that never leaves the team.
- **Rotate.** Add fresh items on a schedule and retire old ones; report scores on the
  fresh slice separately.
- Never paste benchmark items into prompts, docs, or issue trackers that get crawled.

## Overfitting the benchmark (Goodhart's law)

Contamination is memorizing the answers. Overfitting is subtler and needs its own defense:
iterate against one fixed set long enough and you tune the system, prompts, and rubric to
that set's quirks, so the score climbs while the real capability stalls. "When a measure
becomes a target, it ceases to be a good measure." No test-set leak is required, only
repeated selection against the same items.

Symptoms:

- The gate score rises release over release, but user reports, spot checks, or a fresh
  qualitative pass don't move with it.
- Gains concentrate on the exact items or strata you looked at most, and vanish on new items.
- A newly drawn set from the same distribution scores materially lower than the standing set.

Defenses:

- **Reserve a rarely-touched held-out set**, ideally opened only at release. The set you read
  every iteration is the set you overfit; frequency of contact is the risk, not just leakage.
- **Rotate and refresh** items on a schedule (see Contamination) so the target moves faster
  than you can fit it; report the fresh slice separately and watch for a standing-vs-fresh gap.
- **Cap look frequency.** Track how many times each set has been evaluated against; a set
  looked at hundreds of times is a training set in disguise.
- **Keep an ungameable qualitative pass**, a small human read no optimization loop can see.
- **Judge a basket, not one number.** Optimizing a single headline metric is what invites
  Goodhart; a basket (quality + cost + a negative-space check) makes gaming one surface in another.
- **Watch metric-reality divergence explicitly.** When the number and reality disagree,
  believe reality and suspect the benchmark, not the other way around.

## Fixture manifest

Every dataset version ships with a manifest: item count per stratum, label version,
inter-annotator agreement, label-error audit result, split seed, content hash, creation
dates, and known issues. The hash is what the harness compares before it agrees to
compare two runs (`06-harness-design.md`).

## Output of this file

A versioned fixture with a manifest, a labeling guideline with measured agreement, a
negative-space slice, held-out splits with a recorded seed, and a contamination check
result.
