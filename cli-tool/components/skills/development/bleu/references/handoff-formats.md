# Handoff Formats

This file is read in Phase 7, after the user locks in the blueprint. Its job: convert the wiki into something an executor (GSD, Superpowers, or raw Claude Code) can run with, and - when possible - invoke that executor directly.

## The grounding rule (read first)

The blueprint is the source of truth. The handoff artifact is a **doorway**, not a copy. It should:

- Reference blueprint files by relative path (`@blueprint/plan/01-architecture.md`) so the executor opens them.
- Contain a tight summary of intent, scope, stack, and the AP execution order.
- **Not** paraphrase the entire blueprint into one giant prompt - that re-introduces the failure mode the wiki was built to avoid.

If the executor is Claude-based, it can read the linked files. Trust that and keep the handoff lean.

## Where the blueprint sits in spec-driven development

The bleu workflow (Phases 0-7) is one of several spec-driven development (SDD) approaches. It's worth knowing where it sits in the broader landscape because users may already be familiar with one of these workflows, and the handoff is more credible when you can name the mapping.

The canonical SDD workflow, as standardized by GitHub Spec Kit (donated to the Linux Foundation's Agentic AI Foundation in late 2025), is:

```
Constitution → Specify → Clarify → Plan → Tasks → Implement
```

Each phase requires explicit human approval before proceeding. The bleu maps onto this as follows:

| Spec Kit phase | bleu equivalent | Output file |
|---|---|---|
| **Constitution** | (encoded in `.claude/rules/blueprint-schema.md` if using Claude Code, otherwise mentioned in Phase 0 intake) | `.claude/rules/blueprint-schema.md` or similar |
| **Specify** | Phase 0 intake + Phase 2 vision/architecture | `blueprint/raw/intake.md`, `blueprint/plan/00-vision.md` |
| **Clarify** | Phase 0 questions + Phase 6 lint round-trip | `blueprint/plan/07-risks-open-questions.md` |
| **Plan** | Phase 2 architecture + Phase 3 components + Phase 4 data/integrations | `blueprint/plan/01-architecture.md` through `06-non-functional.md` |
| **Tasks** | Phase 5 action point expansion (~38 APs) | `blueprint/action-points/AP-NN-*.md` |
| **Implement** | Phase 7 handoff to GSD/Superpowers/Spec Kit/raw Claude Code | `blueprint/handoff/<target>.md` |

The mapping is tight enough that the bleu can directly produce the inputs Spec Kit's `/specify`, `/plan`, and `/tasks` commands expect. See **Target 5** below for the Spec Kit handoff format specifically.

**Other SDD frameworks the user may know**:

- **Kiro IDE** (AWS): three documents - `requirements.md` → `design.md` → `tasks.md` - plus a "steering" memory bank (`product.md`, `structure.md`, `tech.md`). Maps cleanly: requirements ≈ vision, design ≈ architecture+components, tasks ≈ action points, steering ≈ schema rules.
- **BMAD-METHOD**: six-agent personas (Analyst, Project Manager, Architect, Developer, QA, Orchestrator) with file-based handoffs. Substantially heavier; best for greenfield projects with significant upfront planning value. The blueprint can feed BMAD's Architect role directly.
- **Conductor plugin** (in `wshobson/agents`): Context → Spec & Plan → Implement workflow. Same shape as the bleu, repackaged as a Claude Code plugin.

### Living spec vs static spec

Augment Code's evaluation of six SDD tools surfaced an important distinction: **living-spec platforms** (Intent, Augment Code) keep documentation synchronized with code as agents work, while **static-spec tools** (Spec Kit, BMAD, Kiro) structure requirements upfront but require manual reconciliation when implementation diverges.

The blueprint **should be living**. When a Curator cycle changes a plan file, the index updates. When the Linter finds a contradiction, it surfaces. When implementation diverges from the plan during Phase 7+, the user updates the blueprint or the Curator does. The coverage tags (`[H]/[M]/[L]`) from `references/knowledge-base-pattern.md` make the staleness visible. **A static blueprint that drifts from the codebase is the failure mode** - Martin Fowler's review of Spec Kit specifically called this out: "Specs and code can fall out of sync. In early reports, specs are relatively static documents."

### The "sledgehammer for a nut" failure mode

Martin Fowler's review of Kiro found that asking it to fix a small bug produced "4 user stories with 16 acceptance criteria, including gems like 'User story: As a developer, I want the transformation function to handle edge cases gracefully.'" - a clear sledgehammer-for-a-nut failure.

The bleu can fall into the same trap. The `~38 action points` target is **a granularity guideline, not a quota**. A one-day refactor doesn't need a 38-AP blueprint. The Phase 0 intake is where you size the workflow to the project - if the user's idea is "add a debounce to this input," you don't run the full workflow. You write a one-paragraph plan and hand it off directly. Don't sledgehammer.

### The safe delegation window framing

EPAM's experience report on Spec Kit adoption surfaced the strongest single value proposition for SDD:

> "Our teams have been seeing the safe delegation window expand from 10–20 minute tasks to multi-hour feature delivery with consistent quality."

This is the user-facing benefit you should articulate when the user asks "why do all this planning before code?" The answer: because a real plan in files the agent can re-read is what makes long-running autonomous work safe enough to actually leave running. Without it, you're stuck supervising 10-minute tasks. With it, you can hand off a multi-hour feature and walk away.

---

## Target 1: GSD

GSD's flow is: interview → research → requirements → roadmap → plan → execute → verify. It does its own clarifying questions and research, but starts much sharper when given a grounded brief. The blueprint already contains everything GSD's interview would otherwise extract.

**Choose the right entry point:**

- `/gsd:new-project` - for a greenfield system. Use this when the blueprint is for an entirely new codebase.
- `/gsd:new-milestone` - for a major feature inside an existing project.
- `/gsd:quick` - for a smaller scope where the full spec-driven flow is overkill.

**Artifact: `blueprint/handoff/gsd.md`**

```markdown
# <Project / milestone name>

## What I'm building
<2–4 sentences from plan/00-vision.md - problem + solution + business context.>

## Technical environment
- Stack: <from plan/01-architecture.md>
- Patterns to follow: @blueprint/plan/03-components/<reference-component>.md
- Data model: @blueprint/plan/04-data-model.md
- Integrations: @blueprint/plan/05-integrations.md

## Scope
- IN: <bullet list, each item linking to the relevant plan file or AP>
- OUT: <explicit non-goals from plan/00-vision.md>
- Constraints: <from plan/06-non-functional.md>

## Success criteria
<From plan/00-vision.md, verbatim. GSD's verify phase needs these.>

## Execution order
The blueprint decomposes this into <N> action points. The dependency graph and
recommended execution order live in @blueprint/action-points/README.md.
GSD should plan its roadmap from that file.

## Research already done
<List of research/*.md files with one-line summaries. Saves GSD a research cycle.>
- @blueprint/research/<topic-1>.md - <conclusion>
- @blueprint/research/<topic-2>.md - <conclusion>

## Open questions accepted by the user
<From plan/07-risks-open-questions.md - items the user explicitly accepted to
defer rather than resolve. GSD should not re-ask these.>

## Pointer
The full blueprint is at @blueprint/. Read README.md first, then index.md.
```

**Auto-invoke (Claude Code with GSD plugin):**

After writing the artifact, offer:

> "Blueprint is locked and the GSD handoff is at `blueprint/handoff/gsd.md`. Want me to run `/gsd:new-milestone` now with this as the input?"

If yes, invoke the appropriate slash command and pass the file contents as the initial description. Confirm GSD picked it up before declaring done.

---

## Target 2: Superpowers

Superpowers' flow is: brainstorming → planning → TDD → subagent execution → code review. The brainstorming phase uses Socratic questioning to refine intent - but it goes much deeper when the intent already has substance and the design considerations are pre-surfaced.

**Choose the right entry point:**

- `/superpowers:brainstorm` (or `/brainstorm`) - for new features where some refinement is still welcome.
- Direct planning - when the blueprint is so locked-in that brainstorming would just rehash it. In that case, hand the artifact to the planning phase directly.

**Artifact: `blueprint/handoff/superpowers.md`**

```markdown
# Feature intent
<From plan/00-vision.md - rich enough that brainstorming refines rather than extracts.>

# Technical context
- Stack: <from plan/01-architecture.md>
- Relevant code: @blueprint/plan/03-components/
- Follow patterns in: @blueprint/plan/03-components/<reference>.md
- Data model: @blueprint/plan/04-data-model.md
- Test patterns: <if the blueprint specifies them>

# Design considerations (lenses already applied)
The blueprint already covers:
- **Architecture** - @blueprint/plan/01-architecture.md
- **Pipelines** - @blueprint/plan/02-pipelines.md
- **Security / perf / observability** - @blueprint/plan/06-non-functional.md
- **Edge cases** - distributed across @blueprint/action-points/AP-*.md

This means the brainstorming phase can focus on refining intent rather than
discovering structure from scratch.

# Testing strategy
- Happy path: <from the relevant action points>
- Edge cases: <from action points; each AP lists its own>
- Error cases: <from plan/06-non-functional.md and per-component failure modes>

Each action point in @blueprint/action-points/ has its own verification block -
TDD red phase should derive from those.

# Execution plan
The blueprint already decomposes this into <N> action points with explicit
dependencies, file paths, and verification. See
@blueprint/action-points/README.md for the dependency graph and execution order.
Superpowers' planning phase should adopt these as its micro-tasks rather than
re-decomposing.

# Constraints
- <From plan/06-non-functional.md>
- <Version-specific notes from research>
- <Security requirements>

# Research findings
<List of research/*.md files. Gives brainstorming/planning expert context.>
- @blueprint/research/<topic-1>.md - <conclusion>

# Pointer
Full blueprint at @blueprint/. README.md → index.md → plan/ → action-points/.
```

**Auto-invoke (Claude Code with Superpowers plugin):**

> "Blueprint is locked and the Superpowers handoff is at `blueprint/handoff/superpowers.md`. Want me to run `/superpowers:brainstorm` with this now, or skip straight to planning since the design considerations are already locked?"

If the user picks brainstorm, invoke `/superpowers:brainstorm` with the file contents. If they skip to planning, invoke the planning command directly. Either way, confirm Superpowers picked it up.

---

## Target 3: Raw Claude Code (no plugin)

When neither GSD nor Superpowers is present, hand the user a sequence they can execute action point by action point.

**Artifact: `blueprint/handoff/claude-code.md`**

```markdown
# Execution plan: <project name>

The blueprint at @blueprint/ is locked and ready to execute. Claude Code should
work through the action points in the order below, opening the relevant AP file
for each step.

## Before you start
1. Read @blueprint/README.md (orientation).
2. Read @blueprint/plan/00-vision.md and @blueprint/plan/01-architecture.md.
3. Skim @blueprint/index.md so you know what exists.

## Execution order
<Numbered list, topologically sorted from action-points/README.md. Mark
parallelizable groups. Each item links to its AP file.>

1. AP-01 - Bootstrap repo (S) - @blueprint/action-points/AP-01-bootstrap-repo.md
2. AP-02 - Auth token model (M) - @blueprint/action-points/AP-02-auth-token-model.md
   - Can run in parallel with AP-03.
3. AP-03 - DB schema initial migration (S) - @blueprint/action-points/AP-03-...
...

## How to execute one AP
For each AP:
1. Open the AP file. Read all sections.
2. Implement following the "Code flow" and "Files involved" sections exactly.
3. Run the checks in the "Verification" section.
4. If anything in the AP turns out to be wrong, update the AP file *before*
   moving on. The blueprint is the source of truth - keep it accurate.

## When you hit something not in the blueprint
Stop. Surface it. Don't improvise - improvising breaks the
expected-vs-actual mismatch detection that the blueprint exists to provide.
```

**Auto-invoke:** there's no slash command here. Just present the file and tell the user they can hand it (or any individual AP file) to Claude Code as a prompt.

---

## Target 4: Just the AP list

For users who don't want a wrapper artifact at all and just want the execution sequence.

**Artifact:** the contents of `blueprint/action-points/README.md` (which already has the ordered list and dependency graph). No new file needed - point them at it.

---

## Target 5: GitHub Spec Kit

GitHub Spec Kit is the open-source CLI for spec-driven development (Constitution → Specify → Clarify → Plan → Tasks → Implement), distributed as templates and slash commands for Claude Code, Cursor, Copilot, and Gemini CLI. It became the de facto cross-tool standard after being donated to the Linux Foundation's Agentic AI Foundation in late 2025.

Use Spec Kit as the handoff target when:

- The user already has Spec Kit installed (`uvx specify` works).
- The user wants the cross-tool portability - they may switch between Claude Code, Cursor, and Codex during execution.
- The team already standardizes on Spec Kit's slash commands and the user wants the blueprint to feed into that existing workflow.

**Artifact: `blueprint/handoff/spec-kit.md`**

The blueprint produces three Spec Kit-compatible documents from existing files. You don't need to rewrite them - just copy the right files to the right Spec Kit paths and tell the user to run `/specify`, `/plan`, `/tasks` against them.

```markdown
# Spec Kit handoff for <project name>

This blueprint maps directly onto GitHub Spec Kit's six-phase workflow.

## Constitution
Source: `@.claude/rules/blueprint-schema.md`
Or, if not using `.claude/rules/`: `@blueprint/plan/00-vision.md` (the
"non-goals" and "success criteria" sections function as constitution
principles).

To use with Spec Kit (if using `.claude/rules/`):
  cp .claude/rules/blueprint-schema.md .specify/memory/constitution.md
Otherwise, seed it from the vision file:
  cp blueprint/plan/00-vision.md .specify/memory/constitution.md

## Specify
Source: `@blueprint/plan/00-vision.md` + `@blueprint/raw/intake.md`

To use with Spec Kit:
  /specify @blueprint/plan/00-vision.md @blueprint/raw/intake.md

The vision file already has problem, target users, goals, non-goals, and
success criteria. Spec Kit's /specify command will accept it as the
source-of-truth for the spec phase.

## Clarify
Source: `@blueprint/plan/07-risks-open-questions.md`

If there are unresolved questions in the risks file, Spec Kit's /clarify
command will surface them. The blueprint's lint protocol means most have
already been resolved or explicitly accepted, so this phase should be quick.

## Plan
Sources:
  - `@blueprint/plan/01-architecture.md` (system, layers, decisions)
  - `@blueprint/plan/02-pipelines.md` (end-to-end flows)
  - `@blueprint/plan/03-components/*.md` (one per component)
  - `@blueprint/plan/04-data-model.md`
  - `@blueprint/plan/05-integrations.md`
  - `@blueprint/plan/06-non-functional.md`

To use with Spec Kit:
  /plan @blueprint/plan/01-architecture.md @blueprint/plan/02-pipelines.md @blueprint/plan/03-components @blueprint/plan/04-data-model.md @blueprint/plan/05-integrations.md @blueprint/plan/06-non-functional.md

## Tasks
Source: `@blueprint/action-points/`

The action points are already at task granularity. Each AP file is a Spec
Kit task with explicit dependencies, files involved, and verification.

To use with Spec Kit:
  /tasks @blueprint/action-points/

Spec Kit will read the dependency graph from `action-points/README.md` and
preserve the execution order.

## Implement
Once /tasks is run, Spec Kit's implementation phase walks through each AP
in dependency order. Each AP's "Verification" section becomes the test
criterion before moving to the next task.

Run: /implement
```

This is the leanest handoff format because Spec Kit's slash commands do most of the work. The blueprint just provides the inputs.

## Detecting which plugins are available

Before asking the user, check what's actually installed if you can:

- **GSD:** look for `.gsd/`, a `gsd.config.*`, or evidence in `CLAUDE.md`. If slash commands like `/gsd:quick` show up in the available command list, it's installed.
- **Superpowers:** look for `.superpowers/`, evidence in `CLAUDE.md`, or `/superpowers:*` slash commands.

If exactly one is installed, default to it but still confirm with the user. If both are installed, ask. If neither, default to raw Claude Code.

## Auto-invoke ground rules

- **Never auto-invoke without confirmation.** Always ask "want me to run `<command>` now?" first. The user might want to inspect the artifact before kicking off a multi-hour execution.
- **Only invoke commands that actually exist in the current environment.** If you're not sure, ask the user to confirm the command name.
- **Pass the artifact file contents, not the path.** Some plugins read prompts as raw text rather than following file references on first invocation. Once they're running, they can follow `@blueprint/...` references inside the artifact.
- **After invoking, stop and verify the executor took it.** Don't declare handoff complete until you've seen the executor acknowledge the brief.
