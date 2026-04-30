# Structure Guide

How to lay out a skill so the agent loads only what it needs.

## The problem progressive disclosure solves

Every line in `SKILL.md` is read by the agent on every invocation, before it knows whether your skill is even relevant. A 1500-line `SKILL.md` costs tokens on every loader pass and crowds out other skills.

The fix: keep `SKILL.md` lean and push detail into reference files that the agent reads only when actually using the skill.

## The 100-line rule

`SKILL.md` should be **under 100 lines**. If yours is longer, split it.

### What stays in SKILL.md

- One-paragraph "why this exists" framing
- Quick-start example (the smallest working invocation)
- Workflow overview (numbered phases, checklists)
- Anti-pattern callouts
- Pointers to reference files

### What moves out of SKILL.md

| Content | Goes to |
|---|---|
| Long API reference tables | `REFERENCE.md` |
| Sample inputs/outputs, walkthroughs | `EXAMPLES.md` |
| Domain vocabulary, glossary | `LANGUAGE.md` or `CONTEXT.md` |
| File format specs | `*-FORMAT.md` (e.g. `ADR-FORMAT.md`) |
| Library-specific deep dives | `<topic>.md` (e.g. `mocking.md`, `interface-design.md`) |
| Repeated deterministic logic | `scripts/<helper>.<ext>` |

### Reference depth: one level only

```
✅ SKILL.md → REFERENCE.md
✅ SKILL.md → EXAMPLES.md
✅ SKILL.md → scripts/audit.sh

❌ SKILL.md → REFERENCE.md → DEEP-DIVE.md → APPENDIX.md
```

The model loses the thread when references chain. Flatten or merge instead.

## Directory layout

```
{category}/{skill-name}/
├── SKILL.md           # Required. Entry point.
├── REFERENCE.md       # Optional. Detailed docs.
├── EXAMPLES.md        # Optional. Walkthroughs.
├── *-FORMAT.md        # Optional. Format specs.
├── *-GUIDE.md         # Optional. Topic deep-dives.
├── scripts/           # Optional. Helpers.
│   └── helper.sh
├── templates/         # Optional. Boilerplate files.
└── assets/            # Optional. Static files.
```

Subdirectory naming: `kebab-case` for files, lowercase for directories.

## When to add a script

Add a script when **all three** are true:

1. **Deterministic operation** — same input always produces same output (validation, formatting, parsing, lookups).
2. **Repeated regeneration** — without the script, Claude would write the same code on every invocation.
3. **Explicit error handling** — natural-language reasoning about edge cases is unreliable here.

Examples that justify a script:

- `audit-skill.sh` — checks frontmatter, line count, trigger phrases
- `validate-yaml.py` — parses + validates frontmatter against a schema
- `convert-format.sh` — runs a fixed pipeline (pandoc, prettier, etc.)

Examples that **don't** justify a script — let Claude write the code in-context:

- One-off analysis ("count the components in this directory")
- Logic that depends heavily on the user's situation
- Anything where the prose explanation is shorter than the script

## When to use the Deletion Test

Borrowed from Matt Pocock's `improve-codebase-architecture` skill, applied to skill files:

> Imagine deleting this reference file. Does complexity vanish, or does it reappear in `SKILL.md` and bloat it past 100 lines?

If complexity vanishes → the file was a pass-through. Delete it.
If complexity reappears in `SKILL.md` → the file is earning its keep. Keep it.

## Anti-pattern: forcing structure where there isn't any

Some skills are genuinely small. A 30-line `SKILL.md` that does one thing well doesn't need `REFERENCE.md` or `EXAMPLES.md`. **Don't pad.**

Matt Pocock's `zoom-out` skill is 7 lines total. That's correct.

Add reference files when content **organically** exceeds 100 lines, not as a checkbox exercise.

## Anti-pattern: SKILL.md as a wiki

Symptom: SKILL.md has every API endpoint, every CLI flag, every config option, every error code. The agent has to re-parse it on every invocation.

Fix: keep SKILL.md focused on **what to do** and **when**. Move reference material to `REFERENCE.md`. The agent loads it on demand.

## Anti-pattern: redundant scripts

Symptom: a `scripts/run.sh` that wraps a single `npm test` invocation, or a `scripts/check.py` that re-implements `grep`.

Fix: prefer prose. Show the command in the SKILL.md. Scripts are for non-trivial deterministic logic, not aliasing.

## Pattern: phased workflow with checklists

For skills that walk the user through a process, use numbered phases with explicit checklists. This is the structure of `diagnose`, `tdd`, `improve-codebase-architecture`, etc.

```md
## Phase 1 — [Name]

[Goal of this phase]

Checklist:
- [ ] [Verification step 1]
- [ ] [Verification step 2]

Do not proceed to Phase 2 until [exit criterion].
```

This forces the agent to slow down and verify rather than racing to the end.

## Pattern: anti-pattern callouts

Throughout `SKILL.md` and `REFERENCE.md`, mark anti-patterns explicitly:

```md
❌ **Don't write all tests first, then all implementation.** This is "horizontal slicing" — tests written in bulk test imagined behavior, not actual behavior.

✅ **Vertical slices via tracer bullets.** One test → one implementation → repeat.
```

The contrast teaches more efficiently than positive examples alone.
