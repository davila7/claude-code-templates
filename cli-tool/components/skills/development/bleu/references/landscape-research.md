# Landscape Research

This file captures findings from a deep web research pass across the core concepts in this skill. Each section summarizes how frontliners are actually implementing these patterns, what worked, and what didn't. Citations point to canonical sources for the model to re-fetch when verifying details.

The findings here directly informed updates to SKILL.md and the other reference files. When those files describe a pattern, this file is where you'll find the evidence and the contributors.

---


## 1. The markdown-wiki-over-RAG pattern - adopter wins

A growing pattern in the LLM tooling community treats an LLM as a "research librarian" that compiles raw materials into an interlinked markdown wiki rather than using RAG (chunking + vector search). Working implementations have converged on several actionable techniques.

### Coverage tags (from `ussumant/llm-wiki-compiler`)

A working Claude Code plugin implementing the pattern. The key innovation: every section in a compiled wiki article carries a coverage tag so Claude knows when to trust the wiki versus check raw files.

```markdown
## Authentication flow [coverage: high]
The system uses JWT tokens issued by `auth-service`...

## Rate limiting [coverage: medium]
Limits are configured per endpoint. See raw notes for current values.

## Error handling [coverage: low]
Partial - needs more sources.
```

- `coverage: high` → trust this section, skip the raw files
- `coverage: medium` → good overview, check raw sources for granular questions
- `coverage: low` → wiki is incomplete here, defer to raw

**Quantified win**: the same plugin reports going from "13+ raw files / ~3,200 lines per session" to "INDEX + 2 topic articles / ~330 lines per session" - roughly **10× context reduction** for the same answer quality.

Source: https://github.com/ussumant/llm-wiki-compiler

### Topic articles vs concept articles

Same plugin distinguishes two article types, generated automatically:

- **Topic articles** are factual: "what happened?" One per concept identified across raw materials.
- **Concept articles** are interpretive and span 3+ topics: "what does this pattern *mean*?" Examples:
  - "Speed vs Quality Tradeoff - 6 instances where this decision appeared across retention, push notifications, and experiment design"
  - "Working with the Platform Team - communication patterns and decision dynamics synthesized from 24 meetings"
  - "Evolution of Retention Thinking - how the approach changed over six months"

The compiler scans the topic articles for patterns spanning 3+ topics and generates concept articles in `wiki/concepts/` automatically.

### The three-layer architecture is now canonical

Multiple secondary sources have converged on the same three-layer mental model: **raw / wiki / schema**. The schema layer is *explicit* - a file like `CLAUDE.md`, `AGENTS.md`, or `schema.md` that defines folder structure, citation rules, ingest workflow, Q&A behavior, and linting conventions. This is what turns an LLM from a generic chatbot into a disciplined wiki maintainer.

### Contamination control via separate vault

Obsidian's founder explicitly advises maintaining a separate "agent playground" vault to prevent LLM-generated content from contaminating the high-signal personal vault. Multiple practitioners echo this. The pattern: high-signal vault (human-curated, slow-moving) lives separately from the LLM-maintained wiki (high-volume, agent-edited).

For the bleu workspace, this means: keep human-authored project docs (READMEs, ADRs the team commits to) separate from `blueprint/`. The blueprint is the LLM's domain.

### The bookkeeping insight

The strongest single argument for the whole pattern, worth memorizing:

> The tedious part of maintaining a knowledge base is not the reading or the thinking - it's the bookkeeping. Updating cross-references, keeping summaries current, noting when new data contradicts old claims, maintaining consistency across dozens of pages. Humans abandon wikis because the maintenance burden grows faster than the value. LLMs don't get bored, don't forget to update a cross-reference, and can touch 15 files in one pass.

This is the strongest single argument for the skill's existence. Every other design choice serves it.

### Tooling tips

- **Log file format**: use a consistent prefix like `## [2026-04-02] ingest | Article Title` so it's grep-parseable: `grep "^## \[" log.md | tail -5` gives you the last 5 entries.
- **Local search**: `qmd` is a CLI/MCP local search engine for markdown with hybrid BM25/vector + LLM re-ranking. Better than building your own.
- **Marp** plugin for slide generation directly from wiki content.
- **Dataview** plugin for queries over YAML frontmatter.
- **Multimodal handling**: LLMs can't read markdown with inline images in one pass. Workaround: have the LLM read the text first, then view referenced images separately. Clunky but works.

### Trust and audit problem

The biggest concern raised across the community:

> "Confluence pages don't silently rewrite themselves. An LLM wiki can. Human audit checkpoints are non-negotiable before this becomes a real Confluence replacement."

For the bleu, this maps to: every cycle where the Curator modifies plan files should produce a diff the human can review. Git auto-commits provide the recoverable trail; the index health score provides the rollup; the reflection escalations provide the human checkpoint.

### Citation accuracy problem (specific to research/PDF ingestion)

> "When an LLM compiles a PDF into a wiki article, it loses precise page numbers unless explicitly instructed to extract and preserve them. Paraphrases by default. Has no built-in mechanism to link a claim back to 'page 47, paragraph 3'."

For research-heavy blueprints, the citation rules in `references/research-and-citations.md` need to mandate page-level provenance. The LLM will not do this on its own.

---

## 2. CLAUDE.md / AGENTS.md - what the research actually shows

This was the most surprising research finding and required reversing my previous advice in `claude-code-integration.md`.

### The ETH Zurich AGENTbench paper (Feb 2026)

Gloaguen, Mündler, Müller, Raychev, Vechev (ETH Zurich + LogicStar). **"Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?"**

First rigorous empirical test of context files. They built **AGENTbench**: 138 real-world Python tasks from 12 less-popular repositories (avoiding SWE-bench's memorization bias) where maintainers had committed actual context files.

Tested four agents (Claude Code with Sonnet 4.5, Codex with GPT-5.2 and GPT-5.1 Mini, Qwen Code) across three conditions: no context file / LLM-generated / human-written.

**Headline findings**:

1. **LLM-generated context files reduce task success rates by ~3% on average** compared to no context file at all.
2. **Context files of any kind increase inference cost by 14-22%** through extra reasoning steps (2-4 additional tool calls per task).
3. Human-written files give a marginal **~4% improvement** over no file - but still incur the cost overhead.
4. **Stronger models do not produce better context files**: GPT-5.2-generated files improved performance on SWE-Bench but degraded on AGENTbench.
5. **Context files don't help agents find files faster**: agents took roughly the same number of steps to reach relevant files even with codebase overviews.
6. **GPT-5.1 Mini spent extra steps re-reading context files already loaded into its context window** - pure waste.
7. Agents do follow the instructions faithfully - when the file mentions `uv`, agents use `uv` 1.6× per instance vs <0.01× without - but the broader exploration triggered by the file doesn't improve outcomes.

Sources:
- Paper: https://arxiv.org/abs/2602.11988
- InfoQ writeup: https://www.infoq.com/news/2026/03/agents-context-file-value-review/
- DAIR.AI walkthrough: https://academy.dair.ai/blog/agents-md-evaluation
- Augment guide: https://www.augmentcode.com/guides/how-to-build-agents-md
- Upsun guide: https://devcenter.upsun.com/posts/agents-md-less-is-more/

### What changed in the skill

Previous version of `claude-code-integration.md` recommended a `CLAUDE.md` that told Claude about the blueprint workspace upfront. Updated version recommends:

- **Start with no `CLAUDE.md`**. Let the agent work without one. For most tasks, the README and existing docs are enough.
- **Add rules iteratively, only when you observe a recurring failure**. Not a one-off mistake - a *pattern*.
- **Write for the gap, not the overview**. Tool choices that diverge from defaults (`use uv, not pip`), non-obvious test configurations, custom build commands. Skip everything inferable from `package.json`, `pyproject.toml`, `README.md`, existing `tsconfig`, etc.
- **Target under 150 lines** for the file as a whole. Frontier thinking models follow ~150-200 instructions reliably; Claude Code's own system prompt has ~50, so you have ~100-150 to spend wisely.
- **Hooks > CLAUDE.md instructions for things that must happen every time**. Hooks are deterministic; CLAUDE.md instructions are advisory. Anthropic's own docs make this distinction: "Use hooks for actions that must happen every time with zero exceptions."
- **Delete most of what `/init` generates**. The starter file includes many "obvious" things (yes, this is a TypeScript project) that compete for attention with the actual work.

### Anthropic's `<system-reminder>` injection - the smoking gun

HumanLayer discovered that Claude Code injects this with every CLAUDE.md load:

```
<system-reminder>
IMPORTANT: this context may or may not be relevant to your tasks. You should
not respond to this context unless it is highly relevant to your task.
</system-reminder>
```

This is Anthropic *telling Claude to ignore CLAUDE.md if it's not relevant*. The more bloated the file, the more likely it gets ignored. This is the strongest single argument for keeping it lean.

Source: https://www.humanlayer.dev/blog/writing-a-good-claude-md

### The hidden value: forcing articulation

A frequently-cited developer comment captures the real value of these files:

> "I've maintained a CLAUDE.md file for about 3 months across two projects and the improvement is noticeable but not for the reasons you'd expect. The actual token-level context it provides matters less than the fact that writing it forces you to articulate things about your codebase that were previously just in your head. Stuff like 'we use this weird pattern for X because of a legacy constraint in Y.' Once that's written down, the agent picks it up, but so does every new human on the team."

For the bleu workspace, this maps to: the value of writing the schema rules in `.claude/rules/blueprint-schema.md` is that it forces you to make implicit conventions explicit. The agent benefits, but so do future humans (and future you).

### Donation to Linux Foundation

In December 2025, AGENTS.md was donated to the **Agentic AI Foundation (AAIF)** under the Linux Foundation, alongside Anthropic's MCP and Block's Goose. It's becoming the cross-tool standard. For multi-tool teams: `CLAUDE.md` as a symlink to `AGENTS.md` works.

---

## 3. Anthropic's harness design for long-running agents

Anthropic published two engineering posts in late 2025 / early 2026 directly relevant to the bleu workflow. These are required reading.

### "Effective harnesses for long-running agents"

https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

The core problem: **agents work in discrete sessions, and each new session begins with no memory of what came before.** The analogy: "a software project staffed by engineers working in shifts, where each new engineer arrives with no memory of what happened on the previous shift."

Their solution is a **two-fold harness**:

1. **Initializer agent** runs only on the very first session. Different prompt from subsequent sessions. Sets up the structured environment: feature list (comprehensive requirements), git repo, progress tracking files (`claude-progress.txt`).
2. **Coding agent** runs on every subsequent session. Reads `claude-progress.txt` and the feature list at the start of each session, makes incremental progress on one feature at a time, updates the progress file before stopping, leaves the codebase in a "clean state" (mergeable, documented, no major bugs).

Critical implementation detail: **the initializer and coding agents are the same underlying agent with different initial prompts.** Not separate processes.

### The two failure modes addressed

- **Premature completion**: agents declare a project "complete" at maybe 60% done. Mitigated by the comprehensive feature list - the agent has to walk through all of it before declaring done.
- **Context anxiety**: model wraps up work prematurely as it approaches what it *believes* is its context limit. Sonnet 4.5 exhibited this strongly; Opus 4.6 mostly fixed it. Mitigated by context resets (clean slate) plus structured handoff artifacts.

### Context reset vs compaction

- **Reset**: clean slate, agent starts fresh with only the handoff artifact. Solves context anxiety but adds orchestration complexity, token overhead, and latency.
- **Compaction**: earlier conversation summarized in place, same agent continues with shortened history. Preserves continuity but doesn't fix context anxiety.

Newer models with larger context windows (Opus 4.6+) favor compaction. Older or anxiety-prone models need resets.

### "Harness design for long-running application development" (the GAN-inspired post)

https://www.anthropic.com/engineering/harness-design-long-running-apps

Prithvi Rajasekaran's follow-up. Three-agent architecture: **planner / generator / evaluator**, GAN-inspired. The evaluator was the key insight.

**The self-evaluation problem**:

> "When asked to evaluate work they've produced, agents tend to respond by confidently praising the work - even when, to a human observer, the quality is obviously mediocre."

This is why the **adversarial evaluation pattern** matters: the agent doing the work is *not* the agent judging it. For frontend design work, the evaluator was given four explicit grading criteria (design quality, originality, craft, functionality) and tools to interactively test running applications via Playwright MCP.

Iterations ranged from 5-15 cycles per run. Up to four hours of autonomous work.

**Application to the bleu**: the auditor agent (in `advanced-architecture.md`) shouldn't be the same agent as the linter, and shouldn't be the curator either. Proposer-validator separation is enforced in real production systems for a reason: agents praise their own work.

### The "audit your harness as models improve" principle

Direct quote from the harness post:

> "Audit your own harness. Are you running complex context management because the model actually needs it, or because you designed the system six months ago when the model did need it? Over-engineering the orchestration layer wastes tokens, adds latency, and introduces failure points that the current model could simply handle on its own."

Rajasekaran specifically dropped context resets and the sprint construct from his harness when moving from Sonnet 4.5 to Opus 4.6, because Opus 4.6 didn't need them.

### Application to bleu

The skill's Phase 0-7 workflow already follows the initializer-then-coding-agent pattern conceptually (Phase 0-1 = initializer, Phases 2-6 = coding agent equivalent). What's missing is the explicit `claude-progress.txt` analog. The blueprint's `index.md` plus `.telemetry/health.md` already serve this role; the addition is making the SessionStart hook surface them as the first thing every session.

The feature list analog is the action-points/ directory plus `action-points/README.md` with the dependency graph. The "leave a clean state" principle maps to: every Curator cycle ends with `index.md` updated, all referenced files existing, and the lint pass clean (or any new violations surfaced in `.reflection/proposals/`).

---

## 4. Spec-driven development - the canonical workflow

Three frontrunners in spec-driven development (SDD): GitHub Spec Kit, AWS Kiro IDE, BMAD-METHOD. All three converge on similar shapes with different emphases.

### GitHub Spec Kit (the new standard)

https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/

Open-source CLI from GitHub. Distributes templates and slash commands for Claude Code, Cursor, Copilot, Gemini CLI. Donated to AAIF under Linux Foundation.

Workflow: **Constitution → Specify → Clarify → Plan → Tasks → Implement**.

- **Constitution** (`constitution.md`): non-negotiable project principles. Stack versions, naming conventions, layering rules, allowed/forbidden libraries, auth/logging/accessibility standards. Encodes "project DNA."
- **Specify** (`/specify`): structured requirements document. User stories with acceptance criteria.
- **Clarify**: explicit clarification phase before planning. Often skipped in homemade workflows; making it explicit catches ambiguities early.
- **Plan** (`/plan`): technical plan covering stack, architecture, constraints. Can produce multiple variants for comparison.
- **Tasks** (`/tasks`): breaks plan into reviewable chunks each solving a specific piece.
- **Implement**: code generation within constraints from constitution + spec + plan.

**Each phase requires explicit human approval** before proceeding. Human-in-the-loop gates prevent runaway automation.

Source: https://github.com/github/spec-kit

### Kiro IDE

VS Code fork with three core documents: `requirements.md` → `design.md` → `tasks.md`. "Steering" memory bank with `product.md`, `structure.md`, `tech.md`. Agent hooks for automation (e.g., auto-generate GitHub PR from spec).

A practitioner reported: 86.5% test coverage on a real project, "the FIT conversion spec took 2 hours to write. It saved me 2 weeks of confusion."

### BMAD-METHOD

Multi-agent framework with six named personas: Analyst, Project Manager, Architect, Developer, QA Agent, plus Orchestrator. File-based handoffs via "story files." Strict role boundaries and discrete handoff protocols. Steep learning curve (21+ agents, YAML workflows).

Best for large greenfield projects with significant upfront planning value. Not recommended for small teams or rapid iteration - coordination overhead consumes more time than the structure saves.

### The "sledgehammer for a nut" failure mode

Martin Fowler's review of all three tools surfaces a critical adaptive-sizing problem:

> "When I asked Kiro to fix a small bug, it quickly became clear that the workflow was like using a sledgehammer to crack a nut. The requirements document turned this small bug into 4 'user stories' with a total of 16 acceptance criteria, including gems like 'User story: As a developer, I want the transformation function to handle edge cases gracefully.'"

Source: https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html

**Application to the bleu**: the `~38 action points` target is explicitly framed as a granularity guideline, not a quota. Small projects should have fewer APs. The Phase 0 intake should size the workflow to match the project - a one-day refactor doesn't need a 38-AP blueprint.

### Living spec vs static spec

Augment Code's evaluation of six SDD tools (Intent, Kiro, Spec Kit, OpenSpec, BMAD, Cursor) splits them into two categories:

- **Living-spec platforms** (Intent): keep documentation synchronized with code as agents work. When a code change touches an API contract, the spec reflects it immediately. No manual reconciliation.
- **Static-spec tools** (Spec Kit, BMAD, Kiro): structure requirements upfront but require manual reconciliation when implementation diverges.

Most static-spec tools see specs drift from implementation within hours.

Source: https://www.augmentcode.com/tools/best-spec-driven-development-tools

**Application to the bleu**: the wiki *should* be living. The Curator's compile mode is the synchronization mechanism. Coverage tags (`[coverage: high|medium|low]`) make divergence visible.

### The safe delegation window

EPAM's experience report: "Our teams have been seeing the safe delegation window expand from 10–20 minute tasks to multi-hour feature delivery with consistent quality" once they adopted spec-driven workflows.

This is the strongest argument for the skill: **planning before code expands the unit of work the user can safely delegate**.

Source: https://www.epam.com/insights/ai/blogs/inside-spec-driven-development-what-githubspec-kit-makes-possible-for-ai-engineering

---

## 5. Multi-agent team patterns from real teams

### PubNub's pm-spec → architect-review → implementer-tester pipeline

Two-part blog series (Aug 2025 → Feb 2026) documenting the evolution of a real production subagent pipeline.

Sources:
- Part I: https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/
- Part II: https://www.pubnub.com/blog/best-practices-claude-code-subagents-part-two-from-prompts-to-pipelines/

Three subagents:

1. **pm-spec** - reads enhancement, writes spec, asks clarifying questions, sets status `READY_FOR_ARCH`
2. **architect-review** - validates against platform constraints, produces an ADR, sets status `READY_FOR_BUILD`
3. **implementer-tester** - implements, tests, summarizes changes, sets status `DONE`

**Key principle**: "We kept humans in control: hooks suggested the next step, but a person explicitly ran it. That was the whole point. Repeatable progress, less chaos."

**Status slugs as state machine**: file-based status tracking (`READY_FOR_ARCH`, `READY_FOR_BUILD`, `DONE`) makes the pipeline state visible without a separate workflow engine.

### Wins from Part II

- **Context forking** for messy work: implementer and qa subagents run in forked contexts. They can do `npm test`, giant diffs, iterative debugging - and return a clean summary. This prevents the main conversation from "slowly turning into a landfill."
- **PreToolUse hooks** for blocking the most dangerous commands. "Add a PreToolUse hook that blocks the most dangerous commands your team worries about."
- **Don't boil the ocean**: "Pick one repo, pick one slug, and run it end-to-end."

### Effloow's 14-agent AI content company

https://dev.to/jangwook_kim_e31e7291ad98/claude-code-advanced-workflow-subagents-commands-multi-session-50hl

A "fully AI-powered content company with 14 agents orchestrated through Paperclip. Every agent runs Claude Code." Their wins:

- **Content QA Agent**: reviews Markdown for broken links, missing frontmatter, SEO issues, factual consistency before publishing - runs in isolation so the publishing agent's context stays focused.
- **Dependency Auditor**: when updating packages, a subagent checks each dependency for breaking changes, security advisories. Main session sees only "3 packages updated safely, 1 requires manual migration."
- **Code Exploration**: use the built-in Explore subagent rather than main agent reading dozens of files.

### wshobson/agents - the scale benchmark

https://github.com/wshobson/agents

182 specialized agents, 16 multi-agent workflow orchestrators, 147 agent skills, 95 commands organized into 75 plugins. A demonstration of how far the subagent ecosystem has scaled.

Includes a **conductor plugin** that turns Claude Code into a project management tool with a **Context → Spec & Plan → Implement** workflow. Same family as Spec Kit and the bleu's Phase 0-7.

### VoltAgent - 100+ specialized subagents catalog

https://github.com/VoltAgent/awesome-claude-code-subagents

Catalog of community-contributed subagents organized by role: orchestrators, research specialists, code reviewers, security auditors, etc. Each entry follows the same frontmatter schema. Useful as a reference for naming conventions and tool whitelists.

### Anti-patterns surfaced by all three sources

- **Tool sprawl**: omitting `tools` grants all available tools to a subagent. Whitelist intentionally.
- **Subagents in foreground when they should be background**: blocking the user during long operations.
- **No interactive thinking mode for subagents** - hard to monitor progress until they finish.
- **Subagents don't support stepwise plans** - they execute immediately. Use the main agent for tasks needing observable incremental steps.

### Agent Teams (the experimental Anthropic feature)

Anthropic shipped Agent Teams as an experimental feature with the Opus 4.6 release (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). Native multi-agent support with shared task lists, mailbox communication between teammates, and direct teammate-to-teammate messaging - the things community DIY orchestration scripts had been trying to build.

> "Subagents are contractors you send on separate errands. Agent Teams is a project team sitting in the same room, each working on their piece while staying in sync through conversation."

Source: https://claudefa.st/blog/guide/agents/agent-teams

**Application to bleu**: the four-agent team in `advanced-architecture.md` (Researcher, Curator, Linter, Auditor) can be implemented as either subagents (file-handoff communication) or as Agent Teams members (mailbox communication) depending on whether the user has the experimental flag enabled.

---

## 6. Reflection and self-improvement - what works in production

### Reflection vs Reflexion

These get conflated. The distinction matters:

- **Reflection** (lowercase): any meta-cognitive step where the agent critiques its own output, identifies errors, proposes corrections. Can be intra-episode (immediate) or post-episode (delayed). Can be ephemeral or persistent.
- **Reflexion** (capitalized): a class of agent frameworks that operationalize self-improvement by combining critique, memory, and planning across episodes. Original Shinn et al. paper: https://arxiv.org/pdf/2303.11366

Reflexion's three components: **Actor / Evaluator / Self-Reflection**. Memory bound to 1-3 stored experiences (so the model doesn't drown in past trials).

Source: https://sider.ai/blog/ai-tools/reflection-vs_reflexion-in-ai-agents-strategy-implementation-and-the-path-to-self-optimization

### Quantified gains

- Self-reflection improves problem-solving by **9.0-18.5 percentage points** depending on strategy
- GPT-4 baseline accuracy of **78.6% improved to 97.1% with unredacted reflection**
- Validated across Claude 3 Opus (97.1%), Gemini 1.5 Pro (97.2%), Mistral Large (92.2%), all p < 0.001

Source: https://galileo.ai/blog/self-evaluation-ai-agents-performance-reasoning-reflection

### Production wisdom

- **Separate evaluator beats single-model self-correction**: "AI agents testing AI agents architectures with separate evaluator models consistently outperform single-model self-correction approaches." This is the same finding as Anthropic's harness post - agents praise their own work.
- **RAG-augmented verification**: 0.76-0.92 AUROC for hallucination detection. Internal consistency checks fail against plausible-but-incorrect content.
- **Three-layer verification**: internal consistency → RAG-based factual verification → separate evaluator for semantic coherence.
- **Layered models**: cheaper model for reflection/critique, stronger model for final output (or vice versa depending on failure patterns).
- **Cache reflexion plans** for common task signatures.

### Risks of Reflexion memory

- **Memory bloat**
- **Enshrined mistakes** - bad lessons promoted to permanent memory
- **Drift**

**Mitigations**: versioned memories, decay policies, confidence thresholds, **shadow mode validation** before promoting lessons into production.

### Reflexion's known failure mode

Reflexion struggles with creative escape from local minima. From the original paper, the agent failed on WebShop tasks requiring creative behavior to escape - gave up after four trials with no improvement. **Implication**: reflection works for incremental refinement, not for tasks requiring a paradigm shift.

### Andrew Ng's four agent design patterns

Reflection is Pattern 1 of Andrew Ng's canonical four (Reflection / Tool Use / Planning / Multi-Agent). Ng treats Reflection as the foundation - the metacognitive layer the other three depend on.

### OODA + Reflexion complement

OODA (Observe-Orient-Decide-Act) governs real-time decision-making within a single task attempt. Reflexion enables learning across multiple attempts. They're complementary - OODA is intra-task, Reflexion is cross-task.

Source: https://tao-hpu.medium.com/agent-feedback-loops-from-ooda-to-self-reflection-92eb9dd204f6

### Strategic insight (the "moat" argument)

> "In a world where models converge, the compounding asset shifts to the loop and its data. Products that effectively implement self-optimizing AI agents will see quality rise with usage and cost decline per unit of success. That is the definition of a moat in software: learning that accrues to your product faster than it accrues to the market."

For the bleu workspace, this maps to: the wiki itself is the moat. The Curator's `MEMORY.md`, the schema rules, the accumulated proposal/verdict history - all of these compound across sessions and projects in a way that bare prompt engineering can't.

---

## 7. Memory architectures - CoALA and beyond

### The CoALA taxonomy (Princeton 2023)

The canonical taxonomy. Every major framework builds on it:

- **Working memory**: current context window
- **Procedural memory**: system prompts and decision logic
- **Semantic memory**: accumulated facts and preferences
- **Episodic memory**: past interaction logs and experiences

Source: https://arxiv.org/abs/2309.02427 (Cognitive Architectures for Language Agents)

### Production frameworks

- **Letta (formerly MemGPT)** - OS-inspired memory hierarchy. Treats context window as RAM, external storage as disk. Self-edits memory via tool calls. https://docs.letta.com/concepts/memgpt/
- **LangChain LangMem SDK** - hot path (immediate, latency hit) vs background (delayed, no latency) memory updates.
- **Zep / Graphiti** - temporal knowledge graphs with sub-200ms retrieval.
- **Mem0** - self-improving memory with automatic conflict resolution.
- **A-MEM** (Zettelkasten-inspired) - dynamic indexing and linking. Each new memory generates a structured note with contextual descriptions, keywords, tags. https://arxiv.org/abs/2502.12110
- **MIRIX** - six memory types: Core, Episodic, Semantic, Procedural, Resource, Knowledge Vault. Multi-agent framework that coordinates updates and retrieval. https://arxiv.org/html/2507.07957v1

### Two memory update approaches

- **Hot path memory**: agent explicitly decides to remember something *before* responding. ChatGPT does this. Adds latency, immediate availability.
- **Background memory**: separate process extracts and stores during/after the conversation. No latency hit, delayed availability.

### Programmatic vs agentic memory

- **Programmatic**: developer defines what gets stored.
- **Agentic**: agent decides what to remember/update/forget via tool calls.

Field is moving toward agentic. Letta and LangChain LangMem support both.

### Sleep-time computation (OpenAI internal pattern)

> "Agents that 'think' during idle time (reorganizing, consolidating, refining their memories) perform better and cost less at query time. OpenAI's internal data agent already runs this pattern in production. Their engineering team describes a daily offline pipeline that aggregates table usage, human annotations, and code-derived enrichment into a single normalized representation, then converts it into embeddings for retrieval."

**Application to bleu**: the reflection cycle in `advanced-architecture.md` should ideally run during idle time, not in the user's session. The `Stop` hook with a counter is one way; a scheduled task is another.

Source: https://blogs.oracle.com/developers/agent-memory-why-your-ai-has-amnesia-and-how-to-fix-it

### Episodic → semantic transformation ("semantization")

MemGPT's mechanism for converting episodic memories into semantic facts:

> "When MemGPT encounters information across multiple contexts, it gradually decouples the core information from its specific contextual details. For example, if a user repeatedly mentions preferring morning meetings, this preference might transition from being stored as a specific instance ('yesterday the user said they like mornings') to a general semantic fact ('this user prefers morning meetings')."

**Application to bleu**: raw transcripts in `blueprint/raw/transcripts/` are episodic. Synthesized articles in `blueprint/plan/` and `blueprint/research/` are semantic. The Curator's compile mode is the semantization function.

Source: https://informationmatters.org/2025/10/memgpt-engineering-semantic-memory-through-adaptive-retention-and-context-summarization/

### Strategic forgetting

> "MemGPT challenges the traditional paradigm by implementing strategic forgetting through summarization and targeted deletion. This represents a fundamental shift in how we think about information management in AI systems."

Cognitive triage: the LLM evaluates the future value of information fragments. High-value items retained, low-value summarized or deleted.

**Application to bleu**: the episodic memory under `raw/transcripts/` should be aggressively pruned. Older transcripts can be summarized and archived; semantic articles in `plan/` are kept pristine. Don't treat all memory as equally valuable.

### "Episodic memory is the missing piece" (position paper)

https://arxiv.org/pdf/2502.06975

A 2025 position paper arguing that the various memory approaches in the literature all target different properties unified in episodic memory. Building agents with explicit episodic memory unlocks long-term continuity.

---

## 8. Context engineering - Anthropic's framework + failure modes

### Anthropic's "Effective context engineering for AI agents"

https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

Published Sept 2025 alongside Claude Sonnet 4.5. The shift in framing:

> "Building with language models is becoming less about finding the right words and phrases for your prompts, and more about answering the broader question of 'what configuration of context is most likely to generate our model's desired behavior?'"

Context engineering = managing the full context state (system instructions, tools, MCP, external data, message history) over multiple turns. Prompt engineering is a subset.

**The Goldilocks principle for system prompts**: not too brittle/specific (hardcoding complex logic creates fragility), not too vague (leaves the model guessing). The right altitude is the zone in between.

**The core principle**: "find the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome."

### Context failure modes (from Weaviate's context engineering writeup)

https://weaviate.io/blog/context-engineering

Four named failure modes that emerge as context grows:

1. **Context Poisoning**: incorrect or hallucinated information enters the context. Because agents reuse and build upon that context, errors compound.
2. **Context Distraction**: the agent becomes burdened by too much past information; over-relies on repeating past behavior rather than reasoning fresh.
3. **Context Clash**: contradictory information within the context misleads the agent.
4. **Context Anxiety** (from Anthropic harness post): model wraps up early because it thinks it's near its limit.

These are the failure modes the bleu's Curator and Auditor exist to prevent.

### Six components of context engineering

Per Weaviate: Agents / Query Augmentation / Retrieval / Prompting / Memory / Tools. All six interact.

### "Lost in the middle" phenomenon

Documented Claude Code issue: agents ignoring CLAUDE.md instructions buried in the middle of long files. **Mitigation**: keep files short, place critical rules early, start new sessions for new tasks. As context grows, agents preserve architectural decisions while discarding redundant tool outputs.

### Agentic search vs pre-computed embeddings

> "Agentic search allows agents to explore their environment just-in-time through tools like glob and grep, rather than relying on pre-computed embeddings. This avoids issues like stale indexing and gives agents autonomy to discover context as needed."

**Application to bleu**: the Curator should use Glob/Grep to discover what's in `blueprint/` rather than relying on a stale index. The `index.md` file is a navigation aid, not a substitute for actually looking.

---

## 9. Observability for agentic systems

### Five dimensions (vs traditional reliability + cost)

LLM-specific observability adds three dimensions to traditional APM:

1. **Reliability** (latency, error rates, rate limits)
2. **Quality** (factual accuracy, groundedness, faithfulness, relevance, tool selection accuracy, planning quality, conversational coherence)
3. **Safety** (jailbreaks, toxicity, PII leaks)
4. **Cost** (token usage, retries, budget adherence)
5. **Governance** (audit trail, who accessed what data and why)

Source: https://portkey.ai/blog/the-complete-guide-to-llm-observability/

### The fundamental gap

> "A 200 HTTP code or low CPU usage says nothing about semantic quality. Did the agent actually answer the user's question? Was it factually correct? Bias-free? Relying solely on infrastructure metrics hides these failure modes until an angry user, compliance team, or front-page headline uncovers them."

Source: https://www.getmaxim.ai/articles/agent-observability-the-definitive-guide-to-monitoring-evaluating-and-perfecting-production-grade-ai-agents/

### Code-based vs LLM-based evaluators

From AWS's AgentCore Evaluations docs:

- **Code-based evaluators**: faster, cheaper, more reliable for deterministic checks (exact data validation, format compliance, business rule enforcement, exact value matching).
- **LLM-as-judge**: needed for semantic evaluation (factual correctness, relevance, coherence).

Use both. Code for the deterministic, LLM for the semantic.

Source: https://aws.amazon.com/blogs/machine-learning/build-reliable-ai-agents-with-amazon-bedrock-agentcore-evaluations/

### Online evaluation pattern

Continuously sample a configurable percentage of production traces and score them with the chosen evaluators. Surface results in a dashboard alongside operational metrics.

### Cost crisis

> "AI workloads generate 10-50x more telemetry data than traditional services. Tools like Datadog, New Relic, and Splunk price by data volume. That pricing model was designed for a world where telemetry volume scaled roughly linearly with traffic. AI workloads break that assumption completely."

Source: https://oneuptime.com/blog/post/2026-04-01-ai-workload-observability-cost-crisis/view

### OpenTelemetry semantic conventions for LLM workloads

The 2024 OTel spec introduced semantic conventions for LLM workloads - consistent representation of model-related spans. Adopting OTel for the bleu's telemetry log keeps it interoperable with whatever observability backend the user already has.

---

## 10. The trends that didn't quite fit other sections

### Subagents cannot spawn other subagents

From the Claude Code docs. If your workflow requires nested delegation, use Skills or chain subagents from the main conversation. This is a hard architectural constraint, not a soft preference.

### Plugin subagents have restrictions

Plugin subagents do **not** support `hooks`, `mcpServers`, or `permissionMode` frontmatter fields. If you need those, the agent file must live in `.claude/agents/` or `~/.claude/agents/`, not inside a plugin.

### `claude-code-guide` built-in subagent

Claude Code's own system prompt includes a `claude-code-guide` subagent (Haiku, read-only) that's automatically spawned for documentation lookup questions. When users ask "how do I configure X in Claude Code", trust this subagent over your memory - it pulls from current docs.

### `/init` generates a starter, but delete most of it

Per the ETH Zurich research and HumanLayer's blog: the `/init` command generates a CLAUDE.md draft, but most of what it produces is filler that competes for attention. The delete-first approach is faster than writing from scratch.

### Hierarchical context files

Place context files at any directory level. The agent reads the file closest to the file being edited. Per the Codex spec, more deeply nested files take precedence in conflicts.

### Symlink pattern

For multi-tool teams: `CLAUDE.md is a symlink to AGENTS.md. They are the same file.` Prevents drift between files.

---

## What this research changed in the skill

The most significant updates:

1. **Reversed the CLAUDE.md advice** in `claude-code-integration.md`. Previous version recommended a project CLAUDE.md telling Claude about the blueprint workspace. New version recommends starting with no CLAUDE.md, adding rules iteratively from observed friction, writing for the gap not the overview, targeting <150 lines.

2. **Added coverage tags and concept articles** to `knowledge-base-pattern.md`. From the `ussumant/llm-wiki-compiler` adopter wins.

3. **Added Anthropic's harness pattern** (initializer + coding agent + progress.txt + feature list) as the canonical reference for the Phase 0-7 workflow in SKILL.md.

4. **Added adversarial evaluation as the canonical justification** for proposer-validator separation in `advanced-architecture.md`. Backed by Anthropic's harness research and Galileo's production data.

5. **Added context failure modes** (poisoning, distraction, clash, anxiety) to the Linter's checklist in `advanced-architecture.md`.

6. **Added the spec-driven workflow mapping** (Constitution → Specify → Clarify → Plan → Tasks → Implement) to `handoff-formats.md`. The blueprint becomes a high-fidelity Specify+Plan output for the Implement phase.

7. **Added the bookkeeping insight** as the strongest single argument for the skill's existence in SKILL.md's "Why this skill exists" section.

8. **Added the "audit your harness as models improve" principle** to SKILL.md's operating principles. From Rajasekaran's harness post.

9. **Added the contamination control principle** (separate `blueprint/` from human-curated docs) to `knowledge-base-pattern.md`. From Obsidian's founder.

10. **Added the safe delegation window framing** (10-20 min tasks → multi-hour features) as the value proposition in SKILL.md. From EPAM's experience report.

---

# Part II - Frontline 2026 Update

A second pass through the landscape, picking up developments and gaps from the first round. Each subsection adds fresh evidence that informed concrete changes in the skill files.

---

## 11. Anthropic's 7-pattern decision tree

The clearest articulation of when to use which agentic pattern comes from Anthropic's "Building Effective Agents" post and the community catalogues that map it to Claude Code subagent infrastructure.

The tree (paraphrased from the canonical post and from `parthalon025/anthropic-agent-patterns`):

```
START
├─ Single, well-defined task in one domain?         → Pattern 1: Single specialist (70% of tasks)
├─ Clear sequential steps?                          → Pattern 2: Prompt chaining
├─ Independent subtasks runnable in parallel?
│  ├─ Same task needing consensus?                  → Pattern 4b: Voting
│  └─ Otherwise                                     → Pattern 4a: Sectioning
├─ Subtasks dynamic / unpredictable?                → Pattern 5: Orchestrator-workers
├─ Iterative refinement with clear criteria?        → Pattern 6: Evaluator-optimizer
└─ Open-ended exploration / debugging?              → Pattern 7: Autonomous agent
```

Default to Pattern 1. Escalate only when the simpler pattern demonstrably fails. Most teams over-architect.

### Two principles from Anthropic that bite

1. **"Anthropic spent more time on tool interfaces than prompts for SWE-bench."** Good tools beat complex orchestration. Invest in tool design (clear schemas, sensible defaults, useful error messages) before reaching for more agents.
2. **"Ground truth > LLM opinion."** Use test results, compiler output, linters, type checkers - not LLM self-evaluation - to validate work. The auditor in this skill should consult `.claude/rules/blueprint-schema.md` and the actual filesystem state, not just "vibe-check" the proposals.

Source: https://www.anthropic.com/research/building-effective-agents

### The evaluator-optimizer pattern (Pattern 6) - concrete fit for the blueprint workspace

Anthropic's description: "one LLM call generates a response while another provides evaluation and feedback in a loop." Use it when (a) you have clear evaluation criteria, (b) iterative refinement provides measurable value, (c) the LLM can demonstrably improve when a human articulates feedback, (d) the evaluator LLM can provide such feedback.

The Curator + Auditor loop in `advanced-architecture.md` is exactly this pattern. The schema rules in `.claude/rules/blueprint-schema.md` are the "clear evaluation criteria" - without them, the auditor degrades into LLM-vibes.

---

## 12. Anthropic's multi-agent research system blog - production lessons

https://www.anthropic.com/engineering/multi-agent-research-system

This is Anthropic's most candid post about running multi-agent systems in production (the Research feature in Claude). Key admissions and wins:

### Production lessons that apply directly to the bleu workspace

- **Agents are non-deterministic between runs even with identical prompts.** Debugging is harder than single-agent systems. **Add full production tracing - without it, you can't diagnose why an agent failed.** Apply: the `.telemetry/events.jsonl` file in `advanced-architecture.md` is non-optional for any multi-agent setup.

- **Monitor decision patterns and interaction structures, not contents.** Privacy-respecting observability is feasible: log which tools fire, how long each phase takes, what handoffs happen - not the contents of every message.

- **Best prompts are "frameworks for collaboration" rather than rigid rules.** Anthropic's research agents aren't told "do X then Y then Z" - they're told *how to think about* the problem. The skill's Curator/Linter/Auditor prompts should describe principles and decision heuristics, not step-by-step procedures.

- **Encode strategies skilled humans use.** Examples from Anthropic's research agents: decompose difficult questions into smaller tasks, evaluate source quality, adjust search approach based on new information, recognize when to focus on depth vs breadth. **The Researcher agent in `advanced-architecture.md` should have these heuristics in its prompt** - not just "use WebFetch to find sources."

- **Set explicit guardrails to prevent spiraling.** The early Claude research agents could go on tangents indefinitely. Maximum-iteration limits and escalation paths to humans are essential.

- **Source quality heuristic - concrete example.** Anthropic's early research agents consistently picked SEO-optimized content farms over authoritative sources like academic PDFs. Adding source quality heuristics to the prompt fixed it. **Apply: the Researcher agent's prompt must include source-ranking guidance**, not just "find sources."

- **Manual testing remains essential.** Multi-agent systems have emergent behaviors. "Small changes to the lead agent can unpredictably change how subagents behave." Don't trust automated evals alone.

- **Deployment needs careful coordination.** Multi-agent systems are stateful webs. Rollbacks are harder. Versioning is harder.

### The strongest single takeaway

> "Multi-agent systems have emergent behaviors that arise without specific programming. Success requires understanding interaction patterns, not just individual agent behavior."

For the bleu workspace this means: don't just test the Curator and Auditor in isolation. Test the cycle. Lint pass → proposals → audit → verdicts → curator-applies → re-lint. The cycle is where emergent failure modes hide.

---

## 13. Task decomposition - the granularity numbers everyone should know

The previous research touched on this but didn't surface the hard numbers.

### Multi-file vs single-function accuracy

From Augment's spec-driven decomposition guide: **multi-file tasks accuracy ~19%, single-function tasks accuracy ~87%.** Smaller task scope dramatically improves success rate, because smaller tasks fit within an agent's effective working set.

Source: https://www.augmentcode.com/guides/multi-agent-ai-system-code-development

### The 35-minute degradation problem

From Zylos Research's 2026 long-running agents survey: **every agent experiences performance degradation after ~35 minutes of human time.** This is why long-running tasks need explicit decomposition into chunks that fit within the effective performance window.

**Doubling task duration quadruples the failure rate.** Exponential failure growth as task length increases.

Source: https://zylos.ai/research/2026-01-16-long-running-ai-agents

### Planner-Worker cost split

**90% cost reduction is achievable** by using capable models for planning and cheaper models for execution. Apply: in a bleu workspace, the architect (Phases 1-3) needs Opus; the curator (compile/lint/index) can run Haiku.

### METR's "new Moore's Law"

From METR research: AI agent task completion duration is doubling every 7 months. Devin has merged hundreds of thousands of PRs at Goldman Sachs with 20% efficiency gains. The capability is real and growing.

But: "tasks requiring longer durations necessitate more stages, and doubling the task duration quadruples the failure rate." **Length growth is bottlenecked by failure-rate growth.** Decomposition is what makes the longer tasks tractable.

### Granularity rules from the `tasks` skill in `snarktank/compound-product`

A working production skill that decomposes PRDs into machine-verifiable tasks. Its rules (very actionable):

- **Each task addresses exactly ONE concern.** Multi-concern tasks must be split.
- **The golden rule: never combine 'find the problem' with 'fix the problem' in one task.** Diagnosis and remediation are separate tasks.
- **Each task completable in ONE iteration** - roughly one agent context window.
- **Every acceptance criterion must be a boolean check** that an AI agent can definitively pass or fail without human interpretation.
- **All browser-based acceptance criteria must use `agent-browser`** for autonomous UI verification.
- Examples of bad decomposition:
  - "Test the entire signup flow" → split into: load page, test inputs, test submit, test redirect, test mobile
  - "Fix the bug" → split into: identify file, make change, verify change, test regression
  - "Add authentication" → split into: schema, middleware, login UI, session handling

Source: https://deepwiki.com/snarktank/compound-product/4.4-task-generation-skill

**Application to bleu**: the action-point template in `references/action-point-template.md` should explicitly enforce these rules. Single concern. Boolean verification. No find+fix combined. One context window per AP.

### Coarse vs fine grained - explicit strategy mention helps

From the arxiv paper "Advancing Agentic Systems" (2410.22457): explicitly mentioning decomposition strategy (coarse vs fine) lets the system adapt based on complexity, with significant accuracy gains. **The Phase 0 intake should include a granularity-strategy decision**: a simple bug fix wants coarse decomposition (3-5 APs); a greenfield system wants fine (~38 APs).

---

## 14. Hooks at production scale - what frontliners actually do

The previous research mentioned hooks but didn't capture the production patterns. These are non-obvious and high-leverage.

### 17 hook events (not 13)

The current Claude Code hooks reference covers 17 lifecycle points. Total hook count includes the agent-team events (`TaskCreated`, `TaskCompleted`, `TeammateIdle`, etc.) added with Agent Teams.

### Hooks fire for subagent actions too - recursive enforcement

This is critical: if you have a `PreToolUse` hook blocking dangerous Bash commands, that hook also fires when a *subagent* tries to run Bash. **Without recursive hook enforcement, a subagent could bypass your safety gates.** This means hooks compose with subagents naturally.

Source: https://blakecrosley.com/blog/claude-code-hooks-tutorial

### "Don't block at write time - block at commit time"

From the Claude Code best-practices catalogue: 

> "Don't block at write time - let the agent finish its plan, then check the final result."

The pattern: don't put the linter in `PostToolUse` on `Write|Edit`. Put it in a `PreToolUse` hook on `Bash(git commit)` that checks for a `/tmp/agent-pre-commit-pass` marker file - the marker is written by a separate test-and-fix loop that runs after the agent finishes its plan. Forces convergence at the commit boundary, lets the agent iterate freely in between.

Application to the bleu: the curator shouldn't be blocked from writing intermediate states. The lint enforcement happens at the cycle boundary (Stop hook), not on every Edit.

### Sync vs async hooks - the latency tax

From a production multi-agent setup running 95+ hooks (https://dev.to/edwardkubiak/how-i-built-production-quality-gates-into-a-multi-agent-claude-code-workflow-4i55):

- **Telemetry hooks → `async: true`.** Don't need their output to make a decision. PostToolUse, SubagentStart/Stop, TaskCreated, Stop. **Eliminates measurable latency from observability overhead.**
- **Security and commit gates → synchronous.** Need to block. Cannot be async.
- **`if:` filters are essential at scale.** Without them, every hook fires on every tool call. With `if: "Bash(curl *)"`, the security guard only fires when curl is about to run.
- **`effort: low|high` per agent.** `low` for lightweight agents (commit, code-reviewer, push, test-runner), `high` for deep analysis agents (security, planner, researcher). Allocates thinking budget appropriately.
- **`isolation: worktree` for parallel dispatches.** When the orchestrator dispatches code-writer and test-writer in parallel, they can clobber each other's edits without worktree isolation.
- **301 BATS tests for the hooks themselves.** Shell scripts are easy to break silently. Hook test infrastructure is non-negotiable for any production deployment.

### Hooks vs CLAUDE.md - the durability ladder

From multiple sources:

- `CLAUDE.md` instructions are **advisory**. Standards are suggestions.
- Hooks are **enforced gates**. They cannot be bypassed.

The thread-based engineering guide maps the standards-to-enforcement ladder cleanly:
- "Use uv, not pip" → CLAUDE.md (advisory, the agent usually follows)
- "Run tests before commit" → hook (must happen, no exceptions)
- "Block writes to .git" → permission rule (hard architectural constraint)

### The auto-format token tax

From multiple practitioner reports: **automatic formatting hooks can consume significant context tokens - one report cited 160k tokens in 3 rounds.** The pattern is: hook formats → file content changes → Claude re-reads → agent reasons over the diff → format hook fires again. Loops.

**Mitigation**: keep auto-format hooks minimal, or run formatting between sessions instead of every save.

### `prek` - Rust pre-commit replacement

Worth mentioning for the git-hooks layer: `prek` is a Rust-based pre-commit hook manager that replaces Python's `pre-commit`. Single binary, parallel execution, git worktree support, no Python dependency. Faster than the Python tool by 10x+ in benchmarks.

Source: https://deepwiki.com/trailofbits/claude-code-config/10.3-pre-commit-hooks

### The AI technical debt stats hooks address

- **66% productivity tax** from "almost right" code (caught by `PostToolUse` formatting and lint hooks).
- **41% code churn** within 2 weeks of generation (caught by `PreToolUse` prompt hooks verifying architectural patterns).
- **45% vulnerability rate** in agent-generated code (caught by `PreToolUse` security hooks blocking edits to sensitive areas).

Source: https://www.pixelmojo.io/blogs/claude-code-hooks-production-quality-ci-cd-patterns

---

## 15. Knowledge graphs - when to use, when to skip

The previous research mentioned graphs only briefly. Here's the production reality.

### Graphiti vs Microsoft GraphRAG

Two ends of the spectrum:

- **Graphiti (Neo4j)** - real-time, temporally-aware, hybrid indexing (semantic + keyword + traversal). Built for agentic memory. Sub-200ms retrieval. Incremental updates without full graph recomputation. https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/
- **Microsoft GraphRAG** - batch-oriented, precomputed community summaries via Leiden algorithm. Excellent for static large datasets. **$33,000 indexing cost reported on large datasets.** Updates trigger expensive recomputation. Multi-step summarization makes retrieval slow (tens of seconds).

For agentic use cases, Graphiti wins. For static enterprise document corpora, Microsoft GraphRAG wins.

### The cost reality

- **GraphRAG entity extraction is 3-5x more expensive than baseline RAG.**
- **Entity recognition accuracy ranges 60-85%** depending on domain specificity.
- Knowledge graphs help when relationships matter (multi-hop reasoning); vector search is enough when chunks suffice.

Source: https://nstarxinc.com/blog/the-next-frontier-of-rag-how-enterprise-knowledge-systems-will-evolve-2026-2030/

### When to add a graph to the bleu workspace

The skill's `advanced-architecture.md` proposes a `.graph/graph.json` overlay. This is correct for blueprints with **substantial cross-references** between APs, components, and decisions - the graph enables queries like "if I change this component, which APs are affected?"

But: **don't build a graph if you don't need multi-hop reasoning.** A small blueprint with linear dependencies is fine with just `index.md`. The graph pays off when:
- You have 30+ APs with overlapping dependencies
- You need "blast radius" queries (which APs/components are affected by this change?)
- You want to programmatically detect cycles in the dependency graph
- You're using the blueprint as input to a multi-agent code-implementation system

### GraphRAG for production engineer agents - concrete example

Decoding AI Magazine's incident-response case study: FastAPI server + Neo4j graph + MCP servers (Confluence, GitHub, Slack, Prometheus). When an alert fires at 02:13, the agent traverses the graph to reconstruct: which services are involved, blast radius, ownership chains, applicable runbooks. Custom explicit agent loop, no framework, "making behavior predictable and debuggable."

The takeaway for the bleu: when relationships are denser than vector similarity captures, a graph pays for itself.

Source: https://understandingdata.com/posts/graphrag-for-production-agents/

---

## 16. Three-directory architecture and the value of an `outputs/` folder

The canonical layout for markdown-wiki-over-RAG is a **three-directory** architecture:

1. `raw/` - immutable source materials.
2. `wiki/` - the LLM-compiled, LLM-maintained knowledge base.
3. `outputs/` - **query responses, synthesized reports, analysis results.**

**The previous version of this skill missed the third directory.** Every query to the wiki produces an output document in `outputs/` - gives every query a persistent, auditable record. It is the markdown equivalent of "save your work."

For the bleu workspace, this maps to: `blueprint/outputs/` for everything the human asked the wiki to produce - synthesized reports, "explain this component to me", architecture diagrams generated on demand. The compiler doesn't write here; the user's queries do.

### Hard rule on LLM ownership

The sharpest principle in the pattern: **"You rarely ever write or edit the wiki manually - it's the domain of the LLM."** The skill's Curator subagent enforces it for the bleu use case. If the human is hand-editing `blueprint/plan/` files, the workflow has gone wrong - the human's role is sourcing, steering, and asking questions, not doing the bookkeeping.

### APQC stat that justifies the pattern

Knowledge workers lose **1.8 hours every day** searching for information (APQC, 2024). The markdown wiki pattern attacks that exact problem by building a structured, AI-maintained knowledge base with traceable claims. This is the strongest non-anecdotal evidence for the skill's value.

---

- **Skills are now portable across coding agents.** A SKILL.md written for Claude Code can be loaded by Cursor, Amp, Goose, etc. - same frontmatter format, same activation logic.
- **Skill versioning is still unsolved.** No built-in version field in the spec. The recommended pattern is directory structure: `.claude/skills/v1/`, `.claude/skills/v2/`. Production deployments should pin to a specific version.
- **Anthropic released a Skill-Creator testing framework in March 2026.** Quote: "Agent skills are notorious for fooling you into believing they work." The framework lets you systematically test/measure skills against expected behaviors. This is important for any skill that ships to production users - including this one.

Source: https://thenewstack.io/agent-skills-anthropics-next-bid-to-define-ai-standards/

### Application to the bleu skill

- Document the skill version somewhere obvious in SKILL.md so future updates can flag breaking changes.
- Recommend that users who depend on a specific behavior pin to a known version of the skill in their `.claude/skills/bleu/` directory.
- The skill's reference files (knowledge-base-pattern, action-point-template, etc.) are the natural unit of versioning - small, focused, testable changes.

---

## 18. The simplicity bias - what every frontline practitioner is shouting

Across all the sources, the loudest single message is: **start simpler than you think you need to.**

Quotes from the Claude Code best-practices catalogue (https://rosmur.github.io/claudecode-best-practices/):

> "Despite multi-agent systems being all the rage, Claude Code has just one main thread. I highly doubt your app needs a multi-agent system."

> "Debuggability >>> complicated hand-tuned multi-agent lang-chain-graph-node mishmash."

> "If you have a long list of complex custom slash commands, you've created an anti-pattern."

From Anthropic's "Building Effective Agents":

> "Optimizing single LLM calls with retrieval and in-context examples is usually enough."

> "Frameworks make it tempting to add complexity when a simpler setup would suffice. We suggest that developers start by using LLM APIs directly: many patterns can be implemented in a few lines of code."

From the decision-tree post:

> "Pattern 1 (single specialist) handles 70% of tasks. Add complexity only when it demonstrably improves results."

### What this means for the bleu skill

The skill has accumulated a lot of optional capabilities (advanced architecture, agent teams, knowledge graphs, schema-as-code, multimodal ingest, observability). **The core message in SKILL.md should be: most blueprints need only the base file-only workflow.** Phases 0-7 with no automation are the path. Reach for `claude-code-integration.md` only when the workspace will be revisited frequently. Reach for `advanced-architecture.md` only when the blueprint is substantial and the team is willing to maintain the orchestration.

The advanced material exists for the cases where it actually pays off, not as a default.

### Balancing the simplicity bias with the safe-delegation-window expansion

The counter-message - also from frontliners - is that **planning before code expands the safe-delegation window from 10-20 minute tasks to multi-hour features**. This is the strongest argument FOR the skill's existence and FOR investing in structure upfront.

The reconciliation: **upfront structure pays off when the problem is large enough**. For a small bug fix, the structure is overhead. For a greenfield system or multi-month project, the structure is the difference between "I'm in control" and "the agent went on a tangent for an hour."

Phase 0's intake/sizing decision is where this gets resolved. Don't use a 38-AP blueprint for a one-day task.

