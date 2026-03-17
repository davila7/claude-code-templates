---
name: think-tank
description: Run a Virtual Think Tank — a structured multi-persona debate — before planning or making architectural/design/strategic decisions. Use this skill whenever the user is about to plan a system, make a technology choice, evaluate trade-offs, decide on an approach, or faces any decision where multiple perspectives would sharpen the outcome. Also trigger when the user says "think tank", "debate this", "perspectives on", "trade-offs", "should I use X or Y", "help me decide", "before we plan", or asks for pros/cons of competing approaches. This skill should run BEFORE any implementation planning begins — it produces a structured analysis that feeds into better plans.
---

# Virtual Think Tank

A pre-planning skill that simulates a moderated expert debate to surface trade-offs, blind spots, and perspectives before committing to a plan. Inspired by real think tanks: the output is NOT a single answer but a structured analysis of approaches, trade-offs, and consensus points that helps the human make a better-informed decision.

## Why This Exists

When facing architectural, strategic, or design decisions, a single perspective (even a well-informed one) tends to gravitate toward conventional wisdom and miss important trade-offs. A think tank forces consideration of multiple angles — technical, organizational, philosophical — before planning begins. The result is plans that account for more of reality.

## How It Works

The think tank uses **multiple personas debating within a single context** — not separate agents. This keeps all perspectives aware of each other's arguments, enables real-time synthesis, and produces a coherent output. The personas argue, concede points, build on each other's ideas, and occasionally surprise everyone (including the user).

## Running the Think Tank

### Phase 1: Frame the Decision

Before assembling the panel, clearly understand what's being decided. Ask the user (if not already clear):

1. **What is the decision or problem?** (e.g., "monolith vs microservices for a new e-commerce platform")
2. **What constraints exist?** (team size, timeline, budget, existing systems, regulatory)
3. **What's already been tried or considered?** (avoid rehashing known ground)
4. **What would a successful outcome look like?** (helps the panel focus)

Restate the problem back to the user in a crisp problem statement before proceeding. This ensures the think tank debates the right question.

### Phase 2: Assemble the Panel

Build a panel of 4–6 personas. The composition matters — diversity of perspective is the whole point.

**Panel structure:**

- **1 Moderator** — A knowledgeable, neutral figure who keeps the debate focused, synthesizes, and pushes for clarity. Pick someone known for balanced analysis in the relevant domain. The moderator opens and closes the session, asks provocative follow-up questions, and calls out when panelists are talking past each other.

- **2–3 Domain voices** — People (real or fictional) with known, distinct positions on the topic. These are the core debaters. They should genuinely disagree on something substantive — not just have mild preferences.
  - Ask the LLM: "Who would advocate strongly for approach A?" and "Who would push back hardest on that?"
  - Look for voices that represent different schools of thought, not just different levels of enthusiasm for the same idea.

- **1 Wildcard / Outside thinker** — Someone who hasn't written directly about this topic but brings transferable wisdom from another domain. This is where the unexpected insights come from. A management theorist in a technical debate. A philosopher in a product discussion. A novelist in an architecture review. The wildcard prevents the conversation from being too predictable.

- **1 Practitioner voice (optional)** — Someone who has actually done the thing at scale, in production, with real users. Keeps the debate grounded.

**Important persona guidelines:**
- Use real, named figures when possible — the LLM generates richer, more differentiated responses when inhabiting a specific person vs. a generic "senior engineer."
- Personas should speak in first person, in their authentic voice. Martin Fowler is thoughtful and measured. DHH is direct and opinionated. Peter Drucker asks questions that reframe the problem.
- Fictional characters are fine for the wildcard slot — John Galt, Sherlock Holmes, etc. They add variety.
- If the user suggests specific panelists, use them. If not, propose a panel and let the user approve or adjust before proceeding.

### Phase 3: Run the Debate

Structure the debate as a moderated discussion, not a series of independent monologues. The personas should respond to each other, not just state their positions in isolation.

**The user is a participant, not a spectator.** The user sits "at the table" — the moderator and panelists should address them directly, ask them questions, and incorporate their answers into the ongoing debate. The user is the decision-maker; the panel is there to serve them. Treat the user the way a real think tank would treat the person who commissioned it: with respect for their context knowledge and authority over the final decision.

**Debate structure:**

1. **Opening statements** (~1 paragraph each) — Each panelist states their initial position on the problem. Keep these concise — the real value comes from the interaction.

2. **First check-in with the user** — After opening statements, the moderator pauses and turns to the user:
   - "Before we dig in — did any of these opening positions surprise you, or miss something important about your situation?"
   - "Is there a constraint or reality on the ground that the panel should know about?"
   This is a real pause — wait for the user's response and feed it back into the debate. If the user reveals something (e.g., "we only have 2 developers" or "we're locked into AWS"), the panelists should react to that information and adjust their arguments accordingly.

3. **Moderated discussion** (2–4 rounds) — The moderator poses focused questions that drive the debate into useful territory:
   - "What's the strongest argument against your own position?"
   - "Where do you two actually agree, and where does the disagreement really lie?"
   - "What would change your mind?"
   - "What's the risk we're not talking about?"
   - "How does this look different at 10x scale? At 0.1x scale?"

4. **Panelists can question the user directly.** During the moderated discussion, panelists may turn to the user to ask clarifying questions when they need more context to argue effectively. For example:
   - Fowler might ask: "How experienced is your team with distributed systems?"
   - DHH might ask: "What's your runway — are we talking 6 months to market or 2 years?"
   - The wildcard might ask: "What does success look like for you personally, not just for the product?"
   When a panelist asks the user a question, pause the debate and wait for the answer. Then resume with the panelists reacting to the new information. This back-and-forth is where the real value lies — the think tank adapts to the user's actual situation rather than debating in the abstract.

5. **Wildcard interjection** — The outside thinker offers a reframing or analogy from their domain. This often shifts the conversation in productive ways.

6. **Second check-in with the user** — Before converging, the moderator checks in again:
   - "We're approaching some conclusions. Is there anything you feel we haven't addressed?"
   - "Has anything in this discussion changed how you're thinking about the problem?"
   This gives the user a chance to redirect before the summary phase.

7. **Convergence check** — The moderator identifies:
   - Points of genuine consensus (things everyone agrees on)
   - The real axis of disagreement (often narrower than it first appeared)
   - Conditions under which each approach wins ("If X is true, do A; if Y is true, do B")

**Tone guidelines:**
- Personas should argue substantively, not just state opinions. Use evidence, examples, analogies.
- Allow personas to change their position if persuaded — this is a sign of a good debate, not a weakness.
- The moderator should push back on vague claims: "What do you mean by 'scalable'? Scalable in what dimension?"
- Keep the energy high but respectful. Real intellectual disagreement, not performative conflict.
- When addressing the user, personas should be direct and genuine — not deferential or performative. They're experts having a real conversation with the decision-maker.

### Phase 4: Produce the Output

After the debate, produce a structured summary. This is what feeds into the planning phase.

**Output format:**

```
## Think Tank Summary: [Problem Statement]

### Panel
[List panelists and their roles/perspectives]

### Key Debate Highlights
[2-3 of the most illuminating exchanges or insights from the debate — the moments where something shifted or crystallized. Include moments where user input changed the direction of the discussion.]

### User-Revealed Context
[Key constraints, preferences, or realities the user shared during the debate that shaped the panel's thinking. This section ensures nothing the user said gets lost.]

### Consensus Points
[Things all or most panelists agreed on — these are high-confidence inputs to planning]

### Core Trade-offs
[The real axes of disagreement, stated as trade-offs rather than as one side being right]
- Trade-off 1: [X] vs [Y] — choosing X gives you [...] but costs you [...]
- Trade-off 2: ...

### Conditional Recommendations
[Recommendations framed as "if-then" rather than absolutes]
- If [condition], then [approach] because [reasoning]
- If [condition], then [approach] because [reasoning]

### Risks & Blind Spots
[Things the panel identified as under-discussed or easy to overlook]

### Open Questions
[Questions that couldn't be resolved in the debate and need more information or experimentation to answer]

### Suggested Next Steps
[Concrete actions: things to research, prototype, test, or decide before planning]
```

### Phase 5: Hand Off to Planning

After presenting the summary, ask the user:
- "Does this capture the key considerations? Anything missing?"
- "Which trade-offs feel most important to your specific situation?"
- "Ready to move into planning with these insights, or should we dig deeper on any point?"

The think tank output should be treated as input to the plan — not as the plan itself. The human makes the decision; the think tank provides the analysis.

## Tips for Better Think Tanks

- **Prime the context first.** If relevant documents, code, or architecture diagrams exist, share them before running the think tank. The personas will give much better input with concrete context.
- **Don't over-specify the panel.** Let the LLM suggest some panelists — it often finds relevant experts you wouldn't have thought of.
- **Run multiple rounds if needed.** After the first debate, the user might say "I want to dig deeper on the database question." You can reconvene the panel (or a subset) for a focused follow-up.
- **Use the wildcard aggressively.** The outside thinker is often where the best insights come from. Don't let them be polite — have them challenge assumptions.
- **The summary is the deliverable.** The debate itself is entertaining, but the structured summary is what actually improves planning. Make it sharp and actionable.

## Example Test Prompts

- "I need to decide between building a custom auth system or using a third-party service like Auth0. Help me think through this."
- "We're debating whether to use a relational database or go with a document store for our new product. Can you run a think tank on this?"
- "Before we plan the migration to Kubernetes, I want to make sure we're not missing anything. Can we get some perspectives on this?"
- "Should our startup build a mobile app or focus on a responsive web app first?"
