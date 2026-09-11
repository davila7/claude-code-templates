# Search vs build: adopt an existing benchmark or make one

Building a benchmark is expensive and its ground truth is homemade. Adopting one buys
external validity and credibility, and can silently measure the wrong thing. The
decision is made with a scorecard, not a hunch.

## When to search first

Always. Ten minutes of search precedes any build. The search finds one of three things:

1. A benchmark that exercises the promise directly. Adopt it, possibly with a subset.
2. A benchmark with the right plumbing but the wrong tasks. Reuse the harness, add
   tasks.
3. Nothing that stresses the mechanism. Build, and say in the report that no public
   benchmark fit and why.

## Search procedure

1. Name the capability in the words the field uses, not product words. "Long-context
   retrieval," "tool-use reliability," "faithful summarization," "code repair."
2. Search the usual venues: benchmark aggregators and leaderboards, the major model
   release reports (they list what they evaluated on), survey papers for the capability,
   and open harness repositories, which bundle dozens of tasks with shared plumbing.
3. For each candidate, read in this order: the task definition, five sample items, the
   grading code, the known-issues or errata page, the last commit date.
4. Fill `templates/benchmark-assessment-scorecard.md` for each candidate that survives
   item 3.

## The five questions (the scorecard)

1. **What does it implicitly reward?** Every benchmark encodes a utility function.
   State it in one sentence and compare it to the promise. A mismatch means the
   benchmark will report progress on a neighbor's problem.
2. **Is it contaminated?** Public benchmarks leak into training data. Check the
   release date against the model's cutoff, look for a canary string or a rolling
   held-out set, search for the items verbatim. A contaminated benchmark measures
   memory, not capability.
3. **What is its label-error ceiling?** Datasets have wrong labels. Sample fifty items
   and grade them by hand. A 5% label-error rate means no system can honestly score
   above about 95% and any delta under the error rate is noise.
4. **Does it exercise *this* mechanism?** A famous benchmark that does not stress the
   lever under test will report that the lever does nothing. Check that item difficulty
   actually depends on the capability being changed.
5. **Is it maintained and comparable?** Last commit, open issues, whether published
   numbers were produced with the same harness version and settings. A stale
   leaderboard offers no comparison.

Two further checks that decide the weight of an adopted benchmark:

- **Saturation.** If leading systems score near the ceiling, the benchmark no longer
  separates them. Use it as a floor check, not a headline.
- **Scale and cost.** Item count, runtime, and judge cost per full run. A benchmark
  that cannot be run on every change belongs in a nightly or release tier
  (`07-gates-and-ci.md`).

## Adopting with modifications

Allowed, with disclosure:

- **Subsetting** by a pre-registered rule (random seed, or a stated category filter).
  Never by "the ones that look relevant" after seeing scores.
- **Re-grading** with a stricter or deterministic grader when the original grader is
  weak. Report both numbers.
- **Extending** with new items in the original format. Label them as an extension; do
  not compare the extended score with published numbers.

## Building a custom one

Triggered when the scorecard fails question 1 or 4 for every candidate. Then:

- Reuse public harness plumbing wherever it exists. New tasks, proven runner.
- Follow `05-dataset-construction.md` for items, labels, negatives, and splits.
- Say in every report that the benchmark is custom and self-run. A custom benchmark is
  evidence; it is never independent validation, and the honest label is what keeps it
  credible.
- Publish the fixture fingerprint and harness version with every number.

## Output of this file

A filled scorecard per candidate and a one-line decision: adopt as is, adopt with
stated modifications, reuse harness and add tasks, or build with a stated reason.
