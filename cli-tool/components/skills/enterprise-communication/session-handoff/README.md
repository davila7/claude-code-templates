# Session Handoff Skill

## Overview

The Session Handoff skill creates comprehensive handoff documents that enable fresh AI agents to seamlessly continue work with zero ambiguity. It solves the long-running agent context exhaustion problem by preserving complete context, decisions, and state across sessions.

## Purpose

When working on complex, multi-session projects with AI agents, context gets lost between sessions. This skill provides a structured approach to:

- **Preserve context** - Capture all critical information before context window fills
- **Enable continuity** - Allow new agents to pick up exactly where you left off
- **Document decisions** - Record architectural choices and their rationale
- **Track progress** - Maintain clear status of completed and pending work
- **Chain sessions** - Link related handoffs for long-running projects

## When to Use

### User-Triggered
- User says "save state", "create handoff", "I need to pause"
- User requests "load handoff", "resume from", "continue where we left off"
- User mentions "context is getting full" or "save this for later"

### Agent-Triggered (Proactive)
- Context window approaching capacity (>80% full)
- Major task milestone completed
- Work session ending with significant progress
- After substantial work (5+ file edits, complex debugging, architecture decisions)
- Before switching to a different task

### Resumption Scenarios
- Starting a new session on an existing project
- Different agent needs to continue the work
- Need to recall decisions made in previous sessions
- Picking up after a long break

## How It Works

The skill operates in two primary modes:

### CREATE Mode
Generates a comprehensive handoff document capturing current state:

1. **Generate Scaffold** - Smart script pre-fills metadata (timestamp, git status, modified files)
2. **Complete Document** - Fill in critical sections (state, context, decisions, next steps)
3. **Validate** - Automated checks for completeness, quality, and security
4. **Confirm** - Present location and summary to user

### RESUME Mode
Loads and validates existing handoff documents:

1. **Find Handoffs** - List available handoffs in project
2. **Check Staleness** - Assess if context is still current
3. **Load Document** - Read handoff (and chain if linked)
4. **Verify Context** - Validate assumptions and environment
5. **Begin Work** - Start from "Immediate Next Steps"

## Key Features

### Smart Scaffolding
The `create_handoff.py` script automatically captures:
- Timestamp and project path
- Current git branch and recent commits
- Modified and unstaged files
- Handoff chain links (if continuing from previous)

### Validation & Quality Assurance
The `validate_handoff.py` script checks:
- No incomplete `[TODO: ...]` placeholders
- All required sections populated
- No potential secrets (API keys, passwords, tokens)
- Referenced files exist
- Quality score (0-100)

### Staleness Detection
The `check_staleness.py` script assesses:
- Time elapsed since handoff creation
- Git commits made since handoff
- Files changed since handoff
- Branch divergence
- Missing referenced files

### Handoff Chaining
For long-running projects, chain handoffs together:
```
handoff-1.md (initial work)
    ↓
handoff-2.md --continues-from handoff-1.md
    ↓
handoff-3.md --continues-from handoff-2.md
```

Each handoff links to its predecessor, providing context breadcrumbs for new agents.

## Usage Examples

### Creating a Handoff

**Basic handoff creation:**
```bash
python scripts/create_handoff.py implementing-user-auth
```

**Continuation handoff (linked to previous):**
```bash
python scripts/create_handoff.py "auth-part-2" --continues-from 2024-01-15-auth.md
```

**Validate before finalizing:**
```bash
python scripts/validate_handoff.py .claude/handoffs/2024-01-15-143022-implementing-auth.md
```

### Resuming from a Handoff

**List available handoffs:**
```bash
python scripts/list_handoffs.py
```

**Check if handoff is current:**
```bash
python scripts/check_staleness.py .claude/handoffs/2024-01-15-143022-implementing-auth.md
```

**Load and continue work:**
1. Read the handoff document completely
2. Verify context using resume checklist
3. Start with first item in "Immediate Next Steps"

## Handoff Document Structure

A complete handoff includes:

1. **Metadata** - Timestamp, project path, git branch, commits
2. **Current State Summary** - What's happening right now
3. **Important Context** - Critical information for next agent
4. **Decisions Made** - Architectural choices with rationale
5. **Immediate Next Steps** - Clear, actionable first steps
6. **Pending Work** - Remaining tasks and priorities
7. **Critical Files** - Important locations and their purpose
8. **Key Patterns Discovered** - Conventions and approaches
9. **Potential Gotchas** - Known issues and workarounds
10. **Handoff Chain** - Links to previous/next handoffs

See [references/handoff-template.md](references/handoff-template.md) for the complete template.

## Storage Location

Handoffs are stored in: `.claude/handoffs/`

Naming convention: `YYYY-MM-DD-HHMMSS-[slug].md`

Example: `2024-01-15-143022-implementing-auth.md`

## Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `create_handoff.py` | Generate new handoff with smart scaffolding | `python scripts/create_handoff.py [slug] [--continues-from <file>]` |
| `list_handoffs.py` | List available handoffs in a project | `python scripts/list_handoffs.py [path]` |
| `validate_handoff.py` | Check completeness, quality, and security | `python scripts/validate_handoff.py <file>` |
| `check_staleness.py` | Assess if handoff context is still current | `python scripts/check_staleness.py <file>` |

## Quality Standards

**Do not finalize a handoff if:**
- Validation score is below 70
- Secrets are detected
- `[TODO: ...]` placeholders remain
- Required sections are empty

**Best practices:**
- Write clear, specific next steps (not vague goals)
- Document the "why" behind decisions, not just the "what"
- Include code snippets for critical patterns
- Reference specific file paths and line numbers
- Update handoffs as work progresses

## References

- [handoff-template.md](references/handoff-template.md) - Complete template structure with guidance
- [resume-checklist.md](references/resume-checklist.md) - Verification checklist for resuming agents
- [evals/model-expectations.md](evals/model-expectations.md) - Model behavior expectations
- [evals/test-scenarios.md](evals/test-scenarios.md) - Test cases for handoff creation and resumption

## Benefits

- **Zero ambiguity** - New agents know exactly what to do
- **Context preservation** - No loss of critical information
- **Decision history** - Understand why choices were made
- **Reduced onboarding** - Faster agent startup on existing work
- **Quality assurance** - Automated validation prevents incomplete handoffs
- **Security** - Secret detection prevents credential leaks
- **Long-term memory** - Handoff chains maintain project history
