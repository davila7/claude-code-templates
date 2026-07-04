---
name: bleu
description: "Use this skill whenever a developer wants to turn an idea into a complete, production-ready, end-to-end system plan BEFORE writing any code. Trigger on 'plan this system', 'design the architecture for', 'help me blueprint', 'deep plan for X', 'break this idea into components', 'expand into action points', 'full implementation plan', or when the user pastes a project idea wanting architecture, components, pipelines, and file-level execution mapped out. Casual phrasing also triggers: 'help me think this through end-to-end', 'plan before coding'. Also covers living-workspace patterns: self-improving knowledge bases, reflection loops with auditor agents, four-agent teams, schema-as-code, wiki health scoring. **Resume triggers**: 'where did we leave off', 'continue this plan', 'resume my blueprint' - rehydrates state from disk via SESSION.md/NEXT.md/decisions/. Web research is mandatory every invocation."
license: MIT
metadata:
  author: Nirvaan Lagishetty
  version: "1.0.0"
  source: https://github.com/Nirvaan05/Bleu-plugin
---

# Bleu

Turn an idea into a fully thought-through, deeply structured system plan - from architecture down to file-level execution - before any code is written. The output is a navigable knowledge base, not a single document: raw inputs compiled by an LLM into an interlinked markdown wiki, with lint passes to heal gaps. No RAG, no vector store, no embeddings - the whole plan fits in a modern context window and every claim is traceable to a file a human can open, edit, or delete.

The goal: by the end, the user can visualize the entire execution flow, catch expected-vs-actual mismatches early, and start implementation with zero ambiguity.

## Why this skill exists

Most "planning" with an LLM is one-shot: ask for an architecture, get a wall of text, lose it next session. This skill replaces that with a **persistent, LLM-maintained planning wiki** that grows, lints itself, and survives context resets. It's deliberately heavy on structure because the failure mode of light planning is discovering the architectural hole in week three.

The strongest single argument for the skill, worth memorizing:

> The tedious part of maintaining a knowledge base is not the reading or the thinking - it's the bookkeeping. Updating cross-references, keeping summaries current, noting when new data contradicts old claims, maintaining consistency across dozens of pages. Humans abandon wikis because the maintenance burden grows faster than the value. LLMs don't get bored, don't forget to update a cross-reference, and can touch 15 files in one pass.

That's the bet. Every other design choice in this skill serves it. Frontliner teams that have adopted spec-driven workflows (PubNub, Effloow, EPAM) report that the **safe delegation window expands from 10–20 minute tasks to multi-hour feature delivery** once a real plan exists in files the agent can re-read. That's the value proposition: planning before code is what makes long-running autonomous work safe enough to actually leave running.

It also assumes the user wants ~38 action points (or thereabouts) - meaning the plan must be decomposed deeply enough that each AP is an executable unit with named files, named functions, and explicit dependencies. Anything vaguer than that and the skill isn't done yet. The number is a granularity guideline, not a quota - small projects should have fewer APs. The Phase 0 intake sizes the workflow to the project. Don't sledgehammer a nut.

For the deeper context behind every design choice, including citations to the frontliner research that informed this skill, see `references/landscape-research.md`.

## Operating principles

Hold these the entire time. They override any instinct to move faster.

- **Plan, don't code.** No implementation until the blueprint is signed off. If the user drifts toward "just start coding," remind them once, then comply if they insist.
- **Be proactively suggestive, not reactive.** Think like a system architect, a senior engineer, and a product thinker simultaneously. Challenge the user's assumptions where they're weak. If you spot a better approach, surface it with a comparison and a recommendation - don't wait to be asked.
- **Continuous web research is mandatory.** Not a one-time pass. Every phase researches what's relevant to that phase. Every claim that came from research gets a citation. See `references/research-and-citations.md`.
- **Files outlast context.** Everything goes into the planning workspace as markdown. The conversation is ephemeral; the workspace is the deliverable.
- **Treat the chat as stateless and the workspace as stateful.** Chats die - context windows fill, the user runs `/clear`, terminals crash. Anthropic's own Agent SDK docs are explicit on this: don't rely on session resume, capture results to disk and rehydrate from disk in fresh sessions. Every session ends with the persistence ritual (Phase R): journal entry, ADRs for any new architectural decisions, rewritten `SESSION.md` and `NEXT.md`. Every session starts by reading those same files first. See `references/session-persistence.md`.
- **Lint relentlessly.** Iterate until gaps, edge cases, and architectural flaws are surfaced and either resolved or explicitly logged as open questions. "Done" means the user agrees it's near-perfect, not that you ran out of ideas.
- **Adversarial evaluation, not self-evaluation.** Anthropic's harness research surfaced the canonical pitfall: "agents tend to respond by confidently praising the work - even when, to a human observer, the quality is obviously mediocre." Whenever this skill spawns a separate validator (Auditor, Linter, evaluator hook), it must be a different agent from the one that produced the work. Same agent both proposing and approving = self-praise. Production teams from Anthropic to PubNub enforce this strictly.
- **Write for the gap, not the overview.** ETH Zurich's AGENTbench paper (Feb 2026) found that LLM-generated CLAUDE.md files actively *reduce* coding agent success rates by ~3% and inflate cost by 20+%, because they restate things the agent could already infer from `package.json` and the README. The same principle applies inside the blueprint: when the Curator writes a plan file, every line should encode something the reader couldn't infer from the raw inputs. Every restated fact is taking attention away from a missing one.
- **Audit your harness as models improve.** From Anthropic's harness post: "Are you running complex context management because the model actually needs it, or because you designed the system six months ago when the model did need it?" When the user upgrades models, revisit which scaffolding is still load-bearing and which is dead weight. Sonnet 4.5 needed context resets; Opus 4.6 dropped them. Don't carry yesterday's workarounds into tomorrow's runs.
- **Contamination control.** Keep human-curated artifacts (`README.md`, ADRs, the actual codebase) separate from `blueprint/`. The blueprint is the LLM's domain - high volume, agent-edited, safe to rewrite. Mixing the two leads to either silent overwrites of human work or the agent treating its own output as ground truth.
- **Start simpler than you think you need to.** Across every frontline source, the loudest message is the same. Anthropic's "Building Effective Agents" post: "Most tasks need Pattern 1 (single specialist). Add complexity only when it demonstrably improves results." The Claude Code best-practices catalogue: *"Despite multi-agent systems being all the rage, Claude Code has just one main thread. I highly doubt your app needs a multi-agent system."* The base file-only workflow in this skill is the path for most blueprints. `references/claude-code-integration.md` and `references/advanced-architecture.md` exist for the cases where they actually pay off - substantial blueprints that will be revisited frequently - not as defaults.
- **Match granularity to scope.** From Augment's research, **multi-file tasks accuracy is ~19% versus single-function tasks at ~87%**. Smaller scope dramatically improves agent success rate. Anthropic's harness research adds: doubling task duration **quadruples** the failure rate, and every agent degrades after ~35 minutes of human time. The ~38 action point target assumes a substantial system; the Phase 0 intake explicitly chooses coarse decomposition (3–5 APs) for small jobs and fine decomposition (~38 APs) for greenfield systems. Don't sledgehammer a nut, and don't tweezer a tree.
- **Ground truth beats LLM opinion.** From the Anthropic agent-patterns catalog: *"Use test results, compiler output, linters - not just LLM self-evaluation - to validate work."* Whenever the Linter or Auditor runs, it should consult `.claude/rules/blueprint-schema.md` and the actual filesystem state, not vibe-check the proposals. Same applies to research: cite the source, don't paraphrase from memory.
- **The Curator owns the wiki, not you.** The core rule: *you rarely ever write or edit the wiki manually - it's the domain of the LLM.* If you ever find yourself writing `blueprint/plan/` files directly instead of using the Curator (or being the Curator yourself), something's gone wrong with the workflow. The user should be sourcing inputs and asking questions; the agent should be doing the bookkeeping.

## The workspace

This skill organizes the plan as a markdown knowledge base on disk - an evolving markdown library compiled and maintained by the LLM, with no vector DB, no chunking, no embeddings. Read `references/knowledge-base-pattern.md` before creating the workspace - it explains the layout and why it's shaped this way.

Default layout:

```
blueprint/
├── README.md                  ← entry point + how to navigate
├── SESSION.md                 ← current snapshot - read this FIRST on resume
├── NEXT.md                    ← imperative next actions - read SECOND on resume
├── journal.md                 ← append-only session history
├── index.md                   ← compact summary of every file (the "wiki index")
├── decisions/                 ← MADR-style ADR log, append-only
│   ├── README.md              ← ADR index with status table
│   ├── ADR-001-<slug>.md
│   ├── ADR-002-<slug>.md
│   └── ...
├── raw/                       ← raw inputs: user transcript, research dumps, code excerpts, links
├── plan/
│   ├── 00-vision.md           ← problem, goals, non-goals, success criteria
│   ├── 01-architecture.md     ← system diagram, layers, data flow, key decisions
│   ├── 02-pipelines.md        ← every pipeline/flow end-to-end
│   ├── 03-components/         ← one file per component
│   │   ├── component-name.md  ← logic, responsibilities, dependencies, interfaces
│   │   └── ...
│   ├── 04-data-model.md       ← entities, schemas, storage, migrations
│   ├── 05-integrations.md     ← external services, APIs, auth, rate limits
│   ├── 06-non-functional.md   ← perf, security, observability, cost, scaling
│   └── 07-risks-open-questions.md
├── action-points/             ← ~38 APs, one file each (AP-01.md … AP-38.md)
├── research/                  ← web research notes with citations, one file per topic
└── outputs/                   ← query responses and synthesized reports the user asked for
```

You don't have to materialize every folder upfront - create files as you go. But the structure should converge on this shape.

**Session persistence is non-negotiable.** `SESSION.md`, `NEXT.md`, `journal.md`, and `decisions/` exist so the workspace survives `/clear`, terminal crashes, and context-window resets. Treat the chat as stateless and the workspace as the source of truth - Anthropic's own Agent SDK docs recommend this over relying on built-in session resume. Every session ends with the persistence ritual (see Phase R below). Read `references/session-persistence.md` for the full pattern, ADR template, and resume protocol.

`outputs/` is the third top-level directory in the canonical `raw/` → `wiki/` → `outputs/` layout. The Curator never writes here. The user does - every time they ask "explain this component to me" or "give me a one-page summary for the team", that response gets saved as a markdown file in `outputs/` so every query has a persistent, auditable record. This is how queries become artifacts instead of evaporating with the conversation.

## The phased workflow

The phases are sequential by default, but loop back freely. Lint is not a final step; it runs after every phase.

### Phase 0 - Intake and framing

The user gives you the idea. Before doing anything else:

1. **Restate the idea in your own words** in 3–5 sentences. Force the user to confirm or correct. Most plans fail here, not later.
2. **Surface the unknowns.** What don't you know yet that you'd need to plan well? Users, scale, stack constraints, deadlines, team size, deployment target, budget, regulatory context. List them.
3. **Ask 2–4 sharp questions** to fill the biggest gaps. Use yes/no or pick-one format where possible. Don't drown the user.
4. **Confirm scope.** Is this a greenfield system? A redesign? A feature inside an existing codebase? The blueprint shape changes based on this.

Output of Phase 0: `blueprint/raw/intake.md` with the restated idea, the user's clarifications, and the agreed scope.

### Phase 1 - Initial research pass (web + code, if a codebase exists)

Now ground yourself. This is the first of many research passes.

**Web research** (mandatory): For the domain, the stack, and the architectural pattern, find current best practices, known gotchas, recent shifts, and reference implementations. Prioritize primary sources (official docs, RFCs, repos, well-known engineering blogs) over content farms. Save findings to `blueprint/research/<topic>.md` with citations. See `references/research-and-citations.md` for the citation format.

**Code research** (only if a codebase already exists): Read the relevant files. Capture real names, paths, patterns, and dependencies into `blueprint/raw/codebase-notes.md`. The grounding rule from prompt-forge applies: every file path or symbol that ends up in the blueprint must come from actually reading the code, not guessing.

Before moving on, write a 1-paragraph synthesis at the top of each research file: what did you learn, and how does it change the plan you're about to draft?

### Phase 2 - Vision, architecture, pipelines

**Research before drafting, not after.** Every architectural decision in this phase makes a claim about how something works in the current ecosystem (which queue, which file watcher, which storage, which library, which pattern). Each claim needs grounding. Before you write `01-architecture.md`:

1. List the architectural choices you're about to make (queue mechanism, concurrency model, storage, file-watching, deployment, etc.).
2. For each one you can't already cite from a `research/*.md` file, run a targeted web search and write the findings into `research/<choice>.md` with the citation format from `references/research-and-citations.md`.
3. Then draft the architecture file, with each decision linking back to its `research/` file.

If you find yourself writing "I'll use X because [reasoning from training knowledge]," stop and search. Training knowledge is stale on tooling. The whole point of the skill's continuous-research principle is that *no architectural claim survives Phase 6 lint without a citation* - so you may as well do the research now, when it can shape the decision, instead of later, when it can only invalidate it.

Draft these in order. Each file should be tight and opinionated, not a list of options.

- `00-vision.md` - Problem statement, target users, goals, **explicit non-goals**, success criteria (measurable where possible).
- `01-architecture.md` - High-level system. Include an ASCII or mermaid diagram. Name every layer and every major component. State the key architectural decisions and the alternatives you rejected (with reasoning). **Each decision links to its `research/` file.**
- `02-pipelines.md` - For every flow in the system (e.g., "user signs up", "ingest job runs", "report generates"), write the end-to-end sequence: trigger → components touched → data transformations → outputs → failure modes. Don't skip the boring ones.

After drafting, **lint** (see "Linting" section below) and update `index.md`.

### Phase 3 - Component breakdown

For every component identified in `01-architecture.md`, create `plan/03-components/<name>.md` containing:

- **Purpose** - one sentence
- **Responsibilities** - bulleted, exhaustive, scoped narrowly enough that two components don't overlap
- **Logic** - how it actually works inside; the algorithm or state machine in prose
- **Inputs / Outputs** - exact shapes (types, schemas)
- **Dependencies** - what it calls, what calls it; link to other component files
- **Failure modes** - what can go wrong, how it's handled
- **Open questions** - anything unresolved

If two components have unclear ownership of a responsibility, that's a lint failure. Resolve it before moving on.

### Phase 4 - Data model, integrations, non-functional

- `04-data-model.md` - Entities, fields, relationships, indexes, storage choice + justification, migration story.
- `05-integrations.md` - Every external dependency: API, auth method, rate limits, failure handling, cost. Web-research the current state of each (APIs change).
- `06-non-functional.md` - Performance targets, security model, observability (logs/metrics/traces), cost envelope, scaling story.

### Phase 5 - Action point expansion (~38 APs)

This is where the blueprint becomes executable. Decompose the entire plan into roughly 38 action points (more or fewer is fine - the number is a target for the right granularity, not a quota). Use the template in `references/action-point-template.md`.

Each AP file (`action-points/AP-NN-<slug>.md`) must contain:

- **Title** and one-sentence summary
- **Depends on** - other AP IDs that must complete first
- **Files involved** - exact paths (create/modify/delete)
- **Code flow** - what happens, function by function, in prose
- **Interfaces touched** - function signatures, API contracts, schema changes
- **How it interacts with other components** - explicit named references
- **Verification** - how the user will know this AP is done correctly
- **Estimated complexity** - S/M/L/XL with reasoning
- **Open questions / risks**

After the APs are drafted, build a **dependency graph** at the bottom of `action-points/README.md` (mermaid is fine) showing the execution order and parallelizable groups.

### Phase 6 - Lint, challenge, iterate

This is the most important phase. Run a **lint pass** over the entire blueprint. The lint pass is you, reading everything you wrote, looking for:

- **Gaps** - components referenced but not defined, APs that depend on undefined work, files mentioned but not placed.
- **Contradictions** - two files describing the same thing differently.
- **Edge cases** - what happens at scale 0, scale 1, scale max? On network failure? On partial writes? On concurrent access? On bad input?
- **Architectural flaws** - circular dependencies, single points of failure, hidden coupling, premature abstraction, missing abstraction, leaky boundaries.
- **Assumption challenges** - for each major decision, ask "what if this is wrong?" Then web-search whether anyone else hit that wall.
- **Better approaches** - if research surfaces something better, write a comparison memo in `research/<topic>-alternatives.md` with a recommendation.

Write findings into `plan/07-risks-open-questions.md` with severity and proposed resolution. Then resolve the high-severity ones by editing the affected files. Repeat the lint pass until the user agrees the blueprint is near-perfect.

### Phase 7 - Sign-off and handoff

When the user explicitly locks in the blueprint ("looks good", "approved", "lock it in", "ship it"), do the following in order:

1. **Finalize the wiki.** Update `index.md` so every file has a one-line summary. Update `README.md` with the recommended reading order (vision → architecture → pipelines → components → APs). Make sure `plan/07-risks-open-questions.md` has no unresolved high-severity items, or that the user has explicitly accepted them.

2. **Ask which handoff target.** Don't assume - ask:

   > "Blueprint is locked. How do you want to execute it? (1) GSD, (2) Superpowers, (3) raw Claude Code, (4) just the AP list."

3. **Generate the chosen handoff artifact.** Read `references/handoff-formats.md` for the exact format for each target. Write the artifact to `blueprint/handoff/<target>.md` so it's preserved alongside the blueprint.

4. **Auto-invoke if possible.** If you're in an environment where the target's slash command is available (Claude Code with the GSD or Superpowers plugin installed), offer to invoke it directly with the artifact as input. For example:

   > "Want me to run `/gsd:new-milestone` with this now? I'll paste the handoff doc as the initial description."

   If the user confirms, invoke the command with the contents of `blueprint/handoff/<target>.md` as the input. If you're not in Claude Code or the plugin isn't present, output the artifact and tell the user the exact command to run themselves.

5. **Confirm the handoff is grounded.** Whatever target is picked, the handoff artifact must reference the blueprint files (relative paths like `@blueprint/plan/01-architecture.md`) so the executor can open them - not paraphrase the whole blueprint into one giant prompt. The blueprint *is* the source of truth; the handoff is a doorway into it.

### Phase R - Resume (runs at the start of any session, and at the end of every session)

This phase is not sequential; it runs whenever a session starts on an existing `blueprint/` workspace, and again whenever a session ends. It exists because chats die - context windows fill, the user runs `/clear`, terminals crash, the model gets restarted between turns. Treat the chat as stateless and the workspace as the source of truth. Read `references/session-persistence.md` for the full pattern, ADR template, and the canonical list of failure modes.

**On session start (resume protocol)**, when an existing `blueprint/` directory is present, or when the user says "where did we leave off", "continue this plan", "resume my blueprint", or similar:

1. Read `blueprint/SESSION.md` first (current snapshot, ~50 lines)
2. Read `blueprint/NEXT.md` (imperative next actions, ~30 lines)
3. Read `blueprint/index.md` (file map with coverage tags)
4. Read `blueprint/decisions/README.md` (ADR index - status of every architectural decision)
5. Read the last 1-2 entries of `blueprint/journal.md` (`tail -n 80`)
6. **Then and only then** read specific `plan/` or `research/` files that `NEXT.md` references for the next action

After reading those 5 small files, restate to the user in one sentence: *"You're in Phase N of the X project. Last session ended after [Y]. Next is [Z]. Want me to start, or has anything changed?"* This is the proposer-validator separation applied to resumption - the user confirms you read the state correctly before any new artifacts are written.

Do **not** load Phase 1 research files unless the next action involves research. Do **not** load `plan/00-vision.md` if you're doing Phase 5 and the vision is unchanged. Progressive disclosure all the way down.

**On session end (persistence ritual)**, before the user runs `/clear` or the chat dies of natural causes, do this in order:

1. **Append a journal entry** to `blueprint/journal.md` - one entry per session. Goal, outcome, what was done, decisions made (by ADR number), what was deferred, blockers raised. Format in `references/session-persistence.md`. Append-only - never edit old entries.
2. **Write any new ADRs** for every architectural decision made this session. Sequential numbering (`ADR-001-`, `ADR-002-`, ...). MADR format. Update `decisions/README.md` index with the new entries and current statuses.
3. **Rewrite `SESSION.md`** - current phase, what was just done, what's blocked, where to read first on resume. Always current; never appended to.
4. **Rewrite `NEXT.md`** - imperative bullets for the next session. Include an "Already done" section so a resuming Claude does not redo completed work (a documented LLM failure mode).
5. **Update `index.md` coverage tags** if any file's coverage status changed.
6. **Tell the user**: *"Workspace persisted. Safe to /clear. Resume by saying 'where did we leave off'."*

The persistence ritual is cheap (5 small file writes) and the alternative is catastrophic (a `/clear` that loses an hour of architectural work). Do not skip it.

**End every working phase with a mini-persistence ritual too**, not just at session end: append a short journal entry, update SESSION.md and NEXT.md to reflect the new state. This means a crash mid-session loses at most one phase of work, never the whole session.

## Linting protocol (run after every phase, not just Phase 6)

Mini-lint after each phase:

1. Did I introduce names that don't resolve to defined components/files? Fix or define.
2. Did anything I wrote contradict an earlier file? Reconcile.
3. Did I add a dependency without checking it exists / is current? Web-search and cite.
4. **Citation density check**: count the architectural/technical claims in any file I just wrote (queue choices, library choices, pattern choices, version claims, performance claims). For each one, can I point to either (a) a `research/*.md` file or (b) an inline citation? If the answer is "no, I just knew that" - stop. Run the search. Add the research file. Update the claim with the citation. **Training knowledge is stale on tooling and the skill's continuous-research principle means no decision survives without grounding.** This is the most-skipped lint check and the one most likely to embarrass you in Phase 6.
5. Is `index.md` still accurate? Update it.
6. **Persistence freshness check**: is `SESSION.md` newer than the most recent file modification in `blueprint/`? Is `NEXT.md` still pointing at work that hasn't been done yet? Did this phase make an architectural decision that still needs an ADR? If any answer is no, fix it before moving on. The persistence ritual is part of every phase, not just session end.

This is cheap and catches drift early. Don't skip it.

## Claude Code integration (when available)

If you detect that you're running inside **Claude Code** (a `.claude/` directory exists, a `CLAUDE.md` is present, or the user mentions it), the blueprint workspace can become a living, automated system instead of a static folder. Read `references/claude-code-integration.md` and offer the user - explicitly, as a menu - these four integrations:

1. **Hooks** - `SessionStart` (matched on `startup|resume`) loads `index.md` and the wiki health score into context; **`FileChanged`** (not `PostToolUse`) fires when files in `blueprint/raw/` change on disk regardless of who wrote them (Claude, MCP server, external script), queueing them for the Curator; `PreCompact` backs up the transcript before compaction; `Stop` and `SubagentStop` run the git auto-commit (with `async: true` and `stop_hook_active` loop protection). Prompt-based and agent-based hooks (`type: "prompt"` / `type: "agent"`) replace several patterns I previously implemented as shell scripts.
2. **KB Curator subagent** - at `.claude/agents/kb-curator.md` with hooks **in its frontmatter** (scoped to its lifecycle, no global settings changes), `tools` whitelisted to `Read, Write, Edit, Glob, Grep`, `memory: project` for built-in persistent learnings (`MEMORY.md` auto-loaded into the agent's prompt), `skills: [bleu]` to preload the workspace conventions, optional `mcpServers` inline to scope filesystem/git/docs MCPs without polluting parent context, and optional `isolation: worktree` for safe destructive lint passes. Three modes: compile, lint, index. Use `if: "Write(blueprint/**)"` permission-rule syntax for declarative path filtering instead of script logic.
3. **Git auto-commits** - `Stop` and `SubagentStop` hooks run `.claude/hooks/git-autocommit.sh` with `async: true`. Stages only `blueprint/`, checks `stop_hook_active` to prevent loops, uses a distinct author. Every phase becomes recoverable via `git log -- blueprint/`.
4. **Optional MCP servers** - scoped inline to the Curator (filesystem to `blueprint/`, git, a docs-fetch server like context7), plus any domain-relevant MCPs. Opt-in only, never silent. Inline scoping keeps tool descriptions out of the main conversation's context.

Always show the user the files you would create (settings, agent definition, hook scripts, `.mcp.json`) **before** writing them. After they approve, write the files and tell them to restart their Claude Code session so the new settings load. If you're not in Claude Code, skip this section entirely - the skill works fine without any of it.

## Advanced architecture (opt-in, layered on top)

Beyond the base wiki and the Claude Code integration, the workspace can become a **living, self-improving system**. These capabilities are documented in detail in `references/advanced-architecture.md`. Offer them as a menu when the user asks for them, or when the blueprint is getting big enough to need them. Each is independently useful - pick any subset:

1. **Reflection loop** - A Linter agent reads the wiki, nominates new rules and connections, and an Auditor agent validates proposals before they enter the schema. The wiki self-improves; the human steers the rules, not the content. (The "schema you steer" pattern made operational; same family as Self-RAG.)
2. **Structure layers** - A derived knowledge graph (`blueprint/.graph/graph.json`) overlaid on the markdown for queryable backlinks and Obsidian-style views, plus a clean split between **episodic memory** (raw transcripts and decisions in `raw/`) and **semantic memory** (synthesized articles in `plan/` and `research/`) with bidirectional links.
3. **Agent team** - Four locked-tool subagents that hand off through files **with hook-driven transitions**: **Researcher** (web → `raw/research/`), **Curator** (`raw/` → `plan/`, rebuilds index and graph, has `memory: project` for institutional knowledge), **Linter** (writes only to `.reflection/proposals/`, never to canonical `blueprint/` files), **Auditor** (implemented as an `agent` hook on `SubagentStop` matched to the linter - fires automatically, no separate file). Proposer-validator separation is enforced: same agent never both proposes and approves a change.
4. **Schema-as-code** - Explicit rules in `.claude/rules/blueprint-schema.md` (loaded automatically by Claude Code via `InstructionsLoaded` whenever any file under `blueprint/` is accessed, thanks to `paths: ["blueprint/**"]` frontmatter). Rules like "every AP must have Verification", "every research file must cite a primary source". ERROR-level violations block Phase 7 sign-off. Rules co-evolve via the reflection loop. Optional ontology in `.claude/rules/blueprint-ontology.md` types the graph edges.
5. **Multimodal ingest and derived outputs** - PDFs, images, and screenshots dropped into `raw/` get described (vision) and compiled like text inputs. Generated diagrams, dependency graphs, and health charts live in `blueprint/derived/` (regenerable, gitignored).
6. **Observability** - A telemetry log at `blueprint/.telemetry/events.jsonl` plus a **wiki health score** (0–100) in `blueprint/.telemetry/health.md` computed from coverage, linkage, citation density, lint debt, and reflection freshness. Surfaced on every `SessionStart`.
7. **External integrations** - MCP servers that ingest GitHub PRs/issues, Linear/Jira tickets, meeting transcripts, and web search results into `raw/` automatically. The Curator picks them up via the same `FileChanged` hook used elsewhere.

Recommended adoption order for substantial blueprints: base workflow → reflection loop + schema-as-code → observability → agent team → graph + episodic/semantic split → multimodal → external integrations. Don't push the user to take all seven on day one.

## Communication style

- The user wants a senior collaborator, not a stenographer. Push back. Suggest alternatives. Flag weak parts.
- Cite sources whenever you use research. No uncited claims about external libraries, APIs, or current best practices.
- When you're uncertain, say so explicitly and put the question in `07-risks-open-questions.md` rather than papering over it.
- Use the user's terminology once you've learned it. If they call it "the ingest worker," don't rename it to "the ingestion service" later.
- Keep prose tight. The blueprint is read by tired humans and other LLMs - both reward clarity over flourish.

## Reference files

Read these as you need them:

- **`references/knowledge-base-pattern.md`** - The markdown-wiki-over-RAG pattern this skill builds on, why it works at planning scale, and how to set up the workspace. Read this before creating files in Phase 0/1.
- **`references/session-persistence.md`** - The resume protocol, session lifecycle, MADR-style ADR template, journal format, and the five files (`SESSION.md`, `NEXT.md`, `journal.md`, `decisions/`, `decisions/README.md`) that make the workspace survive a `/clear`. Read this before the first session of any new blueprint, and re-read whenever you're resuming a workspace someone else (or past-you) created.
- **`references/action-point-template.md`** - The exact template for each AP file. Read this before Phase 5.
- **`references/research-and-citations.md`** - How to do continuous web research, what counts as a primary source, and the citation format used throughout the workspace. Read this before Phase 1 and refer back whenever you research.
- **`references/handoff-formats.md`** - How to package the locked-in blueprint for GSD, Superpowers, or raw Claude Code, and how to auto-invoke the target's slash command when possible. Read this in Phase 7.
- **`references/claude-code-integration.md`** - Hooks, the KB Curator subagent, optional MCP servers, and Git auto-commits - for when the skill is running inside Claude Code and the user wants the workspace to be automated rather than static. Read this once you've confirmed you're in Claude Code and the user wants the automation.
- **`references/advanced-architecture.md`** - The seven advanced capabilities: reflection loop with auditor, knowledge graph + episodic/semantic memory, the four-agent team, schema-as-code, multimodal ingest, observability with wiki health score, and external integrations (GitHub/Linear/meetings/web). Read this when the user asks for any of these or when the blueprint is substantial enough to benefit from them.
- **`references/landscape-research.md`** - Deep web research capturing how frontliner teams (PubNub, Effloow, EPAM, Anthropic Labs, ETH Zurich, the broader markdown-wiki adopter community) actually implement the patterns this skill borrows. Read this when you need the citations behind a design choice, when the user asks "why is the skill shaped this way", or when you're justifying a recommendation against an alternative the user is proposing. Includes the ETH Zurich AGENTbench findings on CLAUDE.md, Anthropic's harness research, the markdown-wiki adopter wins (coverage tags, concept articles), spec-driven dev workflows (Constitution → Specify → Clarify → Plan → Tasks → Implement), CoALA memory taxonomy, Reflexion vs Reflection distinction, and the five-dimension observability framework.
