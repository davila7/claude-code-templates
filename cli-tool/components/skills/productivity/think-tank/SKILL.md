---
name: think-tank
description: Run a Virtual Think Tank — a structured multi-persona debate — before planning or making architectural/design/strategic decisions. Use this skill whenever the user is about to plan a system, make a technology choice, evaluate trade-offs, decide on an approach, or faces any decision where multiple perspectives would sharpen the outcome. Also trigger when the user says "think tank", "debate this", "perspectives on", "trade-offs", "should I use X or Y", "help me decide", "before we plan", or asks for pros/cons of competing approaches. This skill should run BEFORE any implementation planning begins — it produces a structured analysis that feeds into better plans.
---

# Virtual Think Tank

Simulate a moderated expert debate to surface trade-offs and blind spots before committing to a plan. The deliverable is a **structured analysis** the human uses to decide — no answer is handed down, but the panel still converges: it names a strongest option under an explicit condition, or an explicit either/or for the user to arbitrate (Phase 4). The human makes the call.

The personas debate **within one context**, not as separate agents: each sees the others' arguments, concedes points, builds on ideas, and can change position. That shared awareness is what makes the synthesis coherent.

## The run — steps in order

Work through six phases. Phases 1–4 each end on a **completion criterion**; do not advance until it is met.

### Phase 1 — Frame the decision

Pin down exactly what is being decided. Ask the user for anything unclear: the decision itself, the constraints (team, timeline, budget, existing systems, regulatory), what has already been tried, and what a good outcome looks like.

Restate the decision back to the user as one crisp problem statement.

**Completion criterion:** the user has confirmed a single-sentence problem statement. The debate targets that exact question.

### Phase 2 — Assemble the panel

Build 4–6 personas with genuinely divergent priors. Composition is the whole point — see [Casting the panel](#casting-the-panel) for how to pick them. If the user already named panelists, use them; otherwise propose a panel and let the user approve or adjust before proceeding.

**Completion criterion:** the user has approved a panel of one moderator plus 3–5 voices that disagree on something substantive.

### Phase 3 — Run the debate

If the repo has a `CONTEXT.md`, read it first so the personas argue in the project's own vocabulary rather than inventing jargon; check ADRs in the area under discussion. When the decision concerns this codebase, personas cite actual files, constraints, and prior decisions — read them if needed.

Run it as a moderated discussion where each persona responds to the previous speaker:

1. **Opening statements** (~1 paragraph each) — each persona's initial position.
2. **First user check-in** — the moderator turns to the user: "Did any opening position surprise you or miss something about your situation?" Pause, wait, and feed the answer back into the debate.
3. **Moderated rounds** — the moderator drives with focused questions: "What's the strongest argument against your own position?" · "Where do you two actually agree, and where is the real disagreement?" · "What would change your mind?" · "What risk are we not talking about?" · "How does this look at 10× scale? At 0.1×?"
4. **Personas question the user** — when a persona needs context to argue well, it asks the user directly and the debate pauses for the answer. This adaptation to the user's real situation is where the value is.
5. **Wildcard interjection** — the outside thinker offers a reframing or analogy from their domain.
6. **Second user check-in** — before converging: "We're near some conclusions. Is there anything we haven't addressed? Has the discussion changed how you see the problem?"

**Label every claim OBSERVED or INFERRED.** A think tank runs on inference — confident voices, none of it verified. Mark each load-bearing claim so the user can see which rest on evidence and which are educated guesses.

**Reach for the oracle when a claim is cheap to test.** When the debate turns on a claim that is *falsifiable* and *cheap to check* — a benchmark number, a library behavior, an API shape, a layout question — stop debating it. The moment a claim goes **red** (contested, load-bearing, and testable), the moderator settles it with evidence instead of letting personas keep asserting: build a throwaway probe or prototype in a scratch directory, read-only or sandboxed — never mutating the repo — report what it ran, and discard it afterward. Record the result against the **red** claim so it reaches the summary. This is a conditional move, not a mandatory phase: it fires only when the ground is testable, which is the minority of claims.

**Completion criterion:** every persona has taken a position, both user check-ins have happened, each load-bearing claim carries an OBSERVED/INFERRED label, and every **red** claim has been settled by a probe or is carried forward as unresolved.

### Phase 4 — Converge (the gate)

Debate to convergence — **run more than one round.** After the first round the moderator states, in order: the points of genuine **consensus**, then the narrowed **axis of disagreement**, then the strongest *unresolved* points — and runs additional focused rounds on those alone. Repeat until one of two end states is reached:

- **(A) A strongest option**, named, with the explicit condition that makes it win ("choose X *if* Y is true").
- **(B) An irreducible trade-off** only the user can arbitrate, stated as a crisp either/or with the consequence of each side ("X buys you … at the cost of …; Y the reverse").

**Completion criterion — the gate:** you may not produce the Phase 5 summary until the debate has reached **(A)** or **(B)** and recorded it in the summary's **Convergence** section. "We surfaced good points" is not an end state. If two focused rounds produce no new argument on the axis, that *is* end state (B) — write it as the either/or, naming what was tried. A summary whose **Convergence** section names neither **(A)** nor **(B)** means the gate has not been met; run another round.

### Phase 5 — Produce the output

Emit the structured summary in [the output format](#output-format). This is what feeds planning.

### Phase 6 — Hand off to planning

Present the summary and ask: "Does this capture the key considerations? Which trade-offs matter most to your situation? Ready to move into planning, or dig deeper on a point?" The output is *input to the plan*, not the plan. The human decides.

---

## Casting the panel

Reference for Phase 2. A good panel is diverse on purpose:

- **1 Moderator** — a neutral, balanced figure who keeps focus, synthesizes, and pushes for clarity. Opens and closes, asks provocative follow-ups, and calls out when panelists talk past each other.
- **2–3 Domain voices** — real or fictional figures with distinct, opposed positions. They must genuinely disagree on something substantive, not merely differ in enthusiasm. Ask: "Who argues hardest *for* approach A?" and "Who pushes back hardest?"
- **1 Wildcard** — an outside thinker who brings transferable wisdom from another domain (a management theorist in a technical debate, a philosopher in a product one). This is where the unexpected insight comes from — let them challenge assumptions, not be polite.
- **1 Practitioner** (optional) — someone who has done the thing at scale, in production, with real users. Keeps the debate grounded.

Guidelines: prefer real, named figures — the model inhabits a specific person more richly than a generic "senior engineer." Personas speak in first person, in their authentic voice: Fowler measured, DHH blunt, Drucker reframing with questions. Fictional characters fit the wildcard slot. When addressing the user, personas speak as direct colleagues to the decision-maker.

Keep the disagreement real: personas argue with evidence, examples, and analogies, and the moderator pushes back on vague claims ("scalable in what dimension?"). A simulated panel drifts toward theatrical, performative conflict — steer it back to substantive disagreement.

## Output format

```
## Think Tank Summary: [Problem Statement]

### Panel
[Panelists and their roles/perspectives]

### Key Debate Highlights
[2-3 exchanges where something shifted or crystallized — include moments where user input changed direction.]

### User-Revealed Context
[Constraints, preferences, or realities the user shared that shaped the debate — so nothing they said is lost.]

### Consensus Points
[What all or most panelists agreed on — high-confidence inputs to planning.]

### Core Trade-offs
[The real axes of disagreement, each stated as a trade-off, not one side being right.]
- Trade-off 1: [X] vs [Y] — X gives you [...] but costs [...]

### Conditional Recommendations
[If-then, not absolutes.]
- If [condition], then [approach] because [reasoning]

### Convergence (the gate)
[Exactly one end state — the gate is met only if this names (A) or (B):]
- (A) Strongest option: <named option> — wins if <condition>
- (B) Irreducible either/or: <X buys … at cost of …> vs <Y buys … at cost of …>; tried: <rounds/arguments that produced no movement>

### Evidence (probes run)
[Every claim that went red and the throwaway probe/prototype result that settled it, plus any red claim left unresolved — the only OBSERVED evidence in an otherwise inferential session. "None" if the debate stayed fully in-context.]

### Risks & Blind Spots
[What the panel flagged as under-discussed or easy to overlook.]

### Open Questions
[Secondary questions the debate could not resolve. The primary end state — the named option or the irreducible either/or — lives in Convergence above, not here.]

### Suggested Next Steps
[Concrete actions: research, prototype, test, or decide before planning.]
```

## Tips

- **Prime the context first** — share relevant docs, code, or diagrams before running; concrete context yields far better input.
- **Let the model suggest panelists** — it often finds relevant experts you would not have.
- **Reconvene for focused follow-ups** — after the first debate the user may want to dig into one question; run a subset of the panel on it.
- **The summary is the deliverable** — the debate entertains; the structured summary is what improves the plan. Make it sharp and actionable.
