# Diagnostic report template — mandatory section order

Every root-cause / bug-diagnosis report MUST use these sections, in this order. The order is the mechanism: residual risk cannot be buried, observed facts cannot be blended with inference, and a conclusion cannot be closed without naming its refutation. Enforcement teeth: `adversarial-critic` Dimension 8 rejects diagnoses that skip sections or mislabel evidence (score cap → REWORK).

---

## 1. RESIDUAL RISK (always first)

What can still go wrong right now, before any fix lands. Worst realistic outcome first. Mitigations may be listed AFTER the risk — never instead of it, never as the headline.

## 2. OBSERVED

Facts you obtained by executing or measuring the real system. Each entry lists the command/probe used and its output (or a path to it). If this section is empty, say `NONE — this diagnosis is inference-only` in bold.

## 3. INFERRED

Everything deduced from code-reading, logs, docs, or reasoning. Each entry names what it was deduced FROM. Claims here may never use "confirmed", "root cause", or "fixed".

## 4. WHAT WOULD REFUTE THIS

For the leading hypothesis: the concrete evidence that would prove it wrong, and the probe/command that would produce that evidence. If the probe was runnable and was NOT run, the verdict below cannot be "confirmed".

## 5. MUTATION PATHS

Exhaustive list of every path that mutates the state in question (handlers, serializers, signals, async jobs, crons, external services). Mark each one `examined` or `not examined`. Naming a culprit while paths remain `not examined` must be flagged as such.

## 6. VERDICT

One of:
- `CONFIRMED` — the mechanism was OBSERVED (reproduced or probed at runtime). Cite the section-2 entry.
- `HYPOTHESIS (strong|weak)` — inference-based. State the single next probe that would confirm or kill it.
- `INSTRUMENT-BROKEN` — the probe needed to decide is unavailable/broken. Fixing the instrument IS the next step; do not substitute inference.
