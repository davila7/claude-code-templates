# Advanced Architecture

This file is read when the user wants the blueprint workspace to be more than a static markdown wiki - when they want a **living, self-improving system** with multi-agent collaboration, structured memory layers, schema-enforced rules, multimodal ingest, observability, and external integrations.

Everything here is **opt-in**. The base skill (Phases 0–7 in SKILL.md, with the file-only workflow) is fully usable on its own. The capabilities below are upgrades, layered on as the user wants them. Offer them as a menu - never install silently.

The capabilities cluster into seven groups, in rough order of how often they're worth turning on:

1. The reflection loop - self-improving memory with an auditor
2. Structure layers - knowledge graph + episodic/semantic split
3. The agent team - multi-agent collaboration beyond the KB Curator
4. Schema-as-code - symbolic rules the linter enforces
5. Multimodal ingest and derived outputs
6. Observability - wiki health score and telemetry
7. External integrations - MCPs for GitHub, Linear, meetings, web

Handoff modes (GSD / Superpowers / raw Claude Code / AP list) are documented separately in `handoff-formats.md` - cross-reference that file rather than duplicating it.

---

## 1. The reflection loop

The base skill lints reactively (Phase 6, plus mini-lints after each phase). The reflection loop makes the wiki **self-improving**: the LLM periodically reads its own outputs, nominates new rules or connections, and an **auditor agent** validates them before they're promoted into the schema.

This is the "schema you steer" idea made operational. The human rarely edits the wiki content directly; instead, the human reviews and approves changes the LLM proposes to the rules that govern the wiki.

### The loop

```
┌────────────────┐    proposes    ┌──────────┐    approves    ┌─────────────┐
│ Reflector pass │──────────────▶│ Auditor  │──────────────▶│ Schema      │
│ (reads wiki)   │                │ subagent │                │ (rules.md)  │
└────────────────┘                └──────────┘                └─────────────┘
        ▲                                │                            │
        │                                │ rejects                    │ enforced by
        │                                ▼                            ▼
        │                       ┌──────────────┐              ┌──────────────┐
        │                       │ Trash with   │              │ Linter pass  │
        │                       │ reason       │              │ (next cycle) │
        │                       └──────────────┘              └──────────────┘
        │                                                            │
        └────────────────────────────────────────────────────────────┘
                              feeds findings back
```

### What the Reflector looks for

After each major phase (or on demand), the Reflector reads `blueprint/` and nominates:

- **New rules** - patterns it sees repeating that should be codified ("every component file has a Failure Modes section - make it required").
- **New connections** - entities mentioned in multiple files that aren't cross-linked yet ("`auth-service` and `audit-logger` both reference `token.issued` events - add bidirectional links").
- **Rule violations** - places where the wiki doesn't match its own existing rules ("AP-12 has no Verification section, which violates schema rule R-04").
- **Promotion candidates** - raw notes in `raw/` that have stabilized enough to compile into `plan/` or `research/`.
- **Demotion candidates** - plan content that the user has overruled in conversation but never updated in the file.
- **Context engineering failure modes** - the four named patterns from Anthropic and Weaviate's context engineering writeups, specifically translated to the wiki:
  - **Context Poisoning** - incorrect or hallucinated info has entered the wiki and is now propagating ("AP-07 cites a function signature that doesn't exist in the codebase; AP-12 inherited the wrong signature from AP-07"). Highest severity - these compound.
  - **Context Distraction** - the wiki has accumulated so much past detail that the actual decisions are buried under noise ("plan/03-components/auth-service.md has 14 sections but the core responsibility is one paragraph; new readers can't find it"). Medium severity - propose summarization.
  - **Context Clash** - two files describe the same thing in contradictory ways ("plan/02-pipelines.md says the ingest worker is idempotent; plan/03-components/ingest-worker.md says it isn't"). High severity - must reconcile.
  - **Context Anxiety** (architectural variant) - the plan is over-scoped relative to the user's actual goal, hedging against scenarios that won't happen ("the data model has fields for multi-tenancy but the user explicitly said single-tenant"). Medium severity - propose pruning.

  These four are the same failure modes Anthropic's context engineering posts identify for *runtime* agents, but they apply equally to a static planning artifact. The Reflector is the linter for them.

Nominations go to `blueprint/.reflection/proposals/<timestamp>-<slug>.md` - one file per proposal - using this format:

```markdown
# Proposal: <short title>

**Type:** new-rule | new-connection | rule-violation | promote | demote
**Severity:** high | medium | low
**Confidence:** high | medium | low

## What I observed
<Concrete: file paths, line references, examples.>

## What I propose
<The change. Be specific. If it's a rule, write the rule text exactly as it
should appear in .claude/rules/blueprint-schema.md.>

## Why
<The reasoning. Cite the wiki files that support this.>

## Risk if approved
<What could go wrong if this gets adopted. Honest.>

## Risk if rejected
<What stays broken. Also honest.>
```

### The Auditor - implemented as an agent hook

The Auditor's only job is to validate proposals. It's a separate concern from the Reflector (or the KB Curator) so the proposer-validator distinction is preserved - you don't want the same agent both proposing and approving its own changes.

The cleanest implementation is an **`agent` hook** on `SubagentStop` of the kb-linter, not a manually invoked subagent. When the linter finishes writing proposals, the agent hook fires automatically, spawns a verifier with Read, Grep, Glob plus Write scoped to `.reflection/` (it records verdicts and escalations there but never touches the wiki or the proposals), passes it the proposals, and returns approve/reject/escalate. No file-passing dance, no separate invocation.

In `.claude/settings.json`:

```json
{
  "hooks": {
    "SubagentStop": [
      {
        "matcher": "kb-linter",
        "hooks": [
          {
            "type": "agent",
            "prompt": "Read every file in blueprint/.reflection/proposals/ that doesn't yet have a matching verdict in blueprint/.reflection/verdicts/. For each proposal: APPROVE if evidence is solid and the change doesn't touch architecture/data-model/AP-dependency-graph. ESCALATE if it touches any of those (write to blueprint/.reflection/escalations/<id>.md with a yes/no question for the human). REJECT if the proposal lacks file-path evidence or contradicts an existing rule in .claude/rules/blueprint-schema.md without retiring that rule. Write one verdict file per proposal at blueprint/.reflection/verdicts/<id>.md. Your tools are read-only against the wiki and the proposals; Write is allowed only inside .reflection/. Never write outside .reflection/.",
            "timeout": 180
          }
        ]
      }
    ]
  }
}
```

The agent hook spawns a subagent automatically with a default tool set scoped to verification. You don't need a separate `.claude/agents/kb-auditor.md` file - the hook handles spawning. If you do want a named agent for explicit invocation as well, you can create one in addition.

### Why agent hooks for this

The previous version of this file had the Auditor as a manually invoked subagent with a file-passing protocol (`.reflection/pending-lint` markers, etc.). That worked but required either a hook to trigger the Auditor or the user to remember to invoke it. With agent hooks, the auditor fires automatically the moment the linter finishes - no orchestration code, no marker files, no user attention.

Agent hooks are supported on `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `PreToolUse`, `Stop`, `SubagentStop`, `TaskCompleted`, `TaskCreated`, and `UserPromptSubmit`. The auditor pattern uses `SubagentStop` matched on the linter's name.

### Wiring the Reflector

The Reflector itself is the kb-linter subagent (see "The agent team" section below). It runs:

**Sleep-time computation** is the production-grade pattern for *when* the Reflector should fire. From Oracle's writeup of OpenAI's internal data agent:

> "Agents that 'think' during idle time (reorganizing, consolidating, refining their memories) perform better and cost less at query time. OpenAI's internal data agent already runs this pattern in production."

For the bleu, this means: **the Reflector should ideally run during the user's idle time, not in their session**. Three options in order of preference:

1. **Scheduled task** (Claude Code's `scheduled-tasks` feature, or a cron job calling `claude -p`) - fires at midnight or whenever the user isn't working.
2. **Stop hook with a counter** - every Nth Stop event (default: 5), the Reflector runs. Cheap, but adds latency to one in N user sessions.
3. **On demand** - `@kb-linter run a reflection pass`. Pure manual, no surprise.

Choose #1 if the user has Claude Code's scheduling enabled. #2 is a reasonable fallback. #3 is the always-available baseline.

The reflection cycle running mechanism options:

- Automatically via a `Stop` hook on the curator that fires every N curator runs (use a counter file in `blueprint/.reflection/`).
- On demand via `@kb-linter run a reflection pass` from the user.
- On a schedule via [scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks).

When the linter finishes, the agent-hook auditor takes over automatically. Escalations surface in the next session via the `SessionStart` hook from `claude-code-integration.md`.

### Why proposer-validator separation is the canonical pattern

Anthropic's January 2026 harness post documents the canonical reason for keeping the proposer (Reflector) separate from the validator (Auditor):

> "When asked to evaluate work they've produced, agents tend to respond by confidently praising the work - even when, to a human observer, the quality is obviously mediocre. This problem is particularly pronounced for subjective tasks like design, where there is no binary check equivalent to a verifiable software test."

This is the same finding that emerged independently in Galileo's production data: "AI agents testing AI agents architectures with separate evaluator models consistently outperform single-model self-correction approaches." RAG-augmented verification achieves 0.76-0.92 AUROC for hallucination detection; internal consistency checks fail against plausible-but-incorrect content.

The architectural implication is direct: **the agent that wrote the proposal must not be the agent that approves it**. This skill enforces it structurally:

- The **Reflector** writes proposals to `.reflection/proposals/`. It cannot write verdicts.
- The **Auditor** reads proposals and writes verdicts to `.reflection/verdicts/`. It cannot write proposals.
- These are different agents (or, equivalently, the same harness with different prompts and disjoint write permissions).

For frontend design tasks, Anthropic's evaluator agent uses Playwright MCP to actually navigate live pages and interact with the running interface - not just code review, but functional testing. The blueprint analog is the Auditor reading the actual files referenced by a proposal, not just trusting the proposal's summary.

The same pattern shows up in three independent strands of frontliner research:

- **Reflexion** (Shinn et al., 2023): Actor / Evaluator / Self-Reflection as three separate components, with memory bound to 1-3 stored experiences. The Evaluator is structurally distinct from the Actor.
- **Anthropic harness** (2026): Planner / Generator / Evaluator, GAN-inspired, three separate agents.
- **PubNub's pm-spec / architect-review / implementer-tester pipeline**: each role is a different subagent with its own tool whitelist and its own status slug it transitions to.

If the user pushes back and asks "why can't the Curator just lint its own work?", the answer is this section. Self-evaluation is a documented production failure mode, not an aesthetic preference.

### Reflection vs Reflexion - the distinction matters

These get conflated in casual usage, but the difference is meaningful:

- **Reflection** (lowercase): a single meta-cognitive step where the agent critiques its own output, identifies errors, proposes corrections. Can be intra-episode (immediate) or post-episode (delayed). Can be ephemeral (used once) or persistent.
- **Reflexion** (capitalized): a class of agent frameworks (Shinn et al., 2023) that operationalize self-improvement by combining critique, **memory**, and **planning across episodes**. The persistence and the cross-episode learning are what make it Reflexion rather than reflection.

The bleu's reflection loop is **closer to Reflexion** because the Auditor's verdicts and the schema rule evolutions persist across cycles. But it's not a pure Reflexion implementation: the memory bound is the schema rules file (effectively unlimited if the rules stay short), not the 1-3 experience cap of the original paper.

**Risks of Reflexion-style memory** that the production literature has documented and that this skill must mitigate:

- **Memory bloat** - the rules file grows unboundedly. *Mitigation*: every rule has a `status: active|deprecated` field and the Linter retires unused rules during the lint pass.
- **Enshrined mistakes** - bad lessons get promoted to permanent rules. *Mitigation*: the Auditor's escalate-to-human path for any rule that touches architecture, data model, or AP dependency graph.
- **Drift** - rules slowly stop matching the actual blueprint. *Mitigation*: the wiki health score (section 6) tracks rule violation density over time; spikes surface in `SessionStart`.
- **Local-minima trap** - Reflexion is documented to struggle with tasks requiring creative escape. From the original paper: WebShop benchmark, four trials, no improvement, agent gives up. *Mitigation*: the human is in the loop for proposals that touch architecture; creative escapes are explicitly the human's job, not the loop's.

### Three-layer verification

Galileo's production wisdom for evaluator-based architectures is a **three-layer verification stack**, in order of trust:

1. **Internal consistency checks** during generation (the agent's own immediate self-checks)
2. **RAG-based factual verification** against trusted knowledge sources (the Auditor reading the actual files)
3. **Separate evaluator models** for semantic coherence validation (LLM-as-judge with explicit rubric)

For the bleu, this maps to:

1. The Curator's normal output discipline (the existing Phase 0-7 workflow)
2. The Linter reading actual `blueprint/` files to verify proposed rule violations
3. The Auditor as an `agent` hook running with explicit rubric criteria - not just "is this proposal good?" but "approve / escalate / reject with reasoning grounded in file evidence"

Layered models pattern: use a **cheaper model for the Linter** (Haiku is fine - it's pattern-matching against schema rules) and a **stronger model for the Auditor** (Sonnet - it's making approve/reject judgment calls). Or invert if your failure pattern is missed proposals rather than bad approvals.

### Why this matters

Without reflection, the wiki only improves when the human notices something wrong. With reflection, the wiki notices its own drift and proposes fixes - but the human still controls the schema (via approving or rejecting proposals), so the LLM can't quietly turn the wiki into something the human didn't ask for.

This is the same principle as Self-RAG and other agentic reflection patterns: the model critiques its own output, but a separate evaluator gates the critique.

---

## 2. Structure layers - graph + episodic/semantic memory

Markdown is the substrate. Two structure layers go on top of it:

### 2A. Knowledge graph overlay

Maintain a lightweight graph of entities, concepts, and backlinks alongside the wiki. The graph is **derived** from the markdown, not authoritative - if the graph and the markdown disagree, the markdown wins and the graph is rebuilt.

**File:** `blueprint/.graph/graph.json`

```json
{
  "nodes": [
    { "id": "auth-service", "type": "component", "file": "plan/03-components/auth-service.md" },
    { "id": "token", "type": "entity", "file": "plan/04-data-model.md#tokens" },
    { "id": "AP-02", "type": "action-point", "file": "action-points/AP-02-auth-token-model.md" }
  ],
  "edges": [
    { "from": "auth-service", "to": "token", "type": "manages" },
    { "from": "AP-02", "to": "auth-service", "type": "implements" },
    { "from": "AP-02", "to": "token", "type": "creates" }
  ]
}
```

**How it's built:** the Curator extracts nodes and edges from the markdown on each compile/lint cycle. Components, entities, action points, research files, and external services become nodes. Cross-references (`@blueprint/...` links, "depends on", "calls into", "consumed by") become edges.

**How it's used:**

- **Obsidian-style views.** If the user opens `blueprint/` in Obsidian, the graph view works because the markdown already uses `[[wiki-links]]`-compatible references. The `.graph/graph.json` is for programmatic queries.
- **MCP-queryable.** A small MCP server (or a CLI) reads `.graph/graph.json` and answers "what depends on `auth-service`?" or "show me everything that mentions `token.issued`." This becomes a tool the main agent can use during research and lint passes.
- **Lint signals.** Dangling edges (edge points to a non-existent node) become high-severity lint findings. Orphan nodes (no edges) become medium-severity findings.

**Rebuild rule:** the graph is regenerated from scratch on every Curator cycle. Never edit `.graph/graph.json` by hand - it's a derived artifact.

### 2B. Episodic vs semantic memory ("semantization")

The episodic→semantic split is the canonical CoALA taxonomy (Cognitive Architectures for Language Agents, Princeton 2023), used by every major memory framework - Letta/MemGPT, LangChain LangMem, MIRIX, A-MEM. It maps cleanly to the bleu workspace:

- **Episodic memory** → `blueprint/raw/` - time-stamped, situational. The user transcript, the meeting notes, the codebase snapshot, the research dumps. "Yesterday the user said X."
- **Semantic memory** → `blueprint/plan/` and `blueprint/research/` - general knowledge detached from context. "The architecture uses pattern Y because Z."

The Curator's compile mode is what MemGPT's literature calls **"semantization"**: the process of decoupling core information from its specific contextual details. From the MemGPT writeup:

> "When MemGPT encounters information across multiple contexts, it gradually decouples the core information from its specific contextual details. For example, if a user repeatedly mentions preferring morning meetings, this preference might transition from being stored as a specific instance ('yesterday the user said they like mornings') to a general semantic fact ('this user prefers morning meetings')."

For the bleu Curator, semantization is the rule: **never copy raw content into plan files verbatim**. Always extract the principle, name the source, link back. "Per the user's intake (raw/intake.md), the system must support up to 10K concurrent users" not "the user said 'we need to support like 10K users at peak'."

The 2025 position paper "Episodic Memory is the Missing Piece for Long-Term LLM Agents" argues that explicit episodic memory unlocks long-term continuity that other memory approaches can't provide. The blueprint's `raw/` directory is exactly this - episodic memory the agent can re-read on any future session.

### Strategic forgetting

MemGPT's other important contribution is **cognitive triage**: the LLM evaluates the future value of stored information and aggressively prunes low-value content via summarization or targeted deletion.

Application to the bleu: **`raw/transcripts/` should be aggressively pruned**. After a few weeks, old transcripts can be summarized and archived. `plan/` files should never be silently pruned - they're the semantic layer. Don't treat all memory as equally valuable.

### The original episodic/semantic split documentation

The wiki has two kinds of content that the base skill conflates:

- **Episodic memory** - raw session traces, conversation transcripts, "what happened on Tuesday." These live in `blueprint/raw/` already, but should be split out further:
  - `blueprint/raw/transcripts/<timestamp>.md` - full session transcripts (the `PreCompact` hook from `claude-code-integration.md` already writes here).
  - `blueprint/raw/decisions/<timestamp>.md` - discrete decision moments captured from the conversation ("user chose Postgres over SQLite at 2026-04-07 14:32").

- **Semantic memory** - synthesized, denormalized articles about concepts. These live in `blueprint/plan/` and `blueprint/research/`. They're stable, edited carefully, and reflect the current best understanding.

**Bidirectional linking.** Every semantic article carries a `## Sources` section listing the episodic files that informed it. Every episodic file gets a `## Synthesized into` section (added by the Curator) listing the semantic files it influenced. This makes drift detectable: if a decision in episodic memory was later overruled in conversation, the link surfaces it.

**Why split them:** episodic memory is high-volume, low-edit, append-only. Semantic memory is low-volume, high-edit, carefully curated. Mixing them in `raw/` makes both harder to reason about. The split also makes it possible to **prune** episodic memory aggressively (older transcripts can be summarized and archived) while keeping semantic memory pristine.

---

## 3. The agent team

The base skill has one subagent (KB Curator). The agent team expands this into four roles, each with a locked tool whitelist and a single clear job. They hand off to each other through files, not direct calls.

| Agent | Job | Tools | Reads | Writes | Implemented as |
|---|---|---|---|---|---|
| **Researcher** | Web research; ingests external content into `raw/research/` with citations | `WebFetch, WebSearch, Read, Write` | external web | `blueprint/raw/research/` | `.claude/agents/researcher.md` |
| **Curator** | Compiles `raw/` into `plan/`; rebuilds `index.md` and `.graph/graph.json` | `Read, Write, Edit, Glob, Grep` | `blueprint/` | `blueprint/plan/`, `blueprint/index.md`, `blueprint/.graph/` | `.claude/agents/kb-curator.md` |
| **Linter** | Reflection pass; finds gaps, contradictions, rule violations; writes to `.reflection/proposals/` | `Read, Write, Glob, Grep` | `blueprint/`, `.claude/rules/` | `blueprint/.reflection/proposals/` | `.claude/agents/kb-linter.md` |
| **Auditor** | Validates Linter proposals; approves/rejects/escalates | (Read/Grep/Glob + Write scoped to `.reflection/`, set by hook) | `blueprint/.reflection/proposals/` | `blueprint/.reflection/verdicts/`, `blueprint/.reflection/escalations/` | **Agent hook** on `SubagentStop` matched to `kb-linter` (no separate agent file) |

The KB Curator from `claude-code-integration.md` is the same Curator role here - just renamed conceptually. The other three are new files in `.claude/agents/`.

**Research paths:** the Researcher stages raw captures in `raw/research/` (episodic memory); the Curator promotes synthesized, cited findings to `research/` (semantic memory). In the base workflow without an agent team, research is written directly to `research/`.

### The GAN-inspired three-agent baseline (Anthropic, 2026)

Anthropic's harness research converged on a **three-agent architecture** as the canonical pattern for long-running autonomous coding: **Planner / Generator / Evaluator**. Inspired by Generative Adversarial Networks. The Generator does the work, the Evaluator grades it against explicit rubric criteria, the Planner decomposes the task. Iteration cycles range from 5 to 15 per run, sometimes producing four hours of autonomous work.

The bleu's four-agent team is a **superset**:

| Anthropic's role | This skill's agent | Why we have four instead of three |
|---|---|---|
| Planner | (the user, in Phase 0-1) | Phase 0 intake is human-led - the user defines the problem, scope, and feature list. We don't automate this. |
| Generator (research) | **Researcher** | Web research is split out so it has its own tool whitelist (WebFetch, WebSearch, no edit) and so its outputs land in `raw/research/` for independent audit. |
| Generator (compile) | **Curator** | Compiles `raw/` into `plan/`, rebuilds index. Where the structured wiki actually gets written. |
| Evaluator | **Linter** + **Auditor** | Split into two for the proposer-validator separation reason above. The Linter proposes; the Auditor validates. Same Anthropic principle, made structural. |

If the user is on a recent Opus model and the project is small, the four-agent team is overkill. Collapse to two: **Curator** (does the work) and an `agent` hook **Auditor** (validates on every Stop). That's the minimal viable proposer-validator separation. Add Researcher and Linter when the blueprint outgrows it.

### Why four agents and not one

- **Tool isolation.** The Researcher needs web access. The Curator needs filesystem write. The Linter and Auditor are read-only against canonical content (each writes only its own outputs under `.reflection/`). One agent with all four capabilities is a much wider attack surface - and prone to "while I'm at it" drift where it modifies things outside its job.
- **Proposer-validator separation.** The Linter proposes changes; the Auditor validates them. Same agent doing both is just self-approval.
- **Parallel execution.** When the user is working through a complex blueprint, Researcher and Curator can run on different files in parallel without context contamination.
- **Audit trail.** Each agent's outputs land in distinct directories, so it's clear which agent touched what. Useful for debugging "why did this entry change?"

### Handoff protocol (using Claude Code hooks)

Agents communicate through files, but the **transitions are automated by hooks** rather than manual invocation:

1. **Researcher → Curator.** Researcher writes `raw/research/<topic>.md`. A `FileChanged` hook (matching basename, filtered by path inside the script) writes a marker to `blueprint/.curator-pending/`. The next prompt or `SessionStart` surfaces the pending queue and the main agent invokes the Curator.
2. **Curator → Linter.** A `Stop` hook in the curator's frontmatter increments a counter file. Every Nth curator run (default: every 5), it invokes the kb-linter.
3. **Linter → Auditor.** Linter finishes, `SubagentStop` matched on `kb-linter` fires an **agent hook** that spawns the Auditor automatically. No file passing, no manual step.
4. **Auditor → Curator.** Approved verdicts get applied by the Curator on the next cycle. Escalations sit in `.reflection/escalations/` until resolved by the human, surfaced via `SessionStart`.

This is the modern pattern. The previous version of this file used a `.reflection/pending-lint` marker file and manual orchestration; that worked but required either an extra hook or user attention. With agent hooks, the auditor is fully automatic.

### Subagent frontmatter - built-in features to use

For each agent file, lean on Claude Code's built-in subagent features instead of hand-rolling:

- **`memory: project`** - built-in persistent directory at `.claude/agent-memory/<name>/`. The `MEMORY.md` file there is auto-injected into the agent's prompt at startup. Use this for institutional knowledge instead of `raw/curator-notes.md`.
- **`skills: [bleu]`** - preloads the entire skill content into the agent's context at startup. All four agents should have this.
- **`isolation: worktree`** - for the Linter especially, runs the agent in an isolated git worktree. If it makes no changes, the worktree auto-cleans. Useful for "dry-run" lint passes that explore without polluting the working tree.
- **`background: true`** - for the Linter, makes Claude always spawn it as a background task so the user keeps working. Only enable after testing interactively first; background subagents auto-deny any permission they didn't get up front.
- **`hooks` in frontmatter** - scoped to the agent's lifecycle, cleaned up when it finishes. Cleaner than putting everything in `.claude/settings.json`.
- **`mcpServers` inline** - give the Researcher web/docs MCPs without polluting the parent conversation's context.

See `claude-code-integration.md` for the full schema and verified examples.

### When to NOT use the full team

If the blueprint is small (under ~10 APs, no external integrations, no team collaboration), the single KB Curator from the base integration is enough. The agent team's overhead (more files, more hooks, more potential for loops) only pays off on substantial blueprints.

---

## 4. Schema-as-code

The base skill has implicit rules ("every AP needs a Verification section") scattered across reference files. Schema-as-code makes them **explicit** and **enforceable**.

The right home for these rules in Claude Code is **`.claude/rules/blueprint-schema.md`** - a path-conditional rule file that Claude Code loads automatically via the `InstructionsLoaded` event when Claude accesses any file matching the `paths:` glob in the file's frontmatter. This means:

- The Linter doesn't need to "go fetch the rules" - they're already in its context the moment it touches `blueprint/`.
- The main agent and any other subagent that touches `blueprint/` also gets the rules automatically.
- The rules participate in the same loading lifecycle as `CLAUDE.md`, so they can be audited via the `InstructionsLoaded` event for telemetry.

The previous version of this file put rules in `blueprint/schema/rules.md` and required the Linter to read them explicitly. `.claude/rules/` is the documented Claude Code mechanism and removes the manual fetch step.

**File:** `.claude/rules/blueprint-schema.md`

```markdown
---
description: Schema rules for the bleu workspace. Loads whenever Claude accesses any file under blueprint/.
paths: ["blueprint/**"]
---

# Blueprint schema rules

This file is the authoritative ruleset the Linter enforces. Every rule has an
ID, a scope, an enforcement level, and a rationale. Rules are added via the
reflection loop (Linter proposes, Auditor approves, human steers).

## R-01: Every action point must have a Verification section
**Scope:** action-points/AP-*.md
**Level:** ERROR
**Check:** the file contains a heading "## Verification" with at least one
  checkbox or testable assertion underneath.
**Rationale:** an AP without verification is a wish, not a plan. See
  references/action-point-template.md.

## R-02: Every plan/03-components/*.md must have Failure Modes
**Scope:** plan/03-components/*.md
**Level:** ERROR
**Check:** the file contains a heading "## Failure modes" with non-empty content.
**Rationale:** silently failing components are the #1 cause of expected-vs-actual
  mismatches in production.

## R-03: Every research/*.md must cite at least one primary source
**Scope:** research/*.md
**Level:** ERROR
**Check:** the file contains a "## Sources" section with at least one entry that
  has both a title and a URL.
**Rationale:** uncited research is a hallucination risk. See
  references/research-and-citations.md.

## R-04: No file path may be referenced in an AP unless the file is named in
  plan/01-architecture.md or plan/03-components/
**Scope:** action-points/AP-*.md
**Level:** WARN
**Check:** every path in the AP's "Files involved" table resolves to either
  (a) an existing file, or (b) a file mentioned in the architecture/components
  files as planned.
**Rationale:** prevents APs from inventing paths that don't fit the architecture.

## R-05: Every component file must appear in index.md
**Scope:** plan/03-components/*.md
**Level:** ERROR
**Check:** index.md contains the file's relative path under the Components section.
**Rationale:** files not in the index are invisible to future sessions.
```

### How rules are enforced

The Linter checks each rule in `.claude/rules/blueprint-schema.md` against the wiki on every cycle. Rules are written in **prose**, not regex - the Linter is an LLM, it can interpret "the file contains a heading 'Verification' with at least one checkbox underneath" without you writing a parser. This is the symbolic/rule-based layer riding on top of the LLM's reasoning, rather than a traditional rule engine.

Two enforcement paths:

1. **Continuous enforcement (passive).** Because `paths: ["blueprint/**"]` makes Claude Code load the rules automatically whenever any file under `blueprint/` is accessed, every agent - main, curator, linter - has the rules in scope. This makes "the curator quietly violating R-02 because it forgot the rule exists" much less likely.
2. **Explicit lint pass (active).** The Linter agent walks the wiki and produces structured violation reports in `.reflection/proposals/` with `type: rule-violation`. ERROR-level violations block Phase 7 sign-off until resolved. WARN-level surface but don't block.

Rule violations land in `.reflection/proposals/` with the AP/file that violated the rule, the rule ID, and the suggested fix. The Auditor (agent hook) approves trivial fixes; non-trivial ones escalate to the user.

### How rules evolve

Rules are added through the reflection loop, not by hand. When the Reflector notices a recurring pattern in the wiki, it proposes a new rule. The Auditor reviews. If it escalates, the human approves the rule text. The rule lands in `.claude/rules/blueprint-schema.md` and starts being enforced on the next cycle.

This means the schema **co-evolves** with the wiki - which is the whole point. The human's editorial role shifts from writing wiki content to refining the rules that govern the wiki content.

### Symbolic ontology (optional)

For substantial blueprints, also maintain `.claude/rules/blueprint-ontology.md` listing the core concept types and their allowed relationships:

```markdown
# Ontology

## Types
- **Component** - a unit of system functionality with its own file in plan/03-components/
- **Entity** - a data object defined in plan/04-data-model.md
- **ActionPoint** - an executable unit of implementation work in action-points/
- **Service** - an external integration in plan/05-integrations.md
- **Research** - a cited research note in research/

## Allowed relationships
- Component MANAGES Entity
- Component CALLS Component
- Component CALLS Service
- ActionPoint IMPLEMENTS Component
- ActionPoint CREATES Entity
- ActionPoint DEPENDS_ON ActionPoint
- Research INFORMS Component
- Research INFORMS ActionPoint
```

This gives the graph (section 2A) a typed schema. Edges that don't match an allowed relationship become lint findings.

---

## 5. Multimodal ingest and derived outputs

Two halves: ingest of non-text materials, and generation of visual outputs.

### Ingest

When the user drops a PDF, image, or screenshot into `blueprint/raw/`, the Curator (or a dedicated Ingester subagent if the user wants finer separation) does the following:

- **Images** - uses vision capability to describe what's in them. Writes `raw/<image-name>.description.md` with a structured description, plus a copy of the image at `raw/<image-name>` so it remains viewable. The description includes any text the image contains (OCR-style), visible UI elements, and a paragraph of holistic interpretation.
- **PDFs** - extracts text page by page into `raw/<pdf-name>.text.md`. For PDFs with diagrams, also rasterizes the diagram pages and treats them as images per the rule above.
- **Screenshots of conversations / whiteboards / notebooks** - same as images, but the description format emphasizes "what's the user trying to communicate" over literal description.

All ingested materials are then candidate inputs for the Curator's compile mode - they become source material for plan/ and research/ files just like text inputs.

### Derived outputs

Generated visual artifacts live in `blueprint/derived/`. This includes:

- **Architecture diagrams** - mermaid or SVG generated from `plan/01-architecture.md` and the graph.
- **Dependency graphs** - mermaid generated from `action-points/README.md` and `.graph/graph.json`.
- **Pipeline diagrams** - one per pipeline in `plan/02-pipelines.md`.
- **Wiki health charts** - produced by the observability layer (section 6).

`blueprint/derived/` is fully regenerable. Treat it like a build artifact - it should be in `.gitignore` if the user is using git auto-commits, regenerated on demand or on a schedule.

### Why split derived from plan

Plan files are hand-curated (well - LLM-curated, human-steered). Derived files are mechanical outputs of plan files. Mixing them invites the failure mode where someone edits a derived file and then loses the edit on the next regeneration. Keeping them separate makes the derivation direction obvious.

---

## 6. Observability

The wiki grows. Without metrics, you don't know whether it's getting healthier or sicker. The observability layer surfaces this.

### Telemetry log

`blueprint/.telemetry/events.jsonl` - append-only log, one JSON line per event. Events:

```json
{"ts":"2026-04-07T14:32:00Z","event":"compile","agent":"curator","input":"raw/auth-notes.md","outputs":["plan/03-components/auth-service.md"],"tokens_in":4200,"tokens_out":1800}
{"ts":"2026-04-07T14:34:12Z","event":"lint","agent":"linter","findings":3,"errors":1,"warns":2}
{"ts":"2026-04-07T14:35:01Z","event":"audit","agent":"auditor","approved":2,"rejected":1,"escalated":0}
{"ts":"2026-04-07T14:40:00Z","event":"reflection-cycle","proposals":4,"approved":2,"rejected":1,"escalated":1}
```

Every agent writes a telemetry line at the end of its run. This is cheap and creates a complete audit trail.

### Wiki health score

A single number 0–100, computed from:

- **Coverage:** % of components with all required schema sections (R-01 through R-05).
- **Linkage:** % of entities mentioned in multiple files that are bidirectionally cross-linked.
- **Citation density:** % of plan claims that trace to a research file or codebase reference.
- **Lint debt:** ERROR-level violations open / total components. Inverted (more = worse).
- **Reflection freshness:** time since last reflection cycle. Decays over time.

`blueprint/.telemetry/health.md` is regenerated on every Curator cycle and contains:

```markdown
# Wiki health: 78 / 100

**Last updated:** 2026-04-07 14:40

| Metric | Score | Trend |
|---|---|---|
| Coverage | 92 | ↑ |
| Linkage | 65 | → |
| Citation density | 88 | ↑ |
| Lint debt | 70 | ↓ |
| Reflection freshness | 75 | → |

## What to fix first
1. Linkage is the weakest. The Reflector spotted 14 entity pairs that should be cross-linked but aren't. See .reflection/proposals/.
2. Lint debt has 3 open ERROR violations: AP-12 (no Verification), AP-19 (invented file path), plan/03-components/cache-layer.md (no Failure modes).

## Stats since last week
- Articles added: 12
- Articles edited: 31
- Tokens compiled: 84,000
- Lint fixes applied: 18
- Reflection cycles: 4
- Escalations resolved: 2
```

The user sees this on every `SessionStart` (via the hook), so they always know the state of the wiki.

### Insights

Beyond raw metrics, the Curator is asked to write a one-paragraph "what changed and what to focus on" insight at the bottom of `health.md` after each cycle. This is the LLM-generated summary that turns numbers into action.

---

## 7. External integrations

External integrations bring outside materials into `raw/` automatically. All of them are MCP servers (or scheduled scripts that write to `raw/`). Offer them as opt-in.

### MCPs worth offering

| MCP | What it does | Lands in |
|---|---|---|
| **Web search** | Fallback for the Researcher when its primary docs source doesn't have the answer | `raw/research/` |
| **GitHub** | Pulls PRs, issues, and discussions from a configured repo into `raw/` | `raw/github/` |
| **Linear / Jira** | Pulls tickets and project state into `raw/` | `raw/tickets/` |
| **Meeting notes** (e.g. Granola, Otter, Fireflies) | Pulls transcripts from recent meetings | `raw/meetings/` |
| **Filesystem (scoped)** | Already covered in `claude-code-integration.md` |
| **Git** | Already covered in `claude-code-integration.md` |

### Ingest pipeline

Each integration follows the same pattern:

1. **Pull** - the MCP (or a scheduled script) writes raw content to a subdirectory of `raw/`. Filenames include a timestamp and source ID.
2. **Detect** - the `FileChanged` hook on `raw/**` fires (regardless of whether an MCP server, a scheduled script, or Claude wrote the file).
3. **Compile** - the Curator picks up the new file, reads it, and decides whether it warrants a new plan/research entry, an update to an existing entry, or just sits in `raw/` as reference material.
4. **Cite** - anything the Curator carries into plan/ files cites the original raw source so the chain of evidence is preserved.

### What NOT to integrate

Don't integrate anything that takes destructive action (deploy, send messages, charge cards). The blueprint phase is read-heavy. Action-capable integrations belong in execution (Phase 7's handoff target), not planning.

Also: don't integrate sources the user can't legally or contractually feed to an LLM. The skill should ask before configuring any source that touches private company data, and remind the user that ingested content lands in their repo via git auto-commits.

---

## How to offer all of this

When the user asks for advanced capabilities (or you notice the blueprint is getting big enough to need them), surface a menu:

> "Beyond the base wiki, I can add:
>
> 1. **Reflection loop** - Linter proposes improvements, Auditor validates, schema co-evolves.
> 2. **Knowledge graph + episodic/semantic split** - derived graph layer, separate episodic memory from synthesized articles.
> 3. **Agent team** - Researcher / Curator / Linter / Auditor with locked tool whitelists.
> 4. **Schema-as-code** - explicit rules in `.claude/rules/blueprint-schema.md` enforced on every cycle.
> 5. **Multimodal ingest** - PDFs, images, screenshots get described and compiled.
> 6. **Observability** - wiki health score and telemetry log.
> 7. **External integrations** - MCPs for GitHub, Linear, meeting notes, web search.
>
> These layer on top of the base workspace. Pick any subset. I'll show you the files I'd add before writing them."

Each capability is independently useful. The user doesn't have to take all seven. The dependencies between them are minimal:

- Reflection loop benefits from schema-as-code (rules to enforce) but works without it.
- Schema-as-code benefits from the Linter agent but works as a hand-checked checklist without it.
- Agent team benefits from the hooks in `claude-code-integration.md` but works on demand without them.
- Knowledge graph benefits from the ontology in schema-as-code but works without it.
- Observability is independent - works alone.
- External integrations are independent - pick the ones the project actually needs.

The pattern: start with the base workflow, add the reflection loop and schema-as-code together, then add observability, then the agent team, then graph + episodic/semantic, then multimodal, then external integrations as the project demands them. That's the order of marginal value for most blueprints.

## Cross-references

- Hooks, base subagent (KB Curator), git auto-commits, base MCP setup → `claude-code-integration.md`
- Wiki layout and the markdown-KB pattern → `knowledge-base-pattern.md`
- Action point file format → `action-point-template.md`
- Research and citation rules → `research-and-citations.md`
- Handoff to GSD / Superpowers / Claude Code / AP list → `handoff-formats.md`
