# Session persistence and resume protocol

> Treat every chat as stateless. Treat the workspace as the source of truth.
> When in doubt, persist more, not less.

## Why this matters

LLM chat sessions die. Context windows fill. The user runs `/clear`. Terminals crash. The model gets restarted between turns. None of this is exotic - it's the default. Anthropic's own Agent SDK docs are explicit on this point:

> "Don't rely on session resume. Capture the results you need (analysis output, decisions, file diffs) as application state and pass them into a fresh session's prompt. This is often more robust than shipping transcript files around." - `platform.claude.com/docs/en/agent-sdk/sessions`

The bleu skill already writes most of its work to disk, but disk-as-source-of-truth needs three more pieces to survive a `/clear`:

1. **A current-state pointer** - one file that tells a fresh Claude exactly where the project is right now, in 30 seconds of reading.
2. **An append-only history** - so a fresh Claude can see what happened, not just what exists.
3. **A decision log** - so architectural choices made in past sessions are first-class artifacts, not buried in chat scrollback.

This document specifies all three, plus the read order a resuming Claude must follow.

## The five files that make the workspace resumable

Added to the standard `blueprint/` layout:

```
blueprint/
├── SESSION.md           ← current snapshot (you are here)
├── NEXT.md              ← do this next
├── journal.md           ← append-only session history
├── decisions/
│   ├── README.md        ← ADR index
│   ├── ADR-001-<slug>.md
│   ├── ADR-002-<slug>.md
│   └── ...
├── index.md             ← (existing) file map with coverage tags
├── raw/
├── research/
├── plan/
└── action-points/
```

Each file has a strict shape and a strict update cadence. Strictness is the point: a resuming Claude must be able to trust the format.

---

## `SESSION.md` - current snapshot

**Purpose**: in 30 seconds of reading, a fresh Claude knows what phase the project is in, what was just done, what is blocked, and where to look next.

**Update cadence**: rewritten at the end of every session. Never appended. Always current.

**Length**: under 100 lines. If it's growing past that, content belongs in `journal.md` or `decisions/` instead.

### Template

```markdown
# SESSION - <project name>

> Last updated: <ISO timestamp>
> Current phase: <phase number and name>
> Status: <one of: in-progress | blocked | awaiting-user | complete>

## What was just done

<2-5 bullets describing the most recent completed work. Reference files by path.>

- Wrote `plan/01-architecture.md` with 6 grounded decisions
- Created `research/sqlite-as-queue.md` with 4 primary-source citations
- Updated `index.md` coverage tags

## What is blocked or waiting

<Bullets. If nothing is blocked, write "Nothing blocked.">

- Waiting on user answer to: "Is this tool meant to be shareable, or strictly personal?" (affects ADR-004 PyMuPDF/AGPL decision)

## Open questions for the user

<Bullets. Empty if none.>

- Confirm AP count target: ~12-15 or full ~38?
- OCR in scope for MVP, or post-MVP only?

## Where to read first on resume

<Ordered list of the 3-5 most relevant files for picking up the work.>

1. `NEXT.md` - concrete next actions
2. `plan/01-architecture.md` - current architectural shape
3. `decisions/README.md` - ADR index
4. `research/sqlite-as-queue.md` - most recent research

## Pointer to next action

→ See `NEXT.md`
```

---

## `NEXT.md` - concrete next actions

**Purpose**: imperative bullets a resuming Claude can execute immediately. No prose, no meta-commentary, no philosophy. Just "do these things."

**Update cadence**: rewritten at the end of every session. Always reflects what to do *next*, not what was just done.

**Length**: typically 5-15 bullets. If it's growing past 20, the project needs a new phase split.

### Template

```markdown
# NEXT - <project name>

> Updated: <ISO timestamp>
> If you are a fresh Claude resuming this project, do these in order.

## Immediate next steps

1. Read `SESSION.md` and `decisions/README.md` to confirm current state
2. Draft `plan/02-pipelines.md` covering: new-PDF flow, search flow, retry/DLQ flow
3. Each pipeline must reference at least one ADR by number for any architectural choice it touches
4. After drafting, run the lint protocol from SKILL.md against `02-pipelines.md`
5. Update `SESSION.md`, `NEXT.md`, and append a `journal.md` entry before ending the session

## Blocked / cannot proceed without

- ADR-004 (PyMuPDF vs pdftext) - needs user confirmation on shareability
- Phase 5 action point template - wait until pipelines are drafted

## Already done (do not redo)

- Phase 0 intake (`raw/intake.md`)
- Phase 1 research (`research/pdf-extraction.md`, `research/sqlite-as-queue.md`, ...)
- Phase 2 vision and architecture (`plan/00-vision.md`, `plan/01-architecture.md`)
```

The "Already done" section is critical. Without it, a resuming Claude will re-do completed work to "make sure" - a documented LLM failure mode.

---

## `journal.md` - append-only session history

**Purpose**: one entry per session, in chronological order. Lets a resuming Claude see *what changed* and *when* and *why*, not just *what exists*.

**Update cadence**: appended at the end of every session. **Never rewritten. Never edited.** Old entries stay exactly as written. This is the audit trail.

**Length**: unbounded, but each entry is short (10-30 lines).

### Entry template

```markdown
## Session 2026-04-08T14:30Z

**Goal**: Start Phase 2 - vision and architecture
**Outcome**: Vision file complete; architecture file complete with 6 grounded decisions

**Did**:
- Listed 7 architectural choices in `raw/phase2-prep.md`
- Ran 4 web searches → wrote 4 research files (concurrency, sqlite, watchdog, llm-client)
- Drafted `plan/00-vision.md` (6 non-goals, 5 measurable success criteria)
- Drafted `plan/01-architecture.md` (6 chosen, 17 rejected alternatives, ASCII diagram)
- Wrote ADR-001 through ADR-006 to `decisions/`
- Updated `index.md` with new coverage tags

**Decisions made this session**:
- ADR-001: pdftext as default extractor
- ADR-002: asyncio with separate ThreadPoolExecutor pools
- ADR-003: SQLite WAL mode as the work queue
- ADR-004: watchdog with on_created and PollingObserver fallback
- ADR-005: Anthropic SDK with max_retries=3, default Haiku 4.5
- ADR-006: Markdown files as the index (driven by user "greppable" requirement)

**Did not do** (deferred):
- `plan/02-pipelines.md` - next session
- Phases 3-7

**Blockers raised**:
- ADR-004 needs user confirmation on shareability

**Notes for next session**:
- The semaphore in ADR-002 is the rate-limit defense; SDK retry only handles transient errors, not sustained over-rate
- Watch out for Vim-style atomic writes in the watcher (use on_created not on_modified)
```

A resuming Claude can `tail -n 50 journal.md` and immediately see the last session's work. This is the canonical Microsoft Azure Well-Architected pattern: *"The ADR serves as an append-only log."* Same idea, applied to sessions instead of individual decisions.

---

## `decisions/` - append-only ADR log (MADR format)

**Purpose**: every architecturally significant decision gets one short, focused, sequentially-numbered file. The decision survives indefinitely. If a later decision overrides it, the old one stays and gets a `Superseded by ADR-NNN` status - never deleted.

**Update cadence**: a new ADR file per decision, written when the decision is made. Existing ADRs are only edited to update status (Proposed → Accepted → Deprecated → Superseded).

**Naming**: `ADR-NNN-short-slug.md`, sequential, three-digit zero-padded (`ADR-001-`, `ADR-002-`, ..., `ADR-099-`, `ADR-100-`).

**Format**: MADR (Markdown Any Decision Records) is the canonical lightweight template. Convergent across the ADR community (Joel Parker Henderson's repo, AWS Prescriptive Guidance, GDS Way, Microsoft Azure Well-Architected).

### Single ADR template

```markdown
# ADR-NNN: <Short title - the decision, not the problem>

**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-NNN
**Date**: <ISO date>
**Deciders**: <user name(s) or "user + claude">
**Phase**: <which blueprint phase this came from, e.g. "Phase 2 - architecture">

## Context

<Why is this decision needed? What problem is it solving? What constraints apply? Keep it to 3-8 sentences. Link to the relevant `research/<topic>.md` file.>

## Decision

<What did we decide? Be specific. One paragraph or a short list. Imperative if possible.>

## Alternatives considered

- **<Alternative 1>**: <one sentence on what it is and why we did not choose it>
- **<Alternative 2>**: <one sentence>
- **<Alternative 3>**: <one sentence>

## Consequences

**Positive**:
- <one or two bullets on what we gain>

**Negative**:
- <one or two bullets on what we accept>

**Neutral**:
- <follow-up work this implies, dependencies, things to monitor>

## Sources

- `@research/<topic>.md`
- <inline URLs if relevant>
```

### Worked example

```markdown
# ADR-003: SQLite in WAL mode as the work queue

**Status**: Accepted
**Date**: 2026-04-08
**Deciders**: user + claude
**Phase**: Phase 2 - architecture

## Context

The pdf-watch tool needs a durable work queue so a crash mid-batch doesn't lose work. The user explicitly named "recovery" as a success criterion in `plan/00-vision.md`. We need single-process, zero-daemon, crash-recoverable, queryable.

## Decision

Use a SQLite database at `~/.pdf-watch/queue.db` with `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL`, and `foreign_keys=ON`. Initialize via two-phase connection (autocommit bootstrap to set WAL, then app connection). Workers poll the queue table with backoff (no blocking get available in SQLite).

## Alternatives considered

- **Celery + Redis**: adds two daemons to manage on a laptop; violates the zero-daemons goal
- **Flat-file queue** (`pending/` and `done/` directories): atomic moves are portable but messy; no native retry counter; inspecting state requires `ls` and `cat`
- **In-memory queue** (`asyncio.Queue`): crash equals lost work; violates the recovery success criterion
- **Postgres**: heavier dependency; same overkill as Celery

## Consequences

**Positive**:
- Crash recovery is automatic - workers pick up incomplete rows on next start
- Inspectable with the `sqlite3` CLI for debugging
- One file, no daemon

**Negative**:
- WAL has a soft 100MB transaction ceiling; we must enqueue per-file rather than batching
- No blocking `get()` in SQLite; workers must poll with sleep+backoff (default 100ms)
- Python's `sqlite3` module requires two-phase init because journal mode cannot be set inside an open transaction

**Neutral**:
- Failure modes section of `plan/01-architecture.md` must mention `SQLITE_BUSY` recovery, the 100MB ceiling, and the Python autocommit gotcha so future maintainers don't trip on it

## Sources

- `@research/sqlite-as-queue.md`
- <https://sqlite.org/wal.html>
- <https://www.bugsink.com/blog/snappea-design/>
```

### `decisions/README.md` - the ADR index

Auto-maintained. Lists every ADR by number, title, status, and date. Updated whenever an ADR is added or its status changes.

```markdown
# Decision log - <project name>

> Append-only. Decisions live forever. Status changes when a decision is overridden.

| #   | Title                                              | Status     | Date       |
|-----|----------------------------------------------------|------------|------------|
| 001 | pdftext as default PDF extractor                   | Accepted   | 2026-04-08 |
| 002 | asyncio with separate ThreadPoolExecutor pools     | Accepted   | 2026-04-08 |
| 003 | SQLite in WAL mode as the work queue               | Accepted   | 2026-04-08 |
| 004 | watchdog with on_created and PollingObserver       | Accepted   | 2026-04-08 |
| 005 | Anthropic SDK with max_retries=3, default Haiku    | Accepted   | 2026-04-08 |
| 006 | Markdown files as the index format                 | Accepted   | 2026-04-08 |

## Status legend

- **Proposed** - under discussion, not yet committed
- **Accepted** - committed; the architecture file reflects this decision
- **Deprecated** - no longer applicable; kept for history
- **Superseded by ADR-NNN** - replaced by a later decision
```

### When to write an ADR (and when not to)

**Write an ADR when**: choosing a library, framework, or pattern; architectural decision with non-trivial tradeoffs; cross-cutting concern (security, perf, observability); reversal would be expensive; you can imagine future-you asking "why did we do that?"

**Don't write an ADR for**: trivial choices; implementation details; easily reversed decisions; standard practices that need no explanation; over-documenting wastes time.

Rule of thumb: **if Phase 2 architecture lists a "Chosen" alternative, that's probably an ADR.** Phase 2's `01-architecture.md` and the `decisions/` log should be in 1-to-1 correspondence for major choices.

---

## The resume protocol - read order

When Claude is invoked on a directory containing a `blueprint/` workspace, or when the user says "where did we leave off" or "continue this plan", Claude reads in this order. **No ad-hoc exploration.** No loading the entire `plan/` tree into context.

### Step 1: orient (always reads, always small)

1. `blueprint/SESSION.md` - current state, ~50 lines max
2. `blueprint/NEXT.md` - concrete next actions, ~30 lines max
3. `blueprint/index.md` - file map with coverage tags

After these three reads, Claude says one sentence to the user: *"You're in Phase 2 of the pdf-watch project. Last session ended after writing the architecture file and 6 ADRs. Next is `plan/02-pipelines.md`. Want me to start, or has anything changed since you last worked on this?"*

### Step 2: status check (always reads, still small)

4. `blueprint/decisions/README.md` - ADR index, status of every decision
5. `tail -n 80 blueprint/journal.md` - last 1-2 session entries

Now Claude knows: every decision and its status, what the last session actually did, what was deferred, what was blocked.

### Step 3: targeted depth (reads on demand)

6. Whatever specific files `NEXT.md` says to read for the next action.
7. Whatever `decisions/README.md` flags as relevant to the next action.
8. Whatever `index.md` marks `[L]` (low coverage - check the raw file) for the next action.

Crucially: do **not** load Phase 1 research files unless the next action involves research. Do **not** load `plan/00-vision.md` if you're doing Phase 5 action points and the vision is unchanged. Progressive disclosure all the way down.

### Step 4: confirm and proceed

Before writing anything, Claude restates the plan to the user: *"My understanding: I'm picking up from Phase 2, drafting `plan/02-pipelines.md` next, with three pipelines (new-PDF, search, retry/DLQ). I'll reference ADR-002 (asyncio model) and ADR-003 (SQLite queue) inside it. Anything to correct before I start?"*

This restatement is the proposer-validator separation applied to resumption: the validator (user) confirms the proposer (Claude) read the state correctly, before any new artifacts are written.

---

## What to write at the end of every session

Before the user runs `/clear` (or before the chat dies of natural causes), do this in order:

1. **Append a journal entry** - one entry per session, format above.
2. **Write any new ADRs** - for every architectural decision made this session. Update `decisions/README.md` index.
3. **Rewrite `SESSION.md`** - current state, current phase, what was just done, blockers.
4. **Rewrite `NEXT.md`** - imperative next actions for whoever (probably future-you) resumes.
5. **Update `index.md` coverage tags** if any file's coverage changed.
6. **Tell the user**: *"Workspace persisted. Safe to /clear. Resume by saying 'where did we leave off'."*

This is the "clean loop" pattern from Claude Code session-management best practices: *"work accumulates in the session, gets persisted to the file, the session resets, and the next session picks up from the file."*

---

## Hooking into Claude Code (optional but recommended)

If running inside Claude Code, the resume protocol can be hooked into `SessionStart` so it fires automatically on session start or resume:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [{
          "type": "command",
          "command": "test -f blueprint/SESSION.md && cat blueprint/SESSION.md && echo '---' && cat blueprint/NEXT.md"
        }]
      }
    ]
  }
}
```

Now every resumed session starts with `SESSION.md` and `NEXT.md` already in context. Zero manual setup, zero "uhh where were we." See `references/claude-code-integration.md` for the broader hook discussion.

---

## Common failure modes and how the protocol prevents them

| Failure mode | Prevention |
|---|---|
| Resuming Claude redoes Phase 1 research because it doesn't know it's done | `NEXT.md` "Already done" section + `journal.md` history |
| A decision made in session 1 gets silently re-litigated in session 3 | `decisions/` ADR with `Accepted` status - re-opening requires explicit `Superseded by` |
| User says "where were we" and Claude reads 30 files into context | Resume protocol forbids this; only 5 small files in Step 1+2 |
| Phase 2 architecture file no longer matches the actual decisions | ADR index status lifecycle catches this on the lint pass |
| Two parallel sessions diverge and neither knows about the other's work | Append-only `journal.md` makes divergence visible on next merge |
| The model writes a SESSION.md once and never updates it | The lint protocol step 6 (added to SKILL.md) checks SESSION.md timestamp against the most recent file modification in `blueprint/` |

---

## Anti-patterns to avoid

- **Storing state in chat history**. Chat dies. State must be on disk.
- **Putting current state in `journal.md`**. Journal is history; SESSION.md is current. Don't conflate them.
- **Editing old journal entries**. Append-only. If a previous entry was wrong, write a new entry that says so.
- **Skipping the ADR for "obvious" decisions**. The decisions that feel obvious now are the ones future-you will most need to understand.
- **Letting `NEXT.md` accumulate cruft**. NEXT is rewritten every session. If something belongs in long-term tracking, it goes in `index.md` or an open question in `plan/07-risks-open-questions.md`.
- **Treating SESSION.md as a diary**. SESSION.md is one paragraph of "where you are right now." Diary content goes in journal.md.
- **Trusting Claude Code's `--resume` instead of disk persistence**. Anthropic's own SDK docs say: don't. Persist to disk.

## What you get for the discipline

- A `/clear` is a non-event. You run it whenever context fills, with no anxiety.
- A new collaborator (or future-you in 6 months) can rehydrate the full plan in 5 minutes by reading SESSION.md → NEXT.md → recent ADRs.
- Decisions don't get re-litigated because they're first-class artifacts with status.
- The cost of context fragmentation drops to ~zero. You can work on a project across 20 sessions over 3 months without losing thread.
