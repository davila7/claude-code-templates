# Grading and metrics: deterministic first, judged last

The first fork in any eval is who grades it. This choice drives cost, reproducibility,
and how much the number can be trusted.

## The fork

| | **Deterministic** (code-graded) | **Non-deterministic** (model- or human-graded) |
|---|---|---|
| Grader | Exact match, normalized match, regex, schema/type check, test suite, numeric threshold, set overlap | LLM-as-judge, human rater, pairwise preference |
| Use when | A checkable right answer exists | Quality is inherently a judgment: tone, helpfulness, faithfulness |
| Cost | Free, instant | Slow, paid, noisy across runs |
| Trust | High, if the check itself is correct | Only as good as the judge's calibration |

**Governing rule:** push every check that can be deterministic down to code. Reserve
judgment for the edge no assertion captures. Then report the layers separately: a
deterministic pass rate and a judged score never share a denominator or a headline.

## Making more things deterministic

Before accepting "this needs a judge," try these moves in order:

1. **Normalize then match.** Lowercase, strip whitespace and punctuation, canonicalize
   numbers and dates. Most "fuzzy" answers become exact.
2. **Extract then match.** Have the system emit a structured field (JSON, a final line,
   a tagged span) and grade the field, not the prose.
3. **Assert on state, not text.** For agents and code, grade the resulting filesystem,
   database, or test suite, not the transcript.
4. **Decompose the rubric.** "Is this a good summary" becomes "contains fact A," "contains
   fact B," "contains no fact outside the source." The first two are set-membership
   checks. Only the last may need a judge, and often a fact-list diff does it.
5. **Use a reference set with tolerance.** Numeric answers within an interval; lists
   graded by Jaccard overlap above a threshold.

Only what survives all five becomes the judged layer.

## Metric catalog by task family

Pick from the family that matches the promise. Each entry names the failure mode of
the metric so it can be caught.

### Retrieval / search / memory

| Metric | Measures | Watch for |
|---|---|---|
| recall@k | Is the relevant item in the top k | Ignores rank inside k; pick k from the real UI |
| MRR (mean reciprocal rank) | How high the first relevant item lands | Dominated by first hit; blind to second relevant item |
| nDCG@k | Graded relevance with position discount | Needs graded labels; cheap labels make it meaningless |
| precision@k | How much of the top k is relevant | Punishes systems that surface useful near-misses |

Retrieval gates work best on a per-query diff, not the aggregate: a mean can hold
steady while ten queries collapse and ten others improve.

### Classification / routing / triggering

| Metric | Measures | Watch for |
|---|---|---|
| Precision / recall / F1 | Trade-off between false alarms and misses | Report both, never F1 alone; class imbalance hides in accuracy |
| False-positive rate on benign input | The negative space | Requires an explicit benign set, which teams forget to build |
| Confusion matrix | Which classes get confused | The only view that explains *why* F1 moved |

### Generation / summarization / rewriting

| Metric | Measures | Watch for |
|---|---|---|
| Key-fact coverage | Fraction of pre-listed facts present | Needs a fact list per item, built before generation |
| Fabrication count | Facts present that are not in the source | Best graded by fact-list diff, then a judge only on disputed items |
| Constraint compliance | Length, format, forbidden terms, required sections | Fully deterministic; always run first |
| Judged quality | Fluency, tone, helpfulness | The judged layer; calibrate per `03-judge-calibration.md` |

Lexical overlap scores (ROUGE, BLEU) are diagnostics, not outcomes. They reward
copying and punish good paraphrase.

### Extraction / structured output

| Metric | Measures | Watch for |
|---|---|---|
| Schema validity rate | Output parses and conforms | Necessary, not sufficient |
| Field-level exact match | Per-field correctness | Report per field; a single aggregate hides the one field that always fails |
| Slot F1 | Precision/recall over extracted entities | Define matching rule (exact vs normalized) up front |

### Code

| Metric | Measures | Watch for |
|---|---|---|
| Test pass rate | Hidden tests pass | Tests must be hidden from the system; leaked tests inflate |
| pass@k | Any of k samples passes | Reports capability, not reliability |
| pass^k | All k samples pass | Reports reliability; the number a user actually feels |
| Diff scope | Files touched outside the task | Catches collateral damage that tests miss |

### Agentic / multi-turn

See `10-agentic-evals.md`. Outcome (final state) and trajectory (how it got there) are
graded separately.

### Cost and latency (always, alongside any of the above)

| Metric | Measures | Watch for |
|---|---|---|
| Tokens in / out per item | Spend | Judge tokens count too; report them separately |
| Cost per pass | Money spent per successful item | The metric that makes "more retries" honest |
| Latency p50 / p95 | Typical and tail response time | Means hide tails; tails are what users feel |

A quality gain that doubles cost or tail latency is a trade, not a win, and the report
says so.

## Choosing k, thresholds, and tolerances

Pull them from the product surface, not from habit. If the interface shows five
results, recall@5 is the metric. If a user waits at most two seconds, p95 under two
seconds is the bar. Thresholds invented in the abstract get gamed by the abstract.

## Output of this file

A grader plan: which checks are deterministic (and their normalization rule), which
items go to the judged layer and why, the metric per outcome with direction and unit,
and cost/latency recorded next to quality.
