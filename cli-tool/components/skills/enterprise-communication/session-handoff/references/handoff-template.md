# Handoff Template

Use this template structure when creating handoff documents. The smart scaffold script will pre-fill metadata sections; complete the remaining sections based on session context.

## Table of Contents

- [Session Metadata](#session-metadata)
- [Current State Summary](#current-state-summary)
- [Codebase Understanding](#codebase-understanding)
  - [Architecture Overview](#architecture-overview)
  - [Critical Files](#critical-files)
  - [Key Patterns Discovered](#key-patterns-discovered)
- [Work Completed](#work-completed)
  - [Tasks Finished](#tasks-finished)
  - [Files Modified](#files-modified)
  - [Decisions Made](#decisions-made)
- [Pending Work](#pending-work)
  - [Immediate Next Steps](#immediate-next-steps)
  - [Blockers/Open Questions](#blockersopen-questions)
  - [Deferred Items](#deferred-items)
- [Context for Resuming Agent](#context-for-resuming-agent)
  - [Important Context](#important-context)
  - [Assumptions Made](#assumptions-made)
  - [Potential Gotchas](#potential-gotchas)
- [Environment State](#environment-state)
- [Related Resources](#related-resources)
- [Template Usage Notes](#template-usage-notes)

---

# Handoff: [TASK_TITLE]

## Session Metadata
- Created: [TIMESTAMP]
- Project: [PROJECT_PATH]
- Branch: [GIT_BRANCH]
- Session duration: [APPROX_DURATION]

## Current State Summary

[One paragraph: What was being worked on, current status, and where things left off]

## Codebase Understanding

### Architecture Overview

[Key architectural insights discovered during this session - how the system is structured, main components, data flow]

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| path/to/file | What this file does | Why it matters for this task |

### Key Patterns Discovered

[Important patterns, conventions, or idioms found in this codebase that the next agent should follow]

## Work Completed

### Tasks Finished

- [x] Task 1 - brief description of what was done
- [x] Task 2 - brief description

### Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| path/to/file | Description of changes | Why this change was made |

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| Chose X over Y | X, Y, Z | Why X was chosen |

## Pending Work

### Immediate Next Steps

1. [Most critical next action - what to do first]
2. [Second priority]
3. [Third priority]

### Blockers/Open Questions

- [ ] Blocker: [description] - Needs: [what's required to unblock]
- [ ] Question: [unclear aspect] - Suggested: [potential resolution]

### Deferred Items

- Item 1 (deferred because: [reason, e.g., out of scope, needs user input])

## Context for Resuming Agent

### Important Context

[Critical information the next agent MUST know to continue effectively - this is the most important section for handoff]

### Assumptions Made

- Assumption 1: [what was assumed to be true]
- Assumption 2: [another assumption]

### Potential Gotchas

- [Things that might trip up a new agent - edge cases, quirks, non-obvious behavior]

## Environment State

### Tools/Services Used

- [Tool/Service]: [relevant configuration or state]

### Active Processes

- [Any background processes, dev servers, watchers that may be running]

### Environment Variables

- [Key env vars that matter for this work - DO NOT include secrets/values, just names]

## Related Resources

- [Link to relevant documentation]
- [Related file paths]
- [External resources consulted]

---

## Template Usage Notes

When filling this template:
1. Be specific and concrete - vague descriptions don't help the next agent
2. Include file paths with line numbers where relevant (e.g., `src/auth.ts:142`)
3. Prioritize the "Important Context" and "Immediate Next Steps" sections
4. Don't include sensitive data (API keys, passwords, tokens)
5. Focus on WHAT and WHY, not just WHAT - rationale is crucial for handoffs
