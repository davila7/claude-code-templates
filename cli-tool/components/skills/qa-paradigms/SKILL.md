---
name: qa-paradigms
description: Decision framework for agentic QA test design. Apply whenever writing, generating, reviewing, or designing automated tests (unit / integration / e2e), or deciding how an agent should produce or validate tests. Encodes 5 research-backed paradigms and which to use for a regression gate vs exploration, how to anchor assertions to an immutable contract, and how to validate adversarially. Invoke before authoring or reviewing any test suite.
---

# Agentic QA — the 5 paradigms

Whenever an LLM agent produces or reviews automated tests, it is implicitly choosing one of these paradigms. **Choose deliberately.** Ranked by reliability *as a regression gate* (the check that must never lie), least → most:

| # | Paradigm | Evidence | Use it as a regression gate? |
|---|----------|----------|------------------------------|
| 1 | **Self-healing selectors** (Testim, Applitools, Playwright Healer) — agent auto-repairs broken locators | **~25% false positives** (MS benchmark): a "healed" test may now exercise a *different flow* and you never find out | **NO — never rely on it for correctness** |
| 2 | **Author-once, run-without-LLM** (Stagehand authoring, Copilot + Playwright MCP) — agent drives the system, observes real behavior, writes a STATIC spec that runs in CI with no LLM | ~85% precision; **human review mandatory before merge** | **YES — this is THE regression pattern** |
| 3 | **Runtime agent** (browser-use, Stagehand agent mode, Shortest) — an agent runs every CI run, reasons live, returns pass/fail | **4× token cost** (114K vs 27K/test); **non-deterministic** (same prompt → different verdicts); "not production-ready at scale as a gate" | **NO — exploration only** |
| 4 | **Contract-based** (PactFlow+AI, trace-based) — assertions anchored to HUMAN-written contracts the agent cannot modify (API schema, Gherkin, acceptance criteria, boolean predicates) | **pass-rate 42% → 93%** vs free generation; solves *"how do you know the test tests the RIGHT thing?"* | **YES — always anchor** |
| 5 | **Adversarial multi-agent validation** (arXiv 2506.02943, "Hallucination to Consensus") — one agent writes, a second INDEPENDENT agent validates without seeing the first's reasoning | beats single agents on mutation score, line coverage, unique-bug detection | **YES — the confidence layer** |

## Decision rule — apply on every test

- **Regression / CI gate** → combine **P2 + P4 + P5**: a static deterministic spec (P2), with assertions anchored to an immutable contract (P4), independently validated by a second agent (P5).
- **Exploration / "does this even work yet"** → **P3** (runtime agent) is fine — but its output is a *lead, not a gate*. Convert every finding into a P2 static spec before it counts.
- **Selectors / locators** → stable-first (**P1 avoidance**): `testid` → role/label → semantic text; never auto-generated CSS classes or positional XPath. A broken selector must **FAIL** so a human fixes it deliberately — never auto-heal.

## Per-test checklist — ALL must hold before a test is a gate

- [ ] **Static & deterministic (P2)** — no LLM at run time; same input → same verdict, every run.
- [ ] **Contract-anchored (P4)** — every assertion maps to a human-written expected value / schema / acceptance criterion the author can't silently change. **Exact values and codes, not the agent's paraphrase of intent.**
- [ ] **Genuine RED-driver** — fails on the broken/absent behavior, passes only on the correct one. Prove it (revert/weaken the behavior → the test goes red).
- [ ] **Behavioral, not static-presence (P1 avoidance)** — exercises the real flow / endpoint, never "element exists".
- [ ] **Stable selectors (P1)** — testid/role/label; no self-heal, no auto-CSS/XPath.
- [ ] **Independently validated (P5)** — a second agent confirms it tests the right thing **without seeing the author's reasoning** (hand it only the test + the contract).
- [ ] **Human review before merge (P2)** — an agent-authored spec is a draft until a human signs off.

## How this composes with the existing review pipeline

- The mandatory **5-agent review pipeline IS the adversarial layer (P5)** — but to make it genuine, the validating agents must receive **only the test + the contract**, NOT the authoring agent's chain-of-thought. Independence is the whole point; sharing the reasoning collapses P5 back to a single agent.
- The **qa-expert TEST SPEC + the issue's acceptance criteria = the contract (P4)**. Assert against it, not against a freely-generated expectation.
- Writing `.spec.ts` / Django `TestCase` that run in CI = **P2**. **Never** gate on a runtime agent (P3) or trust a self-healed selector (P1).
- The "5 QA quality pillars" (genuine RED-driver, behavioral, realistic data, exact assertions, full state + cleanup) are the *implementation* of P4 at the assertion level.

## Anti-patterns (stop if you catch yourself doing these)

- Letting a selector "heal" instead of failing → you may be testing a different flow (P1, 25% wrong).
- Putting an LLM in the CI run loop as the pass/fail decider (P3 as a gate) → non-deterministic, 4× cost.
- Asserting on the agent's own restatement of intent instead of a fixed contract (no P4) → the test passes on broken code (42% baseline).
- One agent writes AND validates its own test, or the validator sees the author's reasoning → no real P5; consensus is fake.
