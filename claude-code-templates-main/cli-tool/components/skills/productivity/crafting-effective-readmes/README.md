# Crafting Effective READMEs

A skill for Claude Code that helps you write, update, and improve README files tailored to your specific project type and audience.

## Purpose

Not all READMEs are the same. An open-source library needs different documentation than a personal project or an internal tool. This skill provides:

- **Audience-aware guidance** - Different readers need different information
- **Project-type templates** - Ready-to-use structures for OSS, personal, internal, and config projects
- **Task-specific workflows** - Whether creating, updating, adding to, or reviewing READMEs
- **Quality checks** - Style guidance and section checklists to avoid common mistakes

## When to Use

Use this skill when you need to:

- Create a README for a new project
- Add a new section to an existing README
- Update stale documentation after changes
- Review and refresh README content
- Choose the right sections for your project type

**Trigger phrases:**

- "Write a README for this project"
- "Help me document this"
- "Create documentation for..."
- "Update the README"
- "Review my README"
- "What sections should my README have?"

## How It Works

The skill follows a three-step process:

### Step 1: Identify the Task

The skill determines what README task you are working on:

| Task | When to Use |
|------|-------------|
| **Creating** | New project with no README yet |
| **Adding** | Need to document something new in existing README |
| **Updating** | Capabilities changed, content is stale |
| **Reviewing** | Checking if README is still accurate |

### Step 2: Gather Context

Based on the task, the skill asks targeted questions:

- **Creating**: What type of project? What problem does it solve? What is the quickest path to "it works"?
- **Adding**: What needs documenting? Where should it go? Who needs this info most?
- **Updating**: What changed? Which sections are stale?
- **Reviewing**: Compares README against actual project state (package.json, main files, etc.)

### Step 3: Generate and Refine

The skill uses the appropriate template and follows up with: "Anything else to highlight or include that I might have missed?"

## Key Features

### Project Type Templates

| Type | Audience | Template |
|------|----------|----------|
| **Open Source** | Contributors, users worldwide | `templates/oss.md` |
| **Personal** | Future you, portfolio viewers | `templates/personal.md` |
| **Internal** | Teammates, new hires | `templates/internal.md` |
| **Config** | Future you (confused) | `templates/xdg-config.md` |

### Section Checklist by Project Type

| Section | OSS | Personal | Internal | Config |
|---------|-----|----------|----------|--------|
| Name/Description | Yes | Yes | Yes | Yes |
| Badges | Yes | Optional | No | No |
| Installation | Yes | Yes | Yes | No |
| Usage/Examples | Yes | Yes | Yes | Brief |
| What's Here | No | No | No | Yes |
| How to Extend | No | No | Optional | Yes |
| Contributing | Yes | Optional | Yes | No |
| License | Yes | Optional | No | No |
| Architecture | Optional | No | Yes | No |
| Gotchas/Notes | Optional | Optional | Yes | Yes |
| Last Reviewed | No | No | Optional | Yes |

### Reference Materials

The skill includes curated reference materials for deeper understanding:

- **art-of-readme.md** - Philosophy behind great READMEs, cognitive funneling
- **make-a-readme.md** - Practical, section-by-section guidance
- **standard-readme-spec.md** - Formal specification for OSS consistency

## Usage Examples

### Creating a New README

```
User: I need a README for my new CLI tool

Claude: What type of project is this - open source, personal, or internal?

User: Open source, it's a Node.js package

Claude: [Uses OSS template, asks about installation, usage, and contributing]
```

### Updating an Existing README

```
User: Update my README, I added a new feature

Claude: [Reads current README, identifies where to add the new feature,
        proposes specific edits]
```

### Reviewing for Accuracy

```
User: Check if my README is still accurate

Claude: [Compares README against package.json, main files, etc.
        Flags outdated sections and suggests updates]
```

## Best Practices

1. **Always ask about audience** - Don't assume OSS defaults for everything
2. **Show, don't just tell** - Include examples and code samples
3. **Use structure** - Headers, tables, and lists improve scannability
4. **Keep it current** - Add "last reviewed" dates for internal/config projects
5. **Include installation steps** - Never assume setup is obvious
6. **Write for YOUR audience** - Avoid generic tone

## Common Mistakes to Avoid

- No installation steps (never assume setup is obvious)
- No examples (show, don't just tell)
- Wall of text (use headers, tables, lists)
- Stale content (add "last reviewed" date)
- Generic tone (write for YOUR audience)

## Essential Sections (All Types)

Every README needs at minimum:

1. **Name** - Self-explanatory title
2. **Description** - What + why in 1-2 sentences
3. **Usage** - How to use it (examples help)

## Directory Structure

```
crafting-effective-readmes/
  SKILL.md                 # Skill definition
  section-checklist.md     # Quick reference for sections by project type
  style-guide.md           # Common mistakes and prose guidance
  using-references.md      # Guide to reference materials
  templates/
    oss.md                 # Open source project template
    personal.md            # Personal/portfolio project template
    internal.md            # Internal/team project template
    xdg-config.md          # Configuration directory template
  references/
    art-of-readme.md       # README philosophy
    make-a-readme.md       # Section-by-section guidance
    standard-readme-spec.md        # Formal specification
    standard-readme-example-minimal.md  # Minimal compliant example
    standard-readme-example-maximal.md  # Full-featured example
```

## Related Skills

- `writing-clearly-and-concisely` - For general prose quality, clear writing, and avoiding AI patterns
