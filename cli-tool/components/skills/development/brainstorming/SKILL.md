---
name: brainstorming
description: "You MUST use this before any creative or build work: creating features, building components, adding functionality, modifying behavior, or planning anything new, in software or out of it (a website, a talk, a business). Finds out what the user actually wants and why, one question at a time, compares 2-3 approaches and gets a design doc approved before anything is built. Use it even if they never say brainstorm or design; skip it only for fully specified one-line tasks."
license: MIT
metadata:
  author: Jesse Vincent (obra/superpowers), adapted by claude-code-templates
  source: https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/brainstorming
  version: "2.0.0"
---

# Brainstorming

You are good at building, and you build what you believe the user wants.
That belief is usually thinner than it feels. This skill is for finding out
what they actually want, and why, before anything gets built. When you
understand the why, you make the hundred unstated decisions the way they
would have made them.

## First: what do you actually know?

Before replying, ask yourself what you know about what they want, and why.

- **Everything that matters is in the request** ("make the icon cornflower
  blue"): it's a clear task. Do it, say what you did, and stop using this skill.
- **Something non-trivial is missing:** start the conversation below.

Before implementing anything, in order:

1. Lay out the approaches in a message of their own and have the user pick one.
2. Write the design doc, short or full (see *Size the work*).
3. Get the user's approval of that doc.
4. For a project, hand off to planning (the `writing-plans` skill if
   installed, otherwise a numbered implementation plan; `using-git-worktrees`
   can isolate the work). For a small change, the approved short design is
   the plan: build it.

Along the way you play the design back in chunks and size the work, which
decides whether the doc is short or full.

## Look before you ask

In an existing project, or when they gave you context (a spec, a handoff,
files, earlier conversation), read it first, plus the code or material it
touches, until you can explain how the relevant parts work today and what
the change would touch. Never ask what the project already answers.

## Your first message

- **They already said what they want** (a spec, a detailed request): about
  200 words. Echo the request in your own words (what, for whom, why), add
  what you found that bears on it, and flag anything that would change the
  ask (a constraint, a conflict, a cheaper path). End with one line inviting
  corrections, then one question: the open point whose answer most changes
  what gets built.
- **They haven't:** one open question, in their terms, about the biggest
  unsettled thing, and why you're asking. For "a website for my bakery":
  "If it's mostly for people deciding whether to stop by, I'd lead with hours
  and today's case; taking orders is a different site. What do you want
  someone to do when they land on it?"

If they **didn't** ask for brainstorming, add one light line after your
question: "Or if you'd rather I just dive in, say so." If they take it, this
skill is done: state any significant how-it-gets-made choice (platform,
language, medium) in one line, then do the work normally.

## The conversation

- **One question per message**, one sentence, no list of example answers
  hanging off it. Plain language, their vocabulary, no process jargon. Never
  quote this skill to them.
- **Get them describing.** Open questions first; their words carry intent
  your options can't. Offer a short multiple-choice menu only when they're
  stuck. When they say "just guess", propose something concrete.
- **Make each question specific.** Build on their last answer or on something
  you found, so it surfaces a consequence or case they may have missed. A
  proposal they can correct, with your reason, often beats a question.
- **How it gets made.** Find out early which choices (platform, language,
  libraries, medium) they want to make, which they hand to you, and what
  already exists. Build on what existing work uses. Any choice you make goes
  in the design as *your call*, never as something they agreed to.
- **Ground to cover** (territory, not a script; never read it out): what the
  thing is and what makes it special; why now and what success looks like;
  goals, non-goals and anti-goals (what would make it a failure even if it
  technically works); prior art they loved or hated; current state and what
  they tried; the details they care about.
- **Offer recon** once looking further would help: deeper into the codebase,
  their files or the web. Say what you'd look for; they decide.
- **Spike to feel things out.** A quick throwaway build is often the cheapest
  way to learn. Offer one when useful. Spikes skip tests, plan and review,
  stay labeled throwaway, and what they teach comes back into the conversation.
- **Show, don't tell.** For screens, layouts, flows or options that would look
  different, offer (in a message of its own) to sketch a mockup: ASCII, a
  Mermaid diagram, or an HTML file they can open. Offer it once, when it
  first helps; if they decline, stay in text.

## Lay out the approaches

Once you understand *what* they want, and before writing anything up, send
the ways of building it in a message of its own. Generate several, drop the
weak ones (including any that work against their why or that the existing
work rules out), and present the 2-3 that remain, each grounded in what the
project actually does and what it trades off. Lead with your recommendation
and why, then ask which way they want to go. If there is genuinely one
sensible way, say so and why the others don't fit.

## Play it back

As soon as you understand one part (who it serves, how one piece behaves),
describe it back in about 200-300 words, then return to questions about the
next part. Only what they said goes in as theirs; anything you filled in is
marked as your proposal, with your reason. End each chunk by asking what's
wrong or missing.

## Size the work

After they pick an approach, say how big the work is. They can override it.

| Size | Design doc |
|------|-----------|
| Small change | Short: a line or two per point, posted in chat (no file unless they want one) |
| Project | Full written design (below) plus the builder check |

Both include an **Approaches** section: the options considered, trade-offs,
which one they picked and why. If the work grows mid-task, say so and step up
a size. If it is really several independent projects, agree on an order and
brainstorm them one at a time.

## The written design

A plain document a capable builder in the domain could plan from on their own,
with no follow-up questions. Cover: intent and the why; goals, non-goals,
anti-goals; constraints; approaches; the decisions they made, as they made
them; your calls (marked); what's left to the builder. Apply YAGNI: cut
anything nobody asked for.

**Where it goes:** in a software repo, `docs/plans/YYYY-MM-DD-<topic>-design.md`
(next to the plans `writing-plans` writes), unless the project already has a
convention for design docs: use theirs. Commit it only if they want it
committed. Outside a repo, ask. The user's preference overrides all of this.

**Builder check (projects only):** before handing the doc over, have a fresh
reader review it using [references/builder-check.md](references/builder-check.md).
Tell the user a reviewer reads it first and you may come back once with a few
questions.

<HARD-GATE>
Nothing gets built until the user approves the design doc (short or full).
Building includes product code, scaffolding, installing dependencies,
creating projects, and invoking an implementation skill. Reading,
exploring, and mockups or spikes they agreed to are fine.

Exceptions: if they opted out of the questions, the skill and the gate are
done. A spike they agreed to may be built; keeping what it produced is a new
request that comes back through this gate.

After approval of a full design the next step is the plan, not code.
</HARD-GATE>

## Red flags

| Thought | Reality |
|---------|---------|
| "I'll offer a menu of what they might want" | Options steer. Ask them to describe it first. |
| "I'll fill in sensible defaults" | Fine, but say them out loud. A default they never heard is one they couldn't reject. |
| "I've got my answers, I'll write the doc" | Lay out the approaches first, in a message of their own. |
| "I'll ask three things at once to save time" | One question. Stacked questions get half-answered. |
| "I should explain the process first" | Ask your question. The process shows itself. |
| "They said 'sounds good' to the idea" | Approval covers what you showed. An unwritten doc isn't approved. |
| "The spike works, I'll keep building on it" | Keeping it is a new request. Back through the gate. |
