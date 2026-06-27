---
name: context-architecture
description: >-
  Audit a codebase and bind every claim it makes about itself to a mechanism that fails when the claim
  stops being true, so it is legible to people and AI agents. Applies Context Architecture's nine principles: make structure say what
  the system does, place AGENTS.md at boundaries, codify conventions, and bind every claim the repo
  makes about itself to a mechanism (compiler, linter, automated tests, review) that fails when the
  claim stops being true. Works greenfield (a repo born legible) and brownfield (a repo restructured
  in steps). Use when an agent reimplements code that already exists, invents structure, follows
  stale or deleted docs, propagates a deprecated pattern, or resolves ambiguity at random, or when
  asked to make a repository "agent-ready", "AI-legible", or to add or fix AGENTS.md / CLAUDE.md
  files.
license: CC BY 4.0
metadata:
  source: https://context-architecture.dev
  author: Sergio Azócar
  term-introduced: 2025-10
---

# Context Architecture: bind a repository's claims to mechanisms

This skill applies **Context Architecture** to a repository: it makes the repo's intent and behavior
equally legible to people and AI agents, and binds every claim the repo makes about itself to a
mechanism that fails when that claim stops being true. It works from the first commit (a repo can be
born legible) and on a repo that grew without design (restructured in steps, never all at once). The
job is to take the repo as it is and make it legible and self-verifying, without a big-bang rewrite.

Context Architecture treats the repository itself (its file tree, boundaries, conventions, and
embedded context) as a designed artifact, not an accident of growth. Introduced by Sergio Azócar in
October 2025. Canonical specification: https://context-architecture.dev

## The one assumption

Design for a reader who **retains nothing between sessions and knows only what the repository says
out loud.** An AI agent meets this exactly; a new human contributor approximates it.

## The rule (the test you run, claim by claim)

> Every claim a repository makes about itself must be bound to a mechanism that fails when that
> claim stops being true.

That is the whole architecture. Everything else is how you apply it.

A claim is anything the repository holds about itself, not just the shape of its folders. "Prices
are computed in this module and nowhere else" is a claim. "This operation responds within a certain
time" is a claim. "This data format does not break for the people already using it" is a claim. For
each one, ask: **is there a compiler, a linter rule, an automated test, or a review step (by a
person or an agent) that breaks when that stops being true?** If not, it is prose, and prose goes
stale without anything noticing. A claim with no mechanism behind it _is_ the violation.

The mechanism has to actually fail, not just exist. A performance test that never exercises the slow
path does not satisfy the rule, it violates it. The rule applies to itself: the set of tests and
rules that verify the repository is itself a set of claims, so it too is bound to a mechanism that
fails if it is weakened.

## The loop (write a claim, verify it, repeat on every change)

Working with an agent is a continuous flow of code changes. The rule lives inside that flow, not off
to the side:

1. **Write the claim.** A change introduces or modifies something the repository holds about itself:
   a new source of truth, an invariant, a convention.
2. **Verify it.** Bind that claim to a mechanism that fails when it stops being true, in the **same
   change**. A change that touches existing code also meets the mechanisms already there: if it
   violates a claim, something goes red before it reaches production.
3. **Repeat on every change.** This is not a setup you do once. It is a property maintained change by
   change, which is why the repository's context grows with the system instead of falling behind.

When a change adds a new claim and leaves it loose, review (by a person or an agent) catches it and
requires it to be bound before the change is accepted.

## Works with or without a person in the loop

Context Architecture serves the whole autonomy spectrum. What changes across it is **who consumes
the verification, not the verification.** The same `AGENTS.md` and the same mechanisms work at every
level:

| Level | Who reviews | What breaks without repository discipline |
| --- | --- | --- |
| Inline | a person approves each edit | the agent reimplements things that already exist; the person burns time on what the tools could have caught |
| Async | a person reviews the change before integrating it | review does not scale; the integration gate exists but enforces nothing, one click lets a change through |
| Autonomous | a person sets the rules, does not look at each change | if the mechanisms are missing, "done" is empty: the agent calls a change finished when it passes but is wrong |
| Orchestrated | nobody in the middle | the error multiplies at machine speed; the only arbiters are the repository's mechanisms |

When there is a person, the mechanisms absorb the routine checks, so the person spends attention on
what needs judgment. When there is no person, the mechanisms are the reviewer.

## The kinds of mechanism (not tools)

Binding a claim is connecting it to something that fails when it stops being true. Context
Architecture names the kinds of mechanism; the repository picks the product (`oxlint` or `eslint`,
it makes no difference), and the infrastructure runs it on each change.

- **The compiler** catches what can be expressed in types: reintroducing a forbidden import breaks
  the build.
- **The linter** catches problems of structure and convention: a file in the wrong folder fails the
  lint and cites the rule it breaks.
- **Automated tests** catch documentation that lies and behavior that strays: an `AGENTS.md` that
  mentions a deleted file turns the tests red.
- **Review**, by a person or an agent, catches the meaning the others do not see: on each change it
  asks whether any document now says something false, and requires the fix in the same change.

The split is clean: Context Architecture decides **what** gets verified and guarantees the mechanism
exists and fails. The infrastructure runs it.

## When this applies, and when it does not

Apply it to: repositories that absorb agent or multi-person work, refactors at scale, mechanical
migrations, features with a clear spec. It applies from the first commit (a repository can be born
legible) and to one that grew without design, restructured in steps.

Do **not** force it onto: throwaway projects, ill-defined problems, the first prototype of something
not yet understood. The structuring work is an investment that pays back in proportion to how much
agent or multi-person work the repo absorbs. On a throwaway, the cost outweighs the return. Say so
when you see it.

## The nine principles

Each principle is a property you can check, not an aspiration. Either it is true of the repository
and bound to a mechanism, or it is not. If it cannot be bound to something that fails, it is not a
principle.

### Let the repository say what it is

**01 · Structure Screams Intent.** The file tree says what the system does, not what framework built
it. A `billing/` folder names a business responsibility; a `controllers/` folder names a technical
detail that could belong to any system. The framework lives one level down, inside the domain it
serves.
_Mechanism: a linter rule that errors when a file lands in a folder that does not match its domain._

**02 · Context Lives With Code.** Context lives next to the code it describes, at every important
boundary, not in a separate wiki that goes stale. It holds only what the code cannot say on its own:
where the source of truth is, what invariants must be respected, what tech debt was accepted on
purpose, what behavioral limits apply.
_Mechanism: a test that fails if an `AGENTS.md` mentions a file that no longer exists._

**03 · Boundaries Are Explicit and Named.** Each module and package is named for the responsibility
it owns. Folders like `utils/`, `common/`, or `helpers/` collect anything, because the name rules
nothing out. Genuinely shared, domain-free code goes in a small `shared/` with no dependencies
toward any domain. If you cannot name a boundary precisely, the boundary is usually drawn wrong.
_Mechanism: a rule that forbids a module from importing across another boundary through paths that
are not allowed, and breaks the build when it happens._

**04 · The Repo Is Legible at Every Zoom Level.** Legibility works at every level. A clean tree with
functions named `doStuff` or `data2` is legible at one level and illegible at the next. The same
discipline that names folders names functions, types, and variables.
_Mechanism: linter rules on names and complexity limits._

**05 · Capabilities Are Discoverable.** The project's tools, scripts, and commands live in
predictable places with names that say what they do (`package.json` scripts, a `scripts/` folder, a
skills folder). A capability an agent cannot find does not exist for that agent: it reimplements it.
The list of capabilities is generated from those predictable places, not written by hand.
_Mechanism: the list generated from the conventional paths, and a test that fails if a real
capability does not appear in it._

### Bind every claim to a mechanism

**06 · Intent Becomes Mechanism.** Intent is written as a spec before the code, then turned into the
code and into the tests and rules that enforce it, and the spec is removed once its content already
lives there. What stays is the intent and its verification, not the code that satisfies it: as long
as the tests pin down the behavior, that code can be regenerated.
_Mechanism: the tests, the types, and the rules the spec was turned into._

**07 · Conventions Are Codified, Not Implicit.** A convention that lives only in people's heads is
invisible to an agent, and the agent will break it. Take it out of the culture and put it in the
tools that review the code: linter rules, type constraints, automated validations in CI that state
the rule and enforce it in the same place.
_Mechanism: the linter rules and the type constraints._

**08 · Behavior Is Verifiable, Not Asserted.** Every claim about how the system behaves (how long an
operation may take, what data must not cross a boundary, what format must not break for the people
already using it) is bound to an automated test that lives in the repository and goes red when the
behavior strays. A time limit in a document goes stale; the same limit bound to a test that fails
when it is exceeded is architecture.
_Mechanism: an automated behavior test (performance, data contract, security) that lives in the
repository and fails when the behavior deviates._

**09 · The Verification Surface Is Itself Bound.** The set of tests and rules that verify the
repository is, in turn, a set of claims, so it too is bound. An agent can rewrite the code freely,
but it cannot weaken or delete a test, a rule, or a validation to get a change through. Without a
person reviewing, this is the principle that matters most: the cheapest way to make a validation
pass is to remove it.
_Mechanism: a validation that goes red if the set of tests and rules changes without the
authorization the repository defined._

## The procedure

Run four phases in order. Phases 1 and 2 are read-only; do not edit until you have the audit and a
prioritized plan. The work in phase 3 is **incremental**: one bounded change at a time, each landing
with the mechanism that keeps it true.

### Phase 1: Audit (read-only)

Walk the repository and judge it against the nine principles. Read the top-level tree first, then
the boundaries, then a sample of leaf files. For each principle, record a verdict (holds / partial /
violated), the evidence (paths), and the mechanism that is (or should be) bound to it.

Use the **five failure modes** as diagnostic signals: each is what a cold reader does when a claim
is not bound, and each points back at the principle that is loose. A better model lowers their
frequency, it does not remove them, because the missing mechanism is in the repository, not the
reader. When you see one of these in the repo's history (or imagine a cold agent producing it), name
the unbound claim behind it:

- **Reimplementation.** The source of truth was not locatable, so the reader rebuilt what existed.
  (Points at 01, 03, 05.)
- **Invented structure.** None was imposed, so the reader imposed its own. (Points at 01, 03.)
- **Obedience to false documentation.** Cites deleted files or contradicts the current code. (Points
  at 02, 06.)
- **Deprecated-pattern propagation.** Copies the most visible pattern even when it is obsolete.
  (Points at 04, 07.)
- **Random ambiguity resolution.** Two conventions coexist; it uses whichever it read first. (Points
  at 07.)

### Phase 2: Prioritize (incremental, by leverage)

Never propose a big-bang restructuring. Order the work by leverage and reversibility:

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

### Phase 3: The moves (the concrete edits)

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
<Rationale the code cannot hold, moved here from a removed spec (principle 06).>
```

Bind each invariant to a mechanism, and **add the mechanism in the same change**, or the AGENTS.md
is a new claim that can go stale.

**Bind claims to mechanisms.** The four kinds, each catching a kind of drift:

- _Compiler._ A forbidden import alias breaks the typecheck (a banned path mapping, a nominal type).
- _Linter._ A file in the wrong folder is an immediate error citing the rule (custom lint rule /
  import-boundary rule). Reach for the linter to enforce structure and conventions.
- _Tests._ A doc that cites a deleted file turns the suite red (a test that asserts every path
  referenced in `AGENTS.md`/`README` still exists); a generated capability index that drops a real
  capability turns it red.
- _Review (person or agent)._ Guards semantic truth: on every change, ask whether it leaves any doc
  lying, and require fixing it in the same change.

**Detect and fix context-rot.** Find documentation that lies:

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
that the index is complete. A hand-kept list is itself a claim that goes stale.

### Phase 4: Keep the loop running

Context grows with the system only if write-and-verify runs on every change. Install the review-loop
instruction: when a change introduces a source of truth or an invariant, the loop asks to document
it right there, in the same change, bound to a mechanism. Add this instruction to the root
`AGENTS.md` and to the review checklist, so a new claim cannot land loose. Bind the verification
surface itself (principle 09) so the mechanisms cannot be weakened to get a change through.

## Output: the audit report

Produce this before any edit:

```markdown
# Context Architecture audit (<repo>)

## Summary
<2-3 sentences: where would a cold reader (a person or an agent) guess, and why.>

## Per-principle verdict
| # | Principle | Verdict | Evidence (paths) | Mechanism (bound / missing) |
|---|-----------|---------|------------------|------------------------------|
| 1 | Structure Screams Intent | holds / partial / violated | ... | ... |
| ... | | | | |

## Failure-mode signals
<For each signal observed: the failure mode, the unbound claim behind it, the principle it points at.>

## Context-rot found
<Dead references in docs: file, the false claim, the correct state.>

## Prioritized backlog
1. <PR-sized change>, lands with <mechanism>. Leverage: <why first>.
2. ...
```

## Guardrails

- **Work incrementally.** One bounded, reversible change at a time, each with its mechanism. Never a
  big-bang restructuring.
- **A claim without a mechanism is the violation.** Do not add an `AGENTS.md` invariant, a README
  promise, or a convention doc without the check that fails when it stops being true.
- **The mechanism must actually fail.** A test that never exercises the path it guards violates the
  rule, it does not satisfy it.
- **Do not invent or alter the methodology.** The nine principles above are the author's
  methodology; apply them as written. Do not add principles of your own.
- **Stay qualitative about results.** Do not attribute performance numbers to Context Architecture;
  speed gains belong to the specific tooling, not the discipline.
- **Respect the limits.** If the repo is a throwaway or the problem is ill-defined, say the cost
  beats the return rather than applying the discipline anyway.
- **It does not make the agent smarter.** It makes the truth of the repository checkable
  automatically, so an error fails at once and where it happened, instead of integrating without
  anything noticing.

---

Canonical specification, the nine principles in full, and the comparison with context engineering
and harness engineering: https://context-architecture.dev. Raw, agent-readable:
https://context-architecture.dev/llms.txt
