---
description: Entry point of the quality-kernel — run the six-agent quality pipeline scaled to the task (from a one-line issue to a large feature), with automatic tier routing and a blast-radius override.
argument-hint: <task description | issue #> [--tier T0|T1|T2]
---

Run the quality-kernel pipeline for the task described in `$ARGUMENTS`.

You are the **orchestrator / PM-router**: you route the work, dispatch the agents,
enforce the gates, and relay results. You do **not** do the feature work yourself.

## Step 0 — Tier routing (automatic, with blast-radius override)

Classify the task into a tier from cheap signals: estimated change size, number of
files / subprojects, and whether it is new behavior vs. a fix.

- **T0 — issue / small fix:** a single agent, or the two-pack `coder → cleaner`.
- **T1 — medium feature:** the four-pack `specifier → coder → cleaner → architect`.
- **T2 — large / multi-subproject:** the full six-pack
  `specifier → coder → cleaner → architect → hardener → qa` under hierarchical
  orchestration.

Rules:
- The human MAY propose a tier (e.g. `--tier T1`). The system may **raise** the tier but
  **never lower** it below what blast-radius requires.
- **Blast-radius override:** if the change touches the project's *critical surface* —
  authentication / tenant isolation, money / billing, external state (DB writes, queues,
  outbound calls / email / SMS, third-party effects), live voice / telephony, migrations,
  infra / IaC, or **the contract itself** — force **T1 or higher** regardless of size.
  A one-line change in `auth` is never T0. (Critical-surface globs are per-project config;
  if none is set, treat any change outside docs / tests / styling / tooling as critical.)

State the chosen tier and the reason in one line before proceeding.

## Step 1 — Run the chain for the tier

Dispatch each role as a subagent (`specifier`, `coder`, `cleaner`, `architect`,
`hardener`, `qa`), in order, skipping the ones the tier does not include. Inject the
domain expertise the task needs (backend / frontend / security / db) into each role's
context — **the roles are fixed, the expertise is injected**.

Communication model:
- **Handoff of artifacts + context, not chat:** each agent passes the artifact + its
  trace + the deterministic-tool evidence to the next, by reference (files in the
  worktree). Each agent runs its **self-audit** before handing off ("passing checks
  alone do not establish completeness").
- **PM-router:** give each agent an explicit goal, output format, allowed tools and
  task boundaries; receive a structured report back. Agents do not chat freely.
- Where a judgment is needed (review, or choosing between implementations in a risk
  zone), **vote** across independent outputs weighted by evidence — do not debate.

## Gates (enforce; do not skip)

1. **Intention gate (human)** — after the specifier produces the contract (EARS +
   Gherkin + External Observable Invariants), pause for human validation that the
   contract matches intent, before any code is written (T1+).
   *(Optional, per-project:)* if GitHub Project integration is enabled, create one issue
   per task on the dashboard here.
2. **Genuine RED** — the coder's tests must fail for the right reason, anchored to the
   contract.
3. **Mutation (async)** — for T1+, run mutation in CI / async on core modules
   (hardener). Do not block the implementation loop on it.
4. **Blind breaker (live oracle)** — for any change touching the critical surface, run
   the `pipeline-breaker` on ONLY the contract + the probe (the QA script). Require
   `BREAKER_PASS` (>=3 executed falsifying vectors, all HOLDS) before merge; no probe =
   `INSTRUMENT-BROKEN` = default-deny.
5. **Evidence-gate** — nothing is "done" without a verification event (exit 0) after the
   last edit.
6. **Pre-push panel** — the `pre-push-review` plugin blocks the push on critical findings.

## Loop discipline

Every repair loop is bounded (cap 3) and **escalates to the human on cap** — never retry
blindly, never weaken a test to pass. Cap the number of agents and messages; no free
lateral chat between agents.

## Output

Report: the chosen tier and why, the agents run, each gate's result, the
mutation / coverage / CRAP figures where run, and the **residual risk, stated first**.
