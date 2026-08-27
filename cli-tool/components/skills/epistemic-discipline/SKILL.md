---
name: epistemic-discipline
description: Global evidence-discipline for ALL agents and subagents — how certainty is formed, labeled, and verified. Turns seven documented agent failure modes (premature closure, false certainty, read-over-run bias, silver-lining framing, non-blind verification, prose lessons, intent misread) into MECHANISMS - a spawn-blocking preamble hook, a blind breaker agent, a typed critic dimension, and mandatory report templates. Use when diagnosing bugs, verifying work, reviewing severity, or spawning any subagent that produces claims.
---

# Epistemic Discipline

**The problem this solves** (documented, not hypothetical): an agent read the exact buggy line and still shipped a wrong diagnosis labeled "complete"; a test suite certified the bug's code path as correct; five reviewers read the same diff with the author's context and caught nothing — while an independent harness that probed the *real* external system caught it in one run. Root cause across all of it: **the oracle**. Code-reading and mocks observe intent; only the running system observes state. And rules stored as prose don't change conduct — only mechanisms do.

This plugin packages the discipline as mechanisms. It is stack-agnostic: nothing here is specific to one repo or framework.

## The seven failure modes → what enforces each

| # | Failure mode | Mechanism |
|---|--------------|-----------|
| 1 | Closes on the first coherent explanation, never tries to refute itself | `diagnostic-report.md` §4 (WHAT WOULD REFUTE THIS) + `adversarial-critic` Dim-8 |
| 2 | Declares certainty its evidence doesn't support ("confirmed" on inference) | OBSERVED/INFERRED labeling (preamble rule 1-2) + critic score cap on mislabeled claims |
| 3 | Prefers reading code to running the system | Probe-first rule (preamble rule 4, `/diagnose` step 1) + ORACLE_GAP finding |
| 4 | Frames to please (silver-lining severity reports) | `diagnostic-report.md` §1 — RESIDUAL RISK is mandatory-first |
| 5 | Non-blind verification (verifier inherits the author's reasoning) | `pipeline-breaker` input contract: contract + live URL only, PROTOCOL_VIOLATION on leakage |
| 6 | Lessons stored as prose don't change conduct | This plugin itself + the memory rule below |
| 7 | Misreads meta/emotional asks | Prose-only by design (no hook surface): restate the target in one line and confirm before building machinery |

## Components

| File | Kind | What it does |
|------|------|--------------|
| `discipline-preamble.md` (this dir) | template | ~15-line block with literal marker `[EPISTEMIC-DISCIPLINE v1]`, prepended to EVERY subagent prompt |
| `hooks/pre-tool/epistemic-preamble-guard.json` | hook (blocking) | PreToolUse on Task/Agent: spawn without the marker (or `[EPISTEMIC-EXEMPT: <reason>]`) fails with exit 2. Fail-open on hook errors |
| `agents/epistemic-discipline/pipeline-breaker.md` | agent (opus) | Blind breaker — review step 4.5 and generic blind verifier. Executes ≥3 falsifying vectors against the LIVE system; typed verdict BREAKER_PASS/FAIL/INSTRUMENT-BROKEN; no-probe = BLOCK |
| `agents/epistemic-discipline/adversarial-critic.md` | agent (opus) | The critic with **Dimension 8 (Oracle Depth)**: ORACLE_GAP on external-state work with mock-only evidence; INFERRED-as-fact caps score ≤60 → REWORK. These are the template's teeth |
| `diagnostic-report.md` (this dir) | template | Mandatory report order: RESIDUAL RISK → OBSERVED → INFERRED → REFUTATION → MUTATION PATHS → VERDICT |
| `sdd-external-invariants.md` (this dir) | template slot | SDD spec section declaring external-state invariants as falsifiable predicates + probe commands (slot, not gate) |
| `commands/epistemic-discipline/diagnose.md` | command | `/diagnose` — probe-first diagnosis entry point that instantiates the template |

**What is mechanical vs what is prose (honest accounting):** the preamble-guard hook, the breaker's typed verdict, and the critic's score caps are forcing functions. The `/diagnose` command and the SDD slot are conveniences whose teeth live in the critic's Dimension 8. Failure mode #7 is deliberately prose-only — there is no hook surface for interpreting human intent.

## Install (Download & Ignore pattern)

1. Copy into the project (or global `~/.claude/`):
   - `skills/epistemic-discipline/` → `.claude/skills/epistemic-discipline/`
   - `agents/epistemic-discipline/*.md` → `.claude/agents/`
   - `commands/epistemic-discipline/diagnose.md` → `.claude/commands/`
2. Wire the hook into `settings.json` (`.claude/settings.json` or `~/.claude/settings.json`) by merging the `hooks` object from `hooks/pre-tool/epistemic-preamble-guard.json`.
3. Keep `.claude/` gitignored per the Download & Ignore pattern; the templates repo is the source of truth.
4. Verify the hook is live: spawn any subagent without the preamble — the spawn must fail with the BLOCKED message. **A gate that was never seen RED is not known to work.**

## Escape hatches (auditable, not silent)

- **Trivial mechanical spawns** (pure search/fetch agents producing no claims): tag the prompt `[EPISTEMIC-EXEMPT: <reason>]`. The tag is visible in transcripts — exemption is auditable.
- **Hook malfunction**: the guard fails open (exit 0) on its own errors; it can never brick agent work.

## The memory rule (anti-failure-mode #6, meta)

When saving any lesson/feedback memory that contains an actionable behavioral rule: **name the mechanism that enforces it** (hook path, agent dimension, gate, template) — or explicitly tag it `PROSE-ONLY-ACCEPTED: <reason>`. A lesson without a mechanism is a lesson that will be relearned the hard way. This rule is what keeps the next quarter's failure modes from requiring another plugin.

## Language gate (English-only)

Committed source/docs must be English (Spanish only in chat). Two mechanisms:

- **`spanish-gate.py`** (this dir) — a **pre-push** hook (wired via `hooks/pre-tool/language-gate.json`) that scans ONLY the added lines of the outgoing diff and **blocks** `git push` / `gh pr create` (exit 2) when they introduce Spanish. Never re-flags pre-existing debt — only what this push would add. Fail-open on hook errors; override `CLAUDE_LANG_GATE_OVERRIDE=1` (logged).
- **`spanish-scan.py`** (this dir) — a whole-repo audit (`python3 spanish-scan.py <path>`), exit 1 if Spanish found (CI-usable).

Signals: accented chars, `¿¡`, the review-severity labels `CRÍTICO/ALTO/MEDIO/BAJO` (use `CRITICAL/HIGH/MEDIUM/LOW`), and ≥2 Spanish comment words per line. Allow-list: `i18n`/`locale`/`unicode`/`non-ASCII` and any line tagged `EXEMPT-ES <reason>` (intentional non-English — a unicode fixture, or a functional Spanish string such as a CSV-header matcher). Install per the section above (copy the two `.py` into `~/.claude/hooks/`, merge the hook into `settings.json`).

**Why it belongs here:** the plugin's thesis is *turn each lesson into a standing automated check pointed at real output*. A teammate's agent found Spanish across our PRs because they scan and we didn't — this gate closes that gap mechanically. It was proven RED against a Spanish diff and GREEN against a clean one before being trusted.
