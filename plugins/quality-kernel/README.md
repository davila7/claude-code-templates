# quality-kernel

A quality-assurance **kernel** for agentic development. It does not replace your
pipeline — it wraps it with the parts that turn "I think it's good" into a
declared residual: a six-agent engine, deterministic quality tools, a blind
live-oracle verifier, and epistemic-discipline gates. Scales from a one-line
issue to a large feature.

> Status: **WIP (v0.1.0).** The six agents, the `/forge` orchestrator and the
> two hooks are in place; the hooks ship in **log-mode** by design (measure
> first, tighten later). Items still open are listed at the bottom.

## The idea

Quality is lost in the *seams between agents*, not inside them. quality-kernel
closes those seams with three principles:

1. **Teeth, not prose** — every gate is a hook or a command that runs, not a
   convention you trust.
2. **Independence ≠ another LLM** — the only strong independent checks are the
   **human** (validates intent) and the **live oracle** (a probe that executes
   against the real system and returns a fact).
3. **Rigor ∝ blast-radius** — maximum rigor where it can hurt; the trivial path
   stays fast, so the gates never get bypassed.

## The engine — six agents (a SwarmForge-style chain)

`specifier → coder → cleaner → architect → hardener → qa`

| Agent | Owns | Deterministic tool |
|-------|------|--------------------|
| **specifier** | EARS criteria + Gherkin + e2e QA + external invariants | Gherkin DRY check |
| **coder** | implementation + unit tests (genuine RED) + accept. harness | TDD, oracle-signal check |
| **cleaner** | structure-preserving cleanup | CRAP ≤ 6, jscpd, mutation-site count |
| **architect** (opus) | module boundaries, dependency direction | dependency-cruiser / import-linter |
| **hardener** | mutation hardening, kill survivors | StrykerJS / mutmut, survivor-triage |
| **qa** | final independent verification, UI-only | the QA script **is the breaker's probe** |

Each agent runs a **self-audit before handing off** ("passing checks alone do
not establish completeness"). Roles are fixed; **domain expertise is injected**
(reuse your `backend-developer`, `frontend-developer`, `security-engineer`, …).

## Usage

```
/forge <task description | issue #> [--tier T0|T1|T2]
```

`/forge` is the orchestrator / PM-router. It:

- **routes a tier** automatically (T0 issue/fix · T1 medium · T2 large), with a
  **blast-radius override**: any change touching the critical surface (auth,
  money, external state, voice, migrations, infra, the contract) is forced to
  T1+ regardless of size. You may *propose* a tier; the system may raise it but
  **never lower** it below what blast-radius requires;
- runs the chain for that tier, passing **artifacts + context** (not chat) with
  a PM-router and **voting** (not debate) where a judgment is needed;
- enforces the gates: **intention (human)**, genuine RED, mutation (async),
  **blind breaker (live oracle, default-deny)**, evidence-gate, and the
  `pre-push-review` panel.

## Gates & hooks

Automatic, always on (no invocation needed):

- **`hooks/epistemic-guard.py`** (PreToolUse / Task) — requires the
  `[EPISTEMIC-DISCIPLINE v1]` marker in every agent spawn.
  Env `QK_EPISTEMIC_MODE`: `log` (default, warn only) | `block` (exit 2).
- **`hooks/evidence-gate.py`** (PostToolUse / Bash) — records exit codes of
  test/build/verify commands to `.quality-kernel/evidence-ledger.jsonl`, so a
  "done" claim can be checked against a real verification event newer than the
  last edit. v0 records; hard-blocking is future work.

## Configuration (per project)

Copy the examples into your repo's `.quality-kernel/`:

- **`config/tools.example.json`** → the per-language deterministic tools
  (mutation, CRAP, DRY, deps). Default order: TypeScript → Node → Python.
- **`config/critical-surface.example.json`** → the globs that trigger the
  blast-radius override. If absent, `/forge` treats anything outside
  docs/tests/styling/tooling as critical (fail-safe).

## Tools

- **`scripts/crap.mjs`** — CRAP calculator: `CRAP = c² · (1−cov)³ + c`. Feed it
  a JSON array of `{ name, file, complexity, coverage }` (from your coverage +
  complexity tools); exits non-zero if any function exceeds the threshold
  (default 6).

## Design docs

The full design (why each gate exists, the communication model, the graduation
by tier, the reconciliation with the existing agent arsenal) lives in the
"Fragua" artifact series. This plugin is its materialization.

## Still open

- Wire the epistemic guard from `log` to `block` once the `[EXEMPT]` rate is low.
- Evidence-gate hard-block on unverified completion claims.
- Per-stack adapters that emit the `crap.mjs` input from nyc/coverage.py + eslint/radon.
- Port the Gherkin DRY-checker and Gherkin mutator (no TS/Python equivalent yet).
- Judge calibration (Cohen's kappa ≥ 0.6 over a gold set) for probabilistic judgments.
- Optional GitHub Project integration (one issue per task).
