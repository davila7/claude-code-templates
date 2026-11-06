---
name: harness-optimization
description: Audit and refactor Claude Code project configuration. Analyzes CLAUDE.md, rules, skills, hooks, subagents, permissions, MCP, and auto memory, then refactors each item to the most appropriate primitive using the latest Claude Code docs.
license: MIT
---

# Harness Optimization

Audit the current project's Claude Code configuration and refactor every piece of setup
to use the most appropriate primitive. Fetches the latest official docs before analyzing
so the output reflects current features — not just training data.

---

## Triggers

Use this skill when:
- "optimize my claude code setup" / "audit my harness"
- "refactor my CLAUDE.md" / "review my hooks / skills / agents"
- "am I using the right primitives?"
- "my CLAUDE.md is too long"
- "harness optimization" / "/harness_optimization"

---

## Quick Reference

| Phase | Action | Output |
|---|---|---|
| 1. Fetch docs | Load latest Claude Code docs via Context7 | List of current features + deprecated items |
| 2. Discover | Scan all config files and directories | Inventory of every config item |
| 3. Analyze | Semantic reasoning about each item | Anti-pattern findings |
| 4. Report | Prioritized findings with migration paths | CRITICAL / WARNING / INFO list |
| 5. Implement | Apply approved changes | Refactored config files |

---

## Phase 1 — Fetch Latest Docs

Before any analysis, load current Claude Code documentation so findings reflect
features added or deprecated since training cutoff.

Use Context7 to query:
- hooks (events, types, exit codes, JSON output)
- skills / slash commands (frontmatter fields, `context: fork`, `allowed-tools`)
- sub-agents / agents (AGENT.md format, built-in types)
- settings (scopes, all fields, sandbox)
- permissions (allow/deny/ask syntax, wildcards)
- memory and CLAUDE.md (`rules/`, auto memory, `@imports`, `paths:` frontmatter)
- MCP servers (configuration, permission rules)

Note anything new (post August 2025) and anything deprecated.

---

## Phase 2 — Discover All Configuration

Scan these locations (skip if not present):

**Instructions & rules**
- `CLAUDE.md`, `.claude/CLAUDE.md` (project-level)
- `~/.claude/CLAUDE.md` (user-level)
- `.claude/CLAUDE.local.md` (local overrides)
- `.claude/rules/**/*.md` (path-specific rules)

**Settings & enforcement**
- `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json`
- Extract: `hooks`, `permissions`, `sandbox`, `mcpServers`, `autoMode`

**Skills & agents**
- `.claude/skills/*/SKILL.md` and `~/.claude/skills/*/SKILL.md`
- `.claude/agents/*/AGENT.md` and `~/.claude/agents/*/AGENT.md`

**Memory**
- `~/.claude/projects/<project-hash>/memory/MEMORY.md`

---

## Phase 3 — Semantic Analysis

Reason about the **intent and nature** of each config item — not surface keywords.
A plain instruction like "always check for secrets" logically requires a Hook even
without the word "automatic."

**Decision criteria:**

- **Hook** — fires automatically in response to an event (tool call, file save,
  session start, etc.). Ask: *"Would this run without anyone invoking it?"*
  Examples: lint before commit, warn on secret file access, format on save

- **Skill** — multi-step workflow requiring explicit invocation.
  Examples: create PR, run deployment, generate report

- **Subagent** — needs context isolation, restricted tool access, or specialized role.
  Examples: codebase exploration, security audit, read-only investigation

- **CLAUDE.md** — constant, session-wide guidance that applies unconditionally.
  Keep under 200 lines; split into `.claude/rules/` if larger.

- **`.claude/rules/` file** — rules that apply only to specific file types or paths.
  Use `paths:` frontmatter for conditional loading (token efficiency).

- **Permissions** — baseline tool access control in `settings.json`.

- **MCP server** — external system integration (GitHub, Slack, databases, APIs).

### Anti-Patterns to Detect

| Pattern | Issue | Fix |
|---|---|---|
| Step-by-step procedure in CLAUDE.md | Not reusable, bloats context | Extract to Skill |
| Event-triggered behavior in CLAUDE.md | Soft only, often ignored | Move to Hook |
| Side-effect Skill without `disable-model-invocation: true` | Invoked accidentally | Add flag |
| Exploration Skill without `context: fork` | Pollutes main conversation | Add `context: fork` |
| Critical rule only in CLAUDE.md with no Hook | Not enforced | Add PreToolUse hook |
| CLAUDE.md over 200 lines | Token waste, low adherence | Split to rules/ |
| All rules globally loaded regardless of file type | Token waste | Path-specific rules/ |
| Duplicate config across scopes | Maintenance burden | Consolidate |
| Deprecated feature in use | May break in future | Replace per docs |

### Proactive Suggestions

Raise these even when absent from current config:
- No hooks → suggest high-value patterns: secret-file warning, dangerous command guard, formatter
- Broad `allow: ["Bash(*)"]` with no `deny` → propose deny rules for `rm -rf`, force push, etc.
- No subagents → identify tasks that benefit from context isolation
- New doc feature unused but applicable → propose with rationale
- Auto memory disabled where dynamic learning would help → suggest enabling

---

## Phase 4 — Output Analysis Report

Group by priority. Format each finding as:

```
[PRIORITY] Location: <file and section>
Current: <what it is now>
Issue: <why this is suboptimal>
Suggestion: <which primitive / what change>
Migration: <exact steps to implement>
```

**CRITICAL** — wrong primitive causing real risk (accidental side-effect invocation,
no enforcement on sensitive operations, deprecated breaking feature)

**WARNING** — suboptimal but not immediately harmful (bloated CLAUDE.md, missing fork,
soft-only critical rules)

**INFO** — new feature opportunity, token efficiency, quality-of-life improvement

Close with a **Summary**: total findings by priority, top 3 highest-impact changes,
number of files affected.

---

## Phase 5 — Implement

1. Present the full Phase 4 report.
2. Ask the user which changes to apply.
3. Do not modify any file before receiving explicit approval.
4. Apply changes one item at a time: CRITICAL → WARNING → INFO.
5. After each file change, verify result is valid (no broken frontmatter, valid JSON).
6. When extracting a Skill from CLAUDE.md: create the new skill file, then remove only the migrated section from CLAUDE.md — do not delete or overwrite the rest of the file.
7. After all changes, re-scan to confirm no new anti-patterns were introduced.

---

## Soft vs Hard Enforcement Reference

| Approach | Primitive | Reliability |
|---|---|---|
| "Please do X" in CLAUDE.md | CLAUDE.md | Soft — Claude may skip under pressure |
| Rule for specific files | `.claude/rules/` with `paths:` | Soft — path-scoped |
| Block before execution | Hook (PreToolUse, exit 2) | Hard — always enforced |
| Deny tool access | Permissions `deny` | Hard — permission system |
| Isolate process | Sandbox | Hard — OS-level |

If it must **never** be violated, use a Hook or Permissions rule — not CLAUDE.md.
