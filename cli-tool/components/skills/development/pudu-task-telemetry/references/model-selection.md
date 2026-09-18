# Choosing and comparing models

Pudu supplies hardware evidence; Ollama supplies installed model identity,
capabilities and context capacity. Join by exact tag or an unambiguous digest
prefix. Models must have local weight metadata, a full Ollama digest, completion
capability and a known context capacity. Reject known remote/cloud models.

The runner excludes candidates whose weights exceed 85% of total RAM. This is a
conservative weight-size check, not a guarantee that KV cache and runtime fit
currently available RAM. Use smaller models/context under memory pressure.
Explicit pilots may select grades C/D or unknown; auto-selection requires S/A/B.
Hardware grade and a separate `llama-bench` result never establish task quality.

## Automatic selection

`recommend --evidence-file evidence.json` accepts an array of local task UUIDs,
not arbitrary claimed benchmark numbers. A qualifying candidate needs:

- At least five distinct task/request/rubric cases, each repeated at least three
  times in distinct completed tasks, with one completed attempt per task.
- A passing runner `exact-text` verification in every supplied comparable trial.
  Failed, interrupted, retried or unverified comparable trials disqualify the candidate;
  counts and pass rate remain visible.
- Matching model digest, hardware fingerprint, Ollama version, task kind and
  configured context. Identical suites and generation options across candidates.
- Caller-declared `loadPolicy: warm`. Warm-up runs should be separate and omitted
  from the evidence set; inspect `load_ms` to validate the claim.

The winner has the lowest median of per-case median request latencies among
qualifying candidates. Each case has equal weight even with unequal repeats. No evidence yields `needs_selection`. If suites differ, no winner is
selected. This small suite does not establish general intelligence or statistical
superiority. It only supports the declared exact-answer task family. Re-evaluate
when versions, machine, model digest, prompts, options or rubric change.

`--task-kind` is a caller-defined identifier; use the same value during runs and
recommendation. Avoid secrets in identifiers or model names. `--model auto` uses
the same evidence rule and does not launch benchmarks or download models.

## Comparisons

`compare` preserves both reports and marks non-equivalence of task/input hashes,
tracked Git state, runtime/hardware, options, rubrics and load policy. Model IDs
may differ: comparing them is the purpose. It does not pick a statistical winner,
mix cold/warm runs or infer cost/time savings. System background load and
untracked file contents are not fully controlled by this runner; disclose them.

A real quality study should use representative task rubrics, sequential runs,
the same context, three or more repeats per case and separate warm-ups. Use
medians/ranges; three samples do not justify a stable p95. Review generated code
with actual project checks rather than treating exact-answer smoke checks as
proof of coding skill.
