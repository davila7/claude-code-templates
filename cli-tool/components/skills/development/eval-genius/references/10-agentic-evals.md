# Agentic evals: outcome, trajectory, reliability

Agents produce a trajectory (tool calls, intermediate states, messages) and an
outcome (the final state of the world). The two are graded separately, because many
correct trajectories reach one correct outcome, and a lucky trajectory can reach it
too.

## Outcome grading first

Grade the end state, deterministically:

- The resulting files, database rows, or API state match an annotated goal state.
- Hidden tests pass. Tests are hidden from the agent; leaked tests inflate.
- Nothing outside the task scope changed. Diff the world before and after; collateral
  damage is a failure even when the task passed.

The transcript is not consulted for the outcome verdict. That removes the temptation
to award credit for "trying hard."

## Trajectory grading second, and separately

Trajectory checks catch what outcome grading cannot:

- **Forbidden actions.** Destructive commands, out-of-scope writes, credential reads.
  Deterministic: pattern-match the tool log.
- **Efficiency.** Tool calls, tokens, wall time, retries. Deterministic.
- **Process quality.** Did it verify before claiming done, did it read before writing.
  Usually judged; calibrate per `03-judge-calibration.md`, and keep it out of the
  headline.

Report trajectory metrics next to the outcome metric, never blended into it.

## Reliability: pass^k beside pass@k

- **pass@k**: at least one of k independent trials succeeds. Rises with k. Measures
  capability.
- **pass^k**: all k trials succeed. Falls with k. Measures reliability, which is what a
  user experiences when they run the agent once and trust it.

An agent with pass@1 near 60% can have pass^8 under 25%. Report both. A gate on a
production agent uses pass^k with a pre-registered k.

## Sandboxing and infrastructure failure

- Every trial runs in a fresh, isolated environment with a pinned image. State leaking
  between trials is fixture drift.
- Setup timeouts, image pull failures, and container crashes are CANNOT-MEASURE for
  that item, recorded in the error field, never scored as a fail. A harness that
  reports 0% on a task the agent never entered is measuring infrastructure.
- Per-trial timeout is pre-registered and usually counts as a failure, because a user
  would experience it as one. Say which.

## The harness is a lever

Two agents on the same model with different scaffolds score differently. When the
comparison is between models, freeze the scaffold, tool set, budgets, and timeouts.
When the comparison is between scaffolds, freeze the model. Moving both is the
two-lever mistake from `01-foundation.md`.

## Items for agent tasks

Follow `05-dataset-construction.md`, with the four defect classes applied hard: an
over-strict hidden test fails a correct alternative solution; an under-specified prompt
makes the hidden test a guessing game. Every task gets a known-good reference solution
that passes and a known-bad one that fails, both run in the harness before the task is
admitted.

## Multi-turn and simulated users

When the task needs a user in the loop, the simulated user is part of the fixture:
pinned model, pinned persona script, pinned seed. A simulated user that changes
between runs is a control that moved. Grade the outcome state, not the conversation's
tone, unless tone is the promise.

## Output of this file

An agent eval with deterministic outcome grading on end state, separate trajectory
metrics, pass^k beside pass@k with pre-registered k, isolated per-trial sandboxes,
infrastructure failures recorded as CANNOT-MEASURE, and a frozen scaffold when the
model is the lever.
