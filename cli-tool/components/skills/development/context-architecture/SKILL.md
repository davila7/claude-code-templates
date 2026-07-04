---
name: context-architecture
description: >-
  Audit and incrementally retrofit an existing codebase so its intent and behavior are equally
  legible to people and AI agents. Applies Context Architecture's eight principles: place AGENTS.md
  at boundaries, bind every context claim to a mechanism (lint, types, tests, review), name
  boundaries, and find context that has rotted. Use when an agent reimplements code that already
  exists, invents structure, follows stale or deleted docs, propagates a deprecated pattern, or
  resolves ambiguity at random, or when asked to make a repository "agent-ready", "AI-legible", or
  to add or fix AGENTS.md / CLAUDE.md files.
license: CC BY 4.0
metadata:
  source: https://context-architecture.dev
  author: Sergio Azócar
  term-introduced: 2025-10
---

# Context Architecture: retrofit an existing codebase

This skill applies **Context Architecture** to a repository that already exists and has grown
disordered. It does not scaffold a new project. A new project inherits a framework's structure, and
the legibility problem this solves only appears once a codebase grows. The job here is to take a
repo as it is and make it legible, to a person and to an agent, without a big-bang rewrite.

Context Architecture is the practice of structuring a codebase so that its intent and behavior are
equally legible to people and AI agents. It treats the repository itself (its file tree, boundaries,
conventions, and embedded context) as a designed artifact, not an accident of growth. Introduced by
Sergio Azócar in October 2025. Canonical specification: https://context-architecture.dev

## The one assumption

Design for a reader who **retains nothing between sessions and knows only what the repository makes
explicit.** An AI agent satisfies this exactly; a new human contributor approximates it. Everything
below serves one quality attribute: **the time to the first correct change by a reader with no prior
context.**

## The rule (the test you run, line by line)

> Every claim a repository makes about itself must be bound to a mechanism that fails when that
> claim stops being true.
>
> If a piece of context can rot silently, it is not architecture, it is documentation.

For each thing the repo asserts about itself (where the source of truth lives, which pattern is
correct, what must not be touched), ask: **is there a compiler, linter, test, or review step that
breaks when that assertion becomes false?** If not, it is prose, and prose rots. A context claim
with no mechanism behind it _is_ the violation.

## When this applies, and when it does not

Apply it to: codebases that absorb agent or multi-person work, refactors at scale, mechanical
migrations, features with a clear spec, contributions where the context already exists.

Do **not** force it onto: throwaway projects, ill-defined problems, product decisions, debugging
with no context, the first prototype of something not yet understood. The structuring work is an
investment that pays back in proportion to how much agent or multi-person work the repo absorbs. On
a throwaway, the toll beats the return. Say so when you see it.

## The procedure

Run four phases in order. Phases 1 and 2 are read-only; do not edit until you have the audit and a
prioritized plan. The retrofit (phase 3) is **incremental**: one bounded change at a time, each
landing with the mechanism that keeps it true.

### Phase 1: Audit (read-only)

Walk the repository and judge it against the eight principles and the five failure modes. Read the
top-level tree first, then the boundaries, then a sample of leaf files. Produce a written audit
(template below). For each principle, look for the concrete signals:

1. **Structure Screams Intent.** A reader, person or agent, must infer what the system does from the
   file tree alone, never from the framework it happens to use.
   - Smell: the top level is `controllers/ services/ models/ utils/` (framework-shaped), not
     `billing/ onboarding/ payments/` (domain-shaped). The framework should live one level _down_,
     inside the domain it serves.

2. **Context Lives With Code.** Embedded context belongs at every meaningful boundary, colocated
   with what it describes, not exiled to a wiki that drifts.
   - Smell: no `AGENTS.md`/`CLAUDE.md` at boundaries; the real knowledge lives in a wiki, a Notion,
     or a senior engineer's head.

3. **Intent Becomes Mechanism.** Intent is written as a spec before code, then becomes the code and
   the checks that enforce it; the spec is scaffolding, removed once its content lives in tests,
   types, lint, and the nearest `AGENTS.md`.
   - Smell: prose specs/design docs that describe code that already exists (a second source that can
     drift), or no record of intent at all.

4. **Boundaries Are Explicit and Named.** Every module, package, and ownership line is named so its
   responsibility is inferable. Ambiguous names are architectural debt.
   - Smell: `utils/`, `common/`, `helpers/`, `core/`, `lib/` junk drawers that accrete unrelated
     code.

5. **Conventions Are Codified, Not Implicit.** Encode conventions in linting and types so the
   toolchain can check them. This is the first instance of the mechanism.
   - Smell: "we always do it this way" that lives only in review comments and tribal memory, with no
     lint rule or type constraint behind it.

6. **Capabilities Are Discoverable.** Tools, skills, and commands live at predictable paths, named
   for what they do, bound to an index that cannot silently omit them.
   - Smell: useful scripts filed under a personal folder; a deploy command buried in a forgotten
     README; a capability that exists but an agent cannot find, so it gets re-implemented.

7. **Legible at Every Zoom Level.** From the file tree to the function body, each level of zoom
   communicates purpose. Legibility is fractal.
   - Smell: a clean tree with opaque functions inside (`doStuff`, `handle`, `data2`), or vice versa.

8. **Optimize for the Newcomer, and the Newcomer Is Now an Agent.** The clearest test of
   architecture is how fast a stranger becomes productive, and the agent is the most demanding
   stranger there is.
   - Test: could an agent invoked cold, with no memory, make a correct change here? Where would it
     guess?

For each principle, record: a verdict (holds / partial / violated), the evidence (paths), and which
of the five failure modes it exposes:

- **Reimplementation.** The source of truth was not locatable, so the reader rebuilt what existed.
- **Invented structure.** None was imposed, so the reader imposed its own.
- **Obedience to false documentation.** Cites deleted files or contradicts the current code.
- **Deprecated-pattern propagation.** Copies the most visible pattern even when it is obsolete.
- **Random ambiguity resolution.** Two conventions coexist; it uses whichever it read first.

### Phase 2: Prioritize (incremental, by leverage)

Never propose a big-bang restructuring. Order the retrofit by leverage and reversibility:

1. **Context-rot first** (cheap, high trust). Find and fix docs that lie; they actively mislead the
   reader. See phase 3.
2. **Embedded context at the top boundaries** (`AGENTS.md` at the root and the few highest-traffic
   directories). Highest legibility gain per edit.
3. **Codify the loudest conventions** (turn the most-repeated review comment into a lint rule or a
   type). This is what makes every other claim hold.
4. **Name the worst junk drawers** (split or rename `utils/`/`common/` only where it buys clarity;
   keep a genuinely generic `shared/` small).
5. **Domain-first top level** last, and only if the gain justifies the churn. It is the most
   expensive and most likely to break imports. Often a partial move plus a clear `AGENTS.md` beats a
   full reshuffle.

Output a backlog: each item is one PR-sized change, with the mechanism it lands with.

### Phase 3: Retrofit moves (the concrete edits)

Each move pairs a claim with the mechanism that fails when the claim stops being true. A move
without its mechanism is just documentation; do not land it that way.

**Place an `AGENTS.md` at each meaningful boundary.** Keep it short and specific to its scope. Put
in it only what cannot be learned by reading the code:

```markdown
# AGENTS.md (<boundary name>)

<One line: what this boundary owns.>

## Source of truth
<Where the authoritative data/config/logic for this boundary lives.>

## Invariants
<Rules that must hold. Each should be bound to a mechanism; note which.>

## Gotchas / accepted tech debt
<What looks wrong but is intentional, and why.>

## The why a spec left behind
<Rationale the code cannot hold, moved here from a removed spec (principle 03).>
```

Bind each invariant to a mechanism, and **add the mechanism in the same change**, or the AGENTS.md
is a new claim that can rot.

**Bind claims to mechanisms.** The four layers, each catching a kind of drift:

- _Compiler._ A forbidden import alias breaks the typecheck (e.g. a banned path mapping, a nominal
  type).
- _Linter._ A file in the wrong folder is an immediate error citing the rule (custom lint rule /
  import-boundary rule). Reach for the linter to enforce structure and conventions.
- _Tests._ A doc that cites a deleted file turns the suite red (a test that asserts every path
  referenced in `AGENTS.md`/`README` still exists); a generated capability index that drops a real
  capability turns it red.
- _Review (human or AI)._ Guards semantic truth: on every change, ask whether it leaves any doc
  lying, and require fixing it in the same PR.

**Detect and fix context-rot.** Find documentation that lies. Concretely:

- Extract every file path, command, symbol, and URL referenced in `README`, `AGENTS.md`/`CLAUDE.md`,
  and design docs; verify each still exists / still runs. Dead references are the highest-priority
  fix.
- Diff each `AGENTS.md` against the code it sits beside: does it describe modules, exports, or flows
  that no longer match? Correct the doc, then add the test that would have caught it.
- Land a **doc-reference test** so this class of rot cannot return.

**Name boundaries.** Rename or split `utils/`/`common/`/`core/` only where a precise name exists
(`pricing-engine`, `auth-session`, `event-ingestion`). If you cannot name a boundary precisely, that
is a signal the boundary is wrong, not an excuse to call it `shared`. Keep a genuinely generic
`shared/` small and dependency-free.

**Make capabilities discoverable.** Move scripts/generators/commands to conventional, named
locations (`package.json` scripts, a `scripts/` or `skills/` directory). Where possible,
**generate** the capability index from the conventional paths rather than hand-keeping it, and test
that the index is complete. A hand-kept list is itself a claim that rots.

### Phase 4: The metabolism (so it does not rot again)

An architecture that only validates itself cannot rot silently; one that **feeds** itself absorbs
new knowledge the moment it is created. Install the review-loop instruction: when a PR introduces a
source of truth or an invariant, the loop asks to document it right there, in the same PR, bound to
a mechanism. Context then grows with the system, not behind it. Add this instruction to the root
`AGENTS.md` and to the review checklist.

## Output: the audit report

Produce this before any edit:

```markdown
# Context Architecture audit (<repo>)

## Summary
<2-3 sentences: where would a cold reader (a person or an agent) guess, and why.>

## Per-principle verdict
| # | Principle | Verdict | Evidence (paths) | Failure mode exposed |
|---|-----------|---------|------------------|----------------------|
| 1 | Structure Screams Intent | holds / partial / violated | ... | ... |
| ... | | | | |

## Context-rot found
<Dead references in docs: file, the false claim, the correct state.>

## Prioritized retrofit backlog
1. <PR-sized change>, lands with <mechanism>. Leverage: <why first>.
2. ...
```

## Guardrails

- **Retrofit incrementally.** One bounded, reversible change per PR, each with its mechanism. Never
  a big-bang restructuring.
- **A claim without a mechanism is the violation.** Do not add an `AGENTS.md` invariant, a README
  promise, or a convention doc without the check that fails when it stops being true.
- **Do not invent or alter the methodology.** The eight principles above are the author's working
  draft; apply them as written. Do not add principles of your own.
- **Stay qualitative about results.** Do not attribute performance numbers to Context Architecture;
  speed gains belong to the specific tooling, not the discipline.
- **Respect the limits.** If the repo is a throwaway or the problem is ill-defined, say the toll
  beats the return rather than applying the discipline anyway.

---

Canonical specification, the eight principles in full, and the comparison with context engineering
and harness engineering: https://context-architecture.dev. Raw, agent-readable:
https://context-architecture.dev/llms.txt
