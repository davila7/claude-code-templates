---
allowed-tools: Read, Bash, Glob, Grep, Agent
argument-hint: "<symptom or bug description> [--probe <command>] [--env <target env>]"
description: Disciplined diagnosis entry point — probe the real system first, enumerate all mutation paths, attempt to refute the leading hypothesis, and report in the mandatory diagnostic-report format (residual risk first, OBSERVED vs INFERRED separated).
---

# Diagnose (epistemic-discipline)

Diagnose: **$ARGUMENTS**

Honesty note: this command is a convenience entry point — the enforcement teeth live in `adversarial-critic` Dimension 8, which rejects diagnoses that skip this procedure. Invoking `/diagnose` just makes following it the path of least resistance.

## Procedure (in this order — the order IS the method)

### 1. Probe before reading

Identify the **cheapest live probe** of the affected state (<15 min): a read-only state endpoint (`dry_run`/list/describe), a harness probe command, a CLI query against the real backing service. If `--probe` was given, that is your instrument.

**Run it NOW, before reading any implementation code.** Record the literal output. This is your baseline OBSERVED fact — the diagnosis must explain *this*, not what the code suggests should be true.

If no probe exists or it errors on a known-clean baseline → the instrument is broken; report `INSTRUMENT-BROKEN` and make building/fixing the probe the first recommendation. Do not substitute inference and continue as if probed.

### 2. Enumerate ALL mutation paths

Before forming any hypothesis: list every path that mutates the state in question — handlers, serializers, signals, async jobs, crons, external services, admin/back-office paths. Grep is your friend; the list must be exhaustive, each entry marked `examined` / `not examined`. The bug class you will miss lives in the path you did not list.

### 3. Hypothesis + refutation attempt

Form the leading hypothesis from probe output + code. Then immediately ask: **what evidence would refute it?** If that evidence is obtainable (another probe, a repro, a log query) — obtain it. A hypothesis that survives its own refutation attempt is strong; one whose refutation was not attempted is just a story that fits.

Watch for the classic trap: the first coherent explanation that fits the observed evidence. Ask explicitly: *what OTHER mechanism would produce the same evidence?* (Two candidate mechanisms → design the probe that discriminates between them.)

### 4. Report — mandatory format

Fill the `diagnostic-report.md` template (skills/epistemic-discipline/) exactly, sections in order:

1. **RESIDUAL RISK** — first, always. What can still go wrong right now.
2. **OBSERVED** — runtime facts + the commands that produced them.
3. **INFERRED** — deductions, each naming its source.
4. **WHAT WOULD REFUTE THIS** — and whether you ran it.
5. **MUTATION PATHS** — the exhaustive list with examined/not-examined marks.
6. **VERDICT** — `CONFIRMED` (observed repro/probe, cited) | `HYPOTHESIS strong/weak` (+ the single next probe) | `INSTRUMENT-BROKEN`.

## Hard rules

- "Confirmed" / "root cause" / "diagnosis complete" only with an OBSERVED mechanism. Otherwise the deliverable is titled **hypothesis**.
- Never close with mutation paths marked `not examined` unless the verdict says so explicitly.
- If the fix will be implemented next: the probe from step 1 must be re-runnable as the fix's acceptance check — RED before the fix, GREEN after. A fix validated only by mocks re-opens this whole procedure.
