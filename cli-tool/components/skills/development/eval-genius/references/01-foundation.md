# Foundation: what to measure, and why, before any benchmark exists

Most bad eval work comes from skipping straight to "let's build a benchmark." This file
is the part everyone skips. Read it when the ask is vague ("make retrieval better"),
when a metric was chosen before a goal, or when a team cannot say what a number is for.

## 1. Start with the promise, not the metric

Write the promise the system makes, in plain language a non-expert would sign off on:

- "Users find the right document in the first three results."
- "The agent completes the task without breaking anything it did not touch."
- "The summary keeps every decision and drops every pleasantry."

The metric comes *from* the promise. When the promise cannot be stated, measurement is
premature. When two people state different promises, that disagreement is the first
finding, and it costs nothing to resolve now versus a month of measuring the wrong thing.

## 2. Name the variables

Every measurement is a small experiment with three kinds of variable:

| Kind | Meaning | Examples |
|---|---|---|
| **Lever** (independent) | What changes on purpose | Prompt, model, retrieval setting, threshold, chunk size, a pipeline stage |
| **Outcome** (dependent) | What is watched | Pass rate, recall@k, latency p95, cost per task, judged quality |
| **Control** (held constant) | Everything else | Data, corpus, snapshot, seed policy, judge version, hardware class |

Rules:

- One lever per comparison. Two levers moved together give a result nobody can act on.
- Every outcome gets a direction and a unit written down (higher-is-better recall@5,
  lower-is-better p95 ms).
- Controls are enumerated, not assumed. Anything not on the list is a suspect when a
  delta appears.

## 3. Decide where a measurement belongs

Measurements go at three places:

- **Decision points.** Model A vs B, config X vs Y, ship vs hold. A decision without a
  measurement is a guess in a lab coat.
- **Risky seams.** Where a mistake is expensive or invisible: data integrity, security,
  anything a user would silently suffer from.
- **Public claims.** Any number destined for a README, a pitch, or a blog post.

Everywhere else, a spot check or nothing. Over-measuring low-stakes surface burns the
budget that the risky seams needed.

## 4. Pick the weight

| Instrument | Use when | Lives | Cost |
|---|---|---|---|
| **Spot check** | "Does this look right?" during development | Nowhere | Seconds |
| **Eval** | A repeatable check on one capability that keeps changing | In the repo, runs on every change | Cheap |
| **Benchmark** | A standardized, versioned, comparable measurement across versions or systems | Versioned dataset + harness | Real setup |
| **Monitor** | Continuous measurement of live behavior | Production | Ongoing |

Decision walk:

1. Will it run more than once? No: spot check.
2. Will results be compared across time or systems? No: eval. Yes: benchmark.
3. Is the thing being measured live traffic rather than a fixed set? Monitor.

A benchmark run once was an eval. An eval running forever in production is a monitor
and needs sampling, alerting, and drift handling that an eval never had. Monitors
are out of this skill's scope beyond one rule: the offline eval's per-item scorer is
reused on a sampled slice of live traffic, so the offline and online numbers share a
definition and drift between them is itself a finding.

## 5. Define "better" as a threshold before looking

Write the bar in numbers, in advance:

- "Accept only if every metric is at or above baseline and recall@5 is up by at least
  0.02 with a 95% interval excluding zero."
- "Accept if pass rate is unchanged within noise and p95 latency drops 20%."

Then write the **falsifier**: the result that would prove the change useless, and what
would be concluded from it. Then the **outlier rule**: how a single dominating item is
handled (capped, excluded with disclosure, or reported separately).

A bar set after the result is known is how people talk themselves into shipping noise.
All three go into `templates/preregistration.md` before the first run.

## 6. Match the metric to the promise, not to convenience

Prefer the harder end-to-end outcome over the intermediate proxy:

| Promise | Convenient proxy | Real outcome |
|---|---|---|
| "Finds the right answer" | Embedding similarity | Answer present in top-k, judged correct |
| "Agent finishes the task" | Tool calls succeeded | Final state passes the acceptance test |
| "Summary keeps what matters" | ROUGE overlap | Every pre-listed key fact present, no fabricated fact |

The proxy is allowed as a *diagnostic* alongside the outcome, never as its replacement.
Rename metrics into plain words in every report so a reader knows what moved.

## When no baseline exists yet

The first eval of anything has no prior run. The baseline is then the current
production configuration, run first through the same harness on the same fixture,
and its run id goes into the pre-registration before the treatment arm runs. The
first result is the baseline; there is no comparison until a second arm exists. A
brand-new system with no predecessor gets a stated floor instead (a trivial or
off-the-shelf configuration), and the report says the comparison is against a floor.

## Output of this file

A filled `templates/preregistration.md` with promise, variables, placement, weight, bar,
falsifier, outlier rule, and the named baseline. Nothing downstream starts without it.
