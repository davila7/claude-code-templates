# Start here: do I need an eval, and where does it go?

For the reader who has never built one. Read this when the ask is "I think I might
need evals", "where do evals fit in my process", or "which eval should I run". It ends
with a concrete first-eval recipe; everything else in the skill deepens one step of it.

## What an eval is, in one paragraph

An eval is a repeatable check on a system whose outputs vary: a fixed set of inputs,
a written rule for what a good output looks like, and a score (usually a pass rate).
It is the test suite for the part of the product a unit test cannot pin down, because
a model, prompt, or retriever produces different text on different days. Where a
unit test says "equal or not", an eval says "how often, and is that enough".

## Do I need one? Three questions

1. **Does the output vary?** A model, a prompt, a retriever, a ranking, anything
   you will keep tuning. No: ordinary tests, stop here.
2. **Will you change it again and want to know if the change helped?** Or would a
   quiet regression cost you something (a wrong answer to a user, a broken agent
   action, a public number that turns out false)?
3. **Is a decision or a claim coming?** Model A vs B, ship or hold, a number in a
   README or a pitch.

No to all three: spot check by hand and move on. Yes to any: an eval, sized to the
stakes. Most projects reach "yes" the first time a prompt change breaks something
that used to work.

## Where evals sit in a development lifecycle

| Stage | What you are doing | Instrument | Smallest useful version | Fine to skip when |
|---|---|---|---|---|
| **Exploring** | Trying prompts and models, nothing fixed yet | Spot check | 10 hand-picked inputs, eyeball the outputs | Always; nothing to measure yet |
| **First working version** | It basically works and you are about to iterate | Smoke eval | 20 to 50 real inputs, code-checked, one pass rate. **This run is the baseline.** | The prototype is being thrown away |
| **Changing one thing** | Prompt tweak, model swap, retrieval setting | Paired eval vs baseline | Same items through old and new, per-item diff, bar written before the run | The change is cosmetic and untestable |
| **Merging or shipping** | Deciding whether this goes out | Gate in CI | Held-out items, PASS / FAIL / CANNOT-MEASURE, a known-bad item that must fail | Personal prototype, no users |
| **Comparing or claiming** | Versus a rival, an older version, or a public number | Benchmark | Versioned dataset plus harness, interval on every number, written report | No comparison, no claim |
| **Running in production** | Real traffic, real drift | Monitor | The same per-item scorer on a sampled slice of live traffic | Not launched yet |

Timing rule: build the first eval at **first working version**. Earlier, there is
nothing stable to measure; later, every change since is unattributable and the eval
is built under pressure. Each later stage reuses the same items and scorer, heavier
only in what surrounds them.

## Which eval do I run? Four forks

1. **What does one output look like?** An exact answer (a label, a number, a
   file), a structured object (JSON, a table), free text (a summary, a reply), or a
   sequence of actions (an agent). Name it; the grader follows from it.
2. **Can code check it?** Exact answers, structured objects, and end states of an
   agent: yes, and that is the whole grader. Free text: decompose first (required
   facts present, forbidden content absent, length and format) and only the
   remainder needs a model or human judge (`02-grading-and-metrics.md`).
3. **What is the metric?** Pick from the family that matches the promise: retrieval
   wants recall@k, classification wants precision and recall, generation wants fact
   coverage plus a judged layer, agents want task success plus trajectory
   (`02-grading-and-metrics.md`). Always record cost and latency next to it.
4. **How many items?** 20 to 50 to start; enough to see a change of the size that
   matters before trusting a delta (`08-statistics.md`). Include items where the
   right output is "refuse" or "nothing found".

Any existing public benchmark that measures the same promise beats building one
(`04-search-vs-build.md`); most first evals are private and small, and that is fine.

## The first-eval recipe (one afternoon)

1. **Collect 30 real inputs.** From logs, support tickets, or hand-written cases that
   look like real use. Five of them where the correct behavior is to refuse or return
   nothing.
2. **Write the expected result per item in a form code can check.** A string, a set
   of required facts, a schema, a final state. If an item resists, split it or park it
   for the judged layer later.
3. **Run the current system.** Save per-item results, not just the total. That number,
   with its n, is the baseline. Write down what version produced it.
4. **Write the bar before the next change.** "Accept if no item that passed now fails,
   and the pass rate is up by at least X." Also what would prove the change useless.
5. **Change one thing, run again on the same items, diff per item.** Read the result
   with `11-reading-results.md`.

Fill `templates/preregistration.md` with steps 3 and 4; it is the same five fields the
rest of the skill relies on, and a first-time user needs only the promise, the lever,
the baseline, and the bar.

## Output of this file

A yes/no on whether an eval is needed, the stage it belongs to, the instrument for that
stage, the grader type and metric family, and a baseline run with per-item results.
Nothing downstream needs more than that to start.
