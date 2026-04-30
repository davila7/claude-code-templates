---
name: skill-authoring-best-practices
description: Pedagogical guide for writing high-quality Claude Code skills (SKILL.md files) using progressive disclosure, trigger-rich descriptions, and the 100-line rule. Use when writing or editing a SKILL.md frontmatter description, learning why a skill fails to auto-invoke, splitting an oversized SKILL.md into reference files, auditing a skill against a checklist, or applying Matt Pocock-style skill-authoring patterns.
---

# Skill Authoring Best Practices

A discipline for writing skills that auto-invoke reliably, stay maintainable, and respect the agent's context window.

## Why this skill exists

Two failure modes account for most broken skills: (1) the agent never picks the skill because the description lacks specific triggers, and (2) the skill bloats the context because everything lives in one `SKILL.md`. This skill fixes both.

## Quick start (creating a new skill)

```
cli-tool/components/skills/{category}/{skill-name}/
├── SKILL.md          # Required. Under 100 lines. Entry point only.
├── REFERENCE.md      # Optional. Detailed docs loaded on demand.
├── EXAMPLES.md       # Optional. Concrete usage patterns.
└── scripts/          # Optional. Deterministic helpers.
```

Minimal `SKILL.md`:

```md
---
name: skill-name
description: One sentence on what this does. Use when [specific triggers, keywords, file types].
---

# Skill Name

## Quick start
[Smallest working example]

## Workflow
[Numbered steps, checklists, anti-patterns]

## Advanced
See [REFERENCE.md](REFERENCE.md).
```

## The description field is everything

The description is the **only** signal the loader sees when deciding to surface this skill. Everything else is invisible until the skill is invoked.

**Format rules:**
- Max 1024 characters
- Third person, active voice
- First sentence: what it does (capability)
- Second sentence: `Use when [triggers]` — list real keywords, file types, contexts users mention

**✅ Good:** `Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when user mentions PDFs, forms, or document extraction.`

**❌ Bad:** `Helps with documents.`

The bad example gives the loader nothing to discriminate against other document skills. See [DESCRIPTION-GUIDE.md](DESCRIPTION-GUIDE.md) for ten before/after rewrites and the discrimination test.

## Keep SKILL.md under 100 lines

When `SKILL.md` exceeds ~100 lines, split it. Reference depth: one level only — `SKILL.md` → `REFERENCE.md` is fine; nested chains lose the model.

| Content type | Goes in |
|---|---|
| What it does + when to use | `SKILL.md` |
| Long reference tables, API specs | `REFERENCE.md` |
| Sample inputs/outputs, walkthroughs | `EXAMPLES.md` |
| Domain vocabulary | `LANGUAGE.md` |
| Step-by-step format specs | `*-FORMAT.md` |
| Deterministic helpers | `scripts/` |

See [STRUCTURE-GUIDE.md](STRUCTURE-GUIDE.md) for the deletion test, when to add scripts, and progressive-disclosure rules.

## Workflow: review an existing skill

```bash
bash scripts/audit-skill.sh path/to/SKILL.md
```

Then walk [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md). Most common failures: missing `Use when` trigger, SKILL.md over 100 lines, first-person voice, time-sensitive content, nested reference chains.

## Top anti-patterns

❌ **Generic description** — `"Helps with code"`. Loader can't discriminate.
❌ **First-person voice** — `"I help you..."`. Rewrite as `Use when ...`.
❌ **One giant SKILL.md** — every reference table dumped into the entry point.
❌ **Nested references** — `SKILL.md → A.md → B.md → C.md`. Stop at one level.
❌ **Time-sensitive** — `"latest version is 3.2"` rots within months.

Full anti-pattern catalog: [STRUCTURE-GUIDE.md](STRUCTURE-GUIDE.md) and [DESCRIPTION-GUIDE.md](DESCRIPTION-GUIDE.md).

## Reference files

- [DESCRIPTION-GUIDE.md](DESCRIPTION-GUIDE.md) — Writing trigger-rich descriptions, ten rewrite examples
- [STRUCTURE-GUIDE.md](STRUCTURE-GUIDE.md) — When to split, when to add scripts, progressive disclosure
- [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md) — Full auditable checklist
- [scripts/audit-skill.sh](scripts/audit-skill.sh) — Mechanical lint pass for any SKILL.md
