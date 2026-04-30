# Review Checklist

Mechanical pass for any skill before merging or publishing. Run through every box. If a box doesn't apply, mark it `n/a` rather than skipping.

## Frontmatter

- [ ] `name` field present, kebab-case
- [ ] `name` matches the directory name exactly
- [ ] `description` field present and non-empty
- [ ] Description first sentence describes a **capability**, not a category
- [ ] Description contains the phrase `Use when` followed by **specific** triggers
- [ ] Description triggers include verbatim user phrases, file types, or domain keywords
- [ ] Description is under 1024 characters
- [ ] Description is third-person, active voice (no "I" or "this skill should be used by me")
- [ ] No time-sensitive content ("as of 2024", "currently", "latest version is...")
- [ ] If the skill is slash-only, `disable-model-invocation: true` is set

## SKILL.md body

- [ ] Under 100 lines (or content has been split into reference files)
- [ ] Opens with a one-paragraph "why this exists" framing
- [ ] Has a `Quick start` or equivalent minimal example
- [ ] Has a `Workflow` section with numbered phases or checklists
- [ ] Includes at least one concrete example (not just theory)
- [ ] Anti-patterns called out with ❌ / ✅ contrast
- [ ] Vocabulary is consistent — no synonym drift between sections
- [ ] References to other files are exactly **one level deep** (no nested chains)

## Files and structure

- [ ] Reference files use clear `*-GUIDE.md`, `*-FORMAT.md`, or descriptive `<topic>.md` names
- [ ] `scripts/` only contains scripts that pass the deterministic-and-repeated test
- [ ] Scripts have proper shebangs (`#!/usr/bin/env bash`, `#!/usr/bin/env python3`)
- [ ] Scripts are executable (`chmod +x`) if intended to be run directly
- [ ] No empty placeholder files (`TODO.md`, empty `EXAMPLES.md`)

## Security and paths

- [ ] No hardcoded API keys, tokens, passwords, or secrets
- [ ] No absolute paths (`/Users/...`, `/home/...`, `C:\...`)
- [ ] All paths are relative or use `$CLAUDE_PROJECT_DIR`
- [ ] If credentials are needed, the skill explains how to load them from `process.env` / `os.environ`
- [ ] No private internal URLs, project IDs, or org IDs hardcoded

## Naming conventions

- [ ] Directory name is kebab-case
- [ ] All file names are kebab-case (or `SCREAMING-CASE.md` for top-level reference files)
- [ ] Frontmatter `name` matches directory name
- [ ] Skill is in the correct category (`development/`, `productivity/`, `scientific/`, etc.)

## Content quality

- [ ] Examples use real-world inputs, not `foo`/`bar`/`baz`
- [ ] Code blocks specify the language (` ```bash`, ` ```typescript`)
- [ ] Tables format correctly (header row + separator)
- [ ] No broken markdown (mismatched code fences, dangling list items)
- [ ] Internal links use relative paths (`[REFERENCE.md](REFERENCE.md)`)

## Triggering test (manual)

Pick three phrases a user would realistically say to invoke this skill. For each:

- [ ] The skill description contains that phrase or a close variant
- [ ] The phrase is specific enough that a different skill would not also match it
- [ ] If a sibling skill also matches, sharpen the description to discriminate

## Catalog regeneration (claude-code-templates project only)

These steps apply only when contributing skills to this repository. If you are using this checklist for a skill in your own project, skip this section.

After any change:

- [ ] `python scripts/generate_components_json.py` runs without errors
- [ ] `docs/components.json` is regenerated
- [ ] `dashboard/public/components.json` is updated if shipping to the dashboard

## Component reviewer pass

- [ ] Run the `component-reviewer` agent on the skill directory
- [ ] All ❌ Critical Issues from the reviewer are resolved
- [ ] ⚠️ Warnings are resolved or explicitly acknowledged
- [ ] 📋 Suggestions are considered
