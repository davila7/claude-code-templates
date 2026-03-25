# Agent MD Refactor

A Claude Code skill that transforms bloated agent instruction files into clean, organized documentation using progressive disclosure principles.

Based on https://x.com/mattpocockuk/status/2012906065856270504 (Matt Pocock's Prompt Idea)

## Purpose

Over time, agent instruction files like `CLAUDE.md`, `AGENTS.md`, or `COPILOT.md` tend to grow into unwieldy documents containing hundreds of lines of mixed instructions. This creates several problems:

- **Context waste**: Every task loads the entire file, even when most instructions are irrelevant
- **Maintenance burden**: Finding and updating specific instructions becomes difficult
- **Contradictions**: Conflicting guidelines accumulate without being noticed
- **Signal-to-noise ratio**: Important rules get buried among obvious or vague statements

This skill solves these problems by applying **progressive disclosure** - keeping only essential, universal instructions in the root file while organizing everything else into focused, linked documentation files.

## When to Use

Use this skill when you need to clean up agent instruction files. Common trigger phrases include:

- "refactor my AGENTS.md" / "refactor my CLAUDE.md"
- "split my agent instructions"
- "organize my CLAUDE.md file"
- "my AGENTS.md is too long"
- "progressive disclosure for my instructions"
- "clean up my agent config"

**Good candidates for refactoring:**

- Root agent files exceeding 50-100 lines
- Files mixing multiple unrelated topics (testing, code style, architecture, etc.)
- Documents that have grown organically without structure
- Files containing contradictory or redundant instructions

## How It Works

The skill follows a systematic 5-phase process:

### Phase 1: Find Contradictions

Before restructuring, the skill identifies conflicting instructions that need resolution. Examples include contradictory style guidelines ("use semicolons" vs "no semicolons") or incompatible workflow instructions. Each contradiction is surfaced with a question for the user to resolve.

### Phase 2: Identify the Essentials

Extracts only what truly belongs in the root file - information that applies to every single task:

| Keep in Root | Move Out |
|-------------|----------|
| One-sentence project description | Language-specific conventions |
| Non-standard package manager | Testing guidelines |
| Custom build/test commands | Code style details |
| Critical overrides | Framework patterns |
| Universal rules (100% of tasks) | Documentation standards |

### Phase 3: Group the Rest

Organizes remaining instructions into logical categories like:

- `typescript.md` - Type patterns, strict mode rules
- `testing.md` - Test frameworks, coverage, mocking
- `code-style.md` - Formatting, naming, structure
- `git-workflow.md` - Commits, branches, PRs
- `architecture.md` - Patterns, folder structure

### Phase 4: Create the File Structure

Generates the new file hierarchy with properly linked documentation:

```
project-root/
├── CLAUDE.md              # Minimal root with links
└── .claude/               # Categorized instructions
    ├── typescript.md
    ├── testing.md
    ├── code-style.md
    └── architecture.md
```

### Phase 5: Flag for Deletion

Identifies instructions that should be removed entirely:

- **Redundant**: "Use TypeScript" in a TypeScript project
- **Too vague**: "Write clean code" without specifics
- **Overly obvious**: "Don't introduce bugs"
- **Default behavior**: "Use descriptive variable names"
- **Outdated**: References to deprecated APIs

## Key Features

- **Contradiction detection**: Surfaces conflicting instructions before restructuring
- **Intelligent categorization**: Groups related instructions into logical files
- **Root file minimization**: Targets under 50 lines for the main file
- **Deletion recommendations**: Identifies instructions wasting context tokens
- **Template-driven output**: Consistent structure across all generated files
- **Link verification**: Ensures all references between files are valid

## Usage Examples

### Basic Refactoring

```
User: refactor my CLAUDE.md

Claude: I'll analyze your CLAUDE.md file and refactor it using progressive
disclosure principles...
```

### Specific File

```
User: my AGENTS.md is too long, can you split it up?

Claude: I'll review your AGENTS.md and organize it into focused, linked files...
```

### After a Project Grows

```
User: organize my agent config - it's gotten out of control

Claude: I'll apply the 5-phase refactoring process to clean up your
agent instructions...
```

## Output

After running the skill, you get:

**Minimal root file (~50 lines or less):**
```markdown
# Project Name

One-sentence description of the project.

## Quick Reference

- **Package Manager:** pnpm
- **Build:** `pnpm build`
- **Test:** `pnpm test`

## Detailed Instructions

- [TypeScript Conventions](.claude/typescript.md)
- [Testing Guidelines](.claude/testing.md)
- [Code Style](.claude/code-style.md)
```

**Organized linked files with consistent structure:**
```markdown
# Testing Guidelines

## Overview
Brief context for when these guidelines apply.

## Rules

### Unit Tests
- Specific, actionable instruction
- Another specific instruction

## Examples

### Good
[code example]

### Avoid
[code example]
```

**Deletion report:**
```markdown
## Flagged for Deletion

| Instruction | Reason |
|-------------|--------|
| "Write clean, maintainable code" | Too vague to be actionable |
| "Use TypeScript" | Redundant - project is already TS |
```

## Best Practices

### Before Refactoring

1. **Commit current state** - Have a clean git state so you can review changes
2. **Identify your goals** - Know what problems you want to solve
3. **Gather all instruction files** - Some projects have instructions scattered across multiple locations

### During Refactoring

1. **Resolve contradictions first** - Do not proceed until conflicts are addressed
2. **Be aggressive about root minimization** - When in doubt, move it out
3. **Aim for 3-8 linked files** - Not too granular, not too broad
4. **Delete liberally** - Vague instructions waste tokens without providing value

### After Refactoring

1. **Verify all links work** - Test that referenced files exist
2. **Check for lost instructions** - Ensure nothing important was dropped
3. **Test with real tasks** - Run a few typical tasks to verify the agent can find needed instructions

## Anti-Patterns to Avoid

| Avoid | Why | Instead |
|-------|-----|---------|
| Keeping everything in root | Bloated, hard to maintain | Split into linked files |
| Too many categories | Fragmentation, navigation overhead | Consolidate related topics |
| Vague instructions | Wastes tokens, no value | Be specific or delete |
| Duplicating defaults | Agent already knows | Only override when needed |
| Deep nesting | Hard to navigate | Flat structure with links |

## Verification Checklist

After refactoring, verify:

- [ ] Root file is under 50 lines
- [ ] Root contains ONLY universal information
- [ ] All links to sub-files work correctly
- [ ] No contradictions remain between files
- [ ] Every instruction is specific and actionable
- [ ] No instructions were lost (unless intentionally deleted)
- [ ] Each linked file is self-contained for its topic

## License

MIT
