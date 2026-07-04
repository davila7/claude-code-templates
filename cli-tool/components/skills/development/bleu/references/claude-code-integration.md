# Claude Code Integration

This file is read when the user is running the skill inside **Claude Code** and wants the blueprint workspace to be a living, automated system rather than a folder of markdown files.

**Verified against the live Claude Code docs.** The canonical sources are below - re-fetch them before generating any settings/agent files, because the schema evolves:

- Hooks reference: https://code.claude.com/docs/en/hooks
- Subagents: https://code.claude.com/docs/en/sub-agents
- Settings: https://code.claude.com/docs/en/settings
- Permissions: https://code.claude.com/docs/en/permissions
- MCP: https://code.claude.com/docs/en/mcp
- Skills: https://code.claude.com/docs/en/skills

If the user asks Claude Code itself "how do I configure X", the canonical built-in answer comes from the **`claude-code-guide`** subagent (Haiku, read-only), which Claude Code spawns automatically for documentation questions. Trust that subagent over memory.

## Detecting Claude Code

Indicators: a `.claude/` directory exists, a `CLAUDE.md` is present, the user's prompt mentions Claude Code, or environment variables prefixed `CLAUDE_*` are set. Run `/agents` and `/hooks` to verify what's already configured. In any other surface, skip this entire file - the base skill works fine on plain markdown.

## What's available

Claude Code gives you four mechanisms to make the blueprint workspace automated:

1. **Hooks** - shell commands, HTTP endpoints, **prompt-LLM** evaluations, or **agent** verifications that fire on lifecycle events.
2. **Subagents** - isolated context windows with locked tool whitelists, optional inline MCP servers, optional persistent memory, optional worktree isolation, and their own hooks scoped to their lifecycle.
3. **MCP servers** - capability surfaces, scoped per-subagent or globally.
4. **Settings hierarchy** - `~/.claude/settings.json` (user), `.claude/settings.json` (project, checked in), `.claude/settings.local.json` (project, gitignored), plus managed policy.

Plus three things that show up in the blueprint workspace specifically:

5. **`CLAUDE.md`** - persistent project rules. The blueprint's reading-order pointer goes here so every session starts oriented.
6. **`.claude/rules/*.md`** - conditional rule files that load via the `InstructionsLoaded` event. This is where schema-as-code rules live (see `advanced-architecture.md`).
7. **`/agents` and `/hooks`** - read-only browsers for what's currently configured. Tell the user about these once.

## Always offer the menu before installing

Surface the integrations as an explicit menu and show every file you'd create **before** writing any of them. `.claude/` files are executable configuration that gets committed and shipped to teammates - they belong in code review.

Example menu:

> "I'm running in Claude Code. I can wire the blueprint workspace with:
>
> 1. **KB Curator subagent** - owns the wiki's health, with hooks scoped to its own lifecycle. No global settings changes.
> 2. **`FileChanged` hook** - fires when files in `blueprint/raw/` change on disk (from any source - Claude, MCP servers, external scripts). Triggers compile.
> 3. **`SessionStart` hook** - loads `blueprint/index.md` and `blueprint/.telemetry/health.md` into context on every session.
> 4. **`Stop`/`SubagentStop` hook** - git auto-commit, scoped to `blueprint/`.
> 5. **`PreCompact` hook** - backs up the transcript before context compaction.
> 6. **Optional MCP servers** - scoped inline to the Curator (filesystem, git, docs-fetch).
>
> Want all six, some, or none? I'll show you the files first."

## 1. The KB Curator subagent

`.claude/agents/kb-curator.md`. Hooks live **in this file's frontmatter** - that's the modern pattern. Settings file changes are unnecessary.

```markdown
---
name: kb-curator
description: |
  Maintains the bleu wiki under blueprint/. Use proactively after
  files land in blueprint/raw/, after edits to plan/ or action-points/, or
  whenever the index needs rebuilding. Operates in three modes: compile, lint,
  index.
tools: Read, Write, Edit, Glob, Grep
model: sonnet
memory: project
skills:
  - bleu
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          if: "Write(blueprint/**)"
          command: "exit 0"
  Stop:
    - hooks:
        - type: command
          command: "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/curator-finalize.sh"
---

You are the KB Curator for a bleu workspace. Your job is to keep
the markdown wiki under blueprint/ coherent, navigable, and auditable.

You do not write code. You do not modify anything outside blueprint/. You do
not make architectural decisions on your own - you surface them for the user.

## The workspace
Layout is documented in the bleu skill (preloaded above). Read
references/knowledge-base-pattern.md for the conventions before acting.

## Your three modes

### Compile
Triggered when a new file lands in blueprint/raw/. Read it, decide which plan
files it affects (or whether it warrants a new component / research file),
write or update those files, and update blueprint/index.md. If the raw file
contradicts existing plan content, do NOT silently overwrite - write a note
in plan/07-risks-open-questions.md and flag it for the user.

### Lint
Triggered after edits to plan/ or action-points/, or on demand. Walk the
wiki and look for: dangling references, contradictions, stale index entries,
untraceable claims, action points that depend on undefined work. Write
findings to blueprint/.reflection/proposals/ for the Auditor to validate.
Do not fix high-severity items yourself - surface them.

### Index
Rebuild blueprint/index.md from the current state. One line per file:
relative path, dash, one-sentence summary. Group by section.

## Memory
Your memory directory is at .claude/agent-memory/kb-curator/. The MEMORY.md
file there is auto-loaded into your prompt at startup (first 200 lines or
25KB). Use it to accumulate institutional knowledge about this specific
blueprint: naming conventions, recurring contradictions, the user's
preferences. Update it after each significant cycle.

## Hard rules
- Never write outside blueprint/.
- Never modify code files.
- Never delete a plan file without surfacing the deletion first.
- Cite research files when you carry their conclusions into plan files.
- If you're about to make an architectural decision, stop and surface it.
```

### Why each frontmatter field

- **`tools`** - explicit whitelist. Without this, the curator inherits *every* tool from the parent, including all MCP tools. The whitelist is the security boundary.
- **`memory: project`** - Claude Code provides a persistent directory at `.claude/agent-memory/kb-curator/` that survives across conversations. The first 200 lines / 25 KB of `MEMORY.md` is auto-injected into the curator's prompt at startup, and Read/Write/Edit are auto-enabled so it can manage the file. This is a built-in feature - no hand-rolled "notes" pattern needed. Use `user` scope for cross-project learnings, `local` for gitignored personal notes.
- **`skills: [bleu]`** - preloads the entire bleu skill content into the curator's context at startup. Subagents don't inherit skills from the parent, so this must be explicit. The curator now knows the workspace conventions without having to discover them.
- **`hooks` in frontmatter** - scoped to the curator's lifecycle. When the curator finishes, the hooks are cleaned up. No pollution of project-wide settings. `Stop` hooks defined here are automatically converted to `SubagentStop` at runtime.
- **`if: "Write(blueprint/**)"`** - uses [permission rule syntax](https://code.claude.com/docs/en/permissions) to filter on tool input declaratively. The hook only spawns when the write target matches the pattern. Cleaner than path-checking shell logic.

### Alternative: `disallowedTools` instead of whitelist

If you want the curator to inherit most tools but block writes outside `blueprint/`, use `disallowedTools` instead:

```yaml
disallowedTools: WebFetch, WebSearch, Bash
```

Both `tools` and `disallowedTools` can coexist; `disallowedTools` is applied first, then `tools` is resolved against the remaining pool.

### Optional: isolation in a git worktree

For destructive lint passes (e.g., experimental large-scale refactor of the wiki), add `isolation: worktree` to the curator's frontmatter. Claude Code spawns it in an isolated git worktree, and if it makes no changes the worktree auto-cleans. Useful when you want a "what would the lint do if I let it loose" preview.

### Optional: always run in background

Add `background: true` to the curator's frontmatter to make Claude always spawn it as a background task. The user keeps working in the main conversation while the curator compiles in parallel. **Caveat**: background subagents auto-deny any permission they didn't get up front - Claude Code prompts for the full set before launch. Test interactively first.

## 2. Hook events worth using for the blueprint workspace

| Event | Why it matters here | Notes |
|---|---|---|
| `SessionStart` | Load `blueprint/index.md` and `.telemetry/health.md` into context. Matchers: `startup`, `resume`, `clear`, `compact` - usually only fire on `startup\|resume`. | Stdout from the script is added to context. Only `command` hooks supported. |
| `FileChanged` | Auto-compile when `blueprint/raw/` changes. Fires regardless of who wrote (Claude, MCP server, external script). The matcher is **basename only** - filter further inside the script. | Has access to `CLAUDE_ENV_FILE`. No decision control. |
| `Stop` / `SubagentStop` | Git auto-commit. Both must be registered to catch both main-agent and subagent finishes. Check `stop_hook_active` to avoid loops. | Returns `additionalContext` to push messages back to the conversation. |
| `PreCompact` | Back up the transcript before compaction so nothing is lost. | Matchers: `manual`, `auto`. |
| `InstructionsLoaded` | Fires when `CLAUDE.md` or `.claude/rules/*.md` loads. Useful for telemetry / audit only - no decision control. | Used by schema-as-code (see `advanced-architecture.md`). |
| `UserPromptSubmit` | Optionally inject the wiki health score into the user's first prompt of a session. | Plain stdout becomes context. |

### What I previously got wrong - `PreToolUse` decision format

`PreToolUse` no longer uses top-level `decision: "approve"/"block"`. That syntax is **deprecated** for this event. The current format is:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Curator may not write outside blueprint/"
  }
}
```

`permissionDecision` accepts `"allow"`, `"deny"`, `"ask"`, or `"defer"`. Precedence when multiple hooks return different values: `deny > defer > ask > allow`. Other events (`PostToolUse`, `Stop`, `SubagentStop`, `UserPromptSubmit`) still use top-level `decision: "block"`. The `defer` value requires Claude Code v2.1.89 or later.

### Why `FileChanged` is the right event for auto-compile

I previously used `PostToolUse` matched on `Write|Edit`. That only fires when Claude itself edits a file via its built-in tools. If a GitHub MCP server, a Linear MCP server, or an external `cron` job drops a new file in `blueprint/raw/`, `PostToolUse` doesn't fire.

`FileChanged` watches the disk directly and fires on any modification regardless of source. The matcher is the **basename** of the changed file (not the path), so for path-based filtering you check `file_path` inside the script:

```json
{
  "hooks": {
    "FileChanged": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/on-blueprint-file-changed.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/usr/bin/env bash
# .claude/hooks/on-blueprint-file-changed.sh
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path')
EVENT=$(echo "$INPUT" | jq -r '.event')

mkdir -p "$CLAUDE_PROJECT_DIR/blueprint/.curator-pending"

case "$FILE_PATH" in
  */blueprint/raw/*)
    echo "$FILE_PATH ($EVENT)" >> "$CLAUDE_PROJECT_DIR/blueprint/.curator-pending/compile.queue"
    ;;
  */blueprint/plan/*|*/blueprint/action-points/*)
    echo "$FILE_PATH ($EVENT)" >> "$CLAUDE_PROJECT_DIR/blueprint/.curator-pending/lint.queue"
    ;;
esac
exit 0
```

`FileChanged` has no decision control, and its stdout is shown to the user (not to Claude). The recommended pattern is to **write a marker file** that the next `SessionStart` or `UserPromptSubmit` handler picks up, then surfaces to Claude as context: "There are 3 pending files in blueprint/.curator-pending/compile.queue - invoke kb-curator to process them."

If you only need to react to Claude's own edits and not external writes, `PostToolUse` matched on `Write|Edit` with `if: "Write(blueprint/raw/**)"` is simpler - but only catches Claude. **Use `FileChanged` for the comprehensive case; `PostToolUse` for Claude-only.**

## 3. SessionStart hook example

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/load-blueprint-context.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/usr/bin/env bash
# .claude/hooks/load-blueprint-context.sh
PROJECT="$CLAUDE_PROJECT_DIR"

if [ -f "$PROJECT/blueprint/index.md" ]; then
  echo "## Blueprint index"
  cat "$PROJECT/blueprint/index.md"
  echo
fi

if [ -f "$PROJECT/blueprint/.telemetry/health.md" ]; then
  echo "## Wiki health"
  cat "$PROJECT/blueprint/.telemetry/health.md"
  echo
fi

# Surface any pending compile/lint queue from FileChanged hooks.
if [ -d "$PROJECT/blueprint/.curator-pending" ]; then
  COUNT=$(find "$PROJECT/blueprint/.curator-pending" -type f -name '*.queue' | xargs cat 2>/dev/null | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 0 ]; then
    echo "## Pending"
    echo "$COUNT file changes are queued for the kb-curator. Invoke it to process."
  fi
fi

exit 0
```

`SessionStart` is one of only two events where stdout is added directly to the conversation context (the other is `UserPromptSubmit`). Keep it fast - it runs on every session start and resume. Only `command` hooks are supported on `SessionStart`.

## 4. Git auto-commit hook

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/git-autocommit.sh",
            "async": true
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/git-autocommit.sh",
            "async": true
          }
        ]
      }
    ]
  }
}
```

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Loop protection: stop_hook_active is set when this hook itself triggered a continuation.
INPUT=$(cat 2>/dev/null || echo '{}')
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

# Only commit if blueprint/ has changes.
if git diff --quiet --exit-code -- blueprint/ && \
   git diff --cached --quiet --exit-code -- blueprint/; then
  exit 0
fi

git add blueprint/

CHANGED=$(git diff --cached --name-only -- blueprint/ | head -10 | sed 's/^/  - /')
COUNT=$(git diff --cached --name-only -- blueprint/ | wc -l | tr -d ' ')

git -c user.email="claude-code@local" -c user.name="Claude Code (blueprint)" \
    commit -m "blueprint: auto-commit ($COUNT files)

$CHANGED" >/dev/null

echo "blueprint: committed $COUNT file(s)"
```

### What changed from my previous version

- **`async: true`** - runs the commit in the background so it doesn't block Claude's response. Critical for the auto-commit case where the user shouldn't have to wait.
- **`stop_hook_active` check** - the canonical loop-protection field built into the `Stop` event payload. I previously invented a `.curator-running` flag; this is the documented way.
- **Both `Stop` and `SubagentStop` registered** - the docs explicitly recommend registering both to reliably catch the end of any run (subagent finishes don't fire `Stop`).
- **Stages only `blueprint/`** - never touches application code the user might be mid-edit on.

## 5. MCP servers, scoped to subagents

The cleanest pattern is to define MCP servers **inline in the curator's frontmatter** so they don't pollute the parent conversation's context:

```yaml
---
name: kb-curator
# ... other fields ...
mcpServers:
  - filesystem-blueprint:
      type: stdio
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "$CLAUDE_PROJECT_DIR/blueprint"]
  - git
---
```

Two patterns shown above:

- **Inline definition** (`filesystem-blueprint`) - keyed by the server name, with the same schema as `.mcp.json` entries. Connected when the curator starts, disconnected when it finishes. The parent conversation never sees these tools.
- **String reference** (`git`) - references an MCP server already configured in `.mcp.json`. Reuses the parent session's connection.

Use inline for capabilities you want hidden from the main conversation (saves context). Use string references for capabilities the main conversation also needs.

### What to NOT scope to the curator

The curator is read/write within `blueprint/`. Don't give it:

- **WebFetch / WebSearch** - research belongs to a separate Researcher agent (see `advanced-architecture.md`) so citations stay accountable.
- **Action-capable MCPs** (deploy, send messages, charge cards) - the blueprint phase is read-heavy. Action belongs in Phase 7 execution targets.
- **Bash** - would defeat the read-only-outside-blueprint guarantee.

## 6. Scoping which subagents the main agent can spawn

If the user installs the full agent team from `advanced-architecture.md` (Researcher / Curator / Linter / Auditor), constrain the main agent so it can only spawn those four:

In `.claude/settings.json`:

```json
{
  "permissions": {
    "deny": [
      "Agent(Explore)",
      "Agent(Plan)"
    ]
  }
}
```

Or, when launching the main agent via `--agent`, set its `tools` to:

```yaml
tools: Agent(researcher, kb-curator, kb-linter), Read, Write, Edit, WebFetch, WebSearch
```

`Agent(name1, name2)` is an allowlist. **Note:** the Task tool was renamed to `Agent` in Claude Code v2.1.63; existing `Task(...)` references still work as aliases.

## 7. Prompt hooks and agent hooks

Two hook types I previously didn't surface - both supported on `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `PreToolUse`, `Stop`, `SubagentStop`, `TaskCompleted`, `TaskCreated`, and `UserPromptSubmit`:

- **Prompt hooks** (`type: "prompt"`) - instead of running a shell command, send the hook input + a prompt to a Claude model (Haiku by default) for a structured yes/no decision. Cheap, no script to maintain. Example: a prompt hook on `Stop` of the curator that reads the changed plan files and asks Haiku "do these files violate any rule in `.claude/rules/blueprint-schema.md`?"
- **Agent hooks** (`type: "agent"`) - spawn a verification subagent with tool access (Read/Grep/Glob, plus Write scoped to `.reflection/` when it needs to record a verdict) to inspect the actual files before deciding. More expensive but grounded. This is what the **Auditor** from `advanced-architecture.md` should be: an agent hook on `SubagentStop` of the kb-linter that spawns the auditor to validate the linter's proposals.

Where these matter for the blueprint workspace:

- **The Auditor pattern from `advanced-architecture.md` should be an `agent` hook**, not a separately invoked subagent. When the Linter finishes, the agent hook fires, spawns the Auditor, the Auditor reads the proposals and returns approve/escalate/reject. No file-passing dance needed.
- **Schema rule enforcement** can be a `prompt` hook on `SubagentStop` of the curator: "Read `.claude/rules/blueprint-schema.md`, check the changed plan files against the rules, return JSON with violations."

Not supported on: `SessionStart`, `FileChanged`, `PreCompact`, `InstructionsLoaded`, `Notification`, etc. (those are command-only or have no decision control at all).

## 8. CLAUDE.md, `.claude/rules/`, and `InstructionsLoaded` - what the research actually shows

**This section reverses the previous version's advice.** A February 2026 ETH Zurich paper (Gloaguen et al., "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?", https://arxiv.org/abs/2602.11988) ran the first rigorous empirical test on repository-level context files. They built **AGENTbench** (138 real-world Python tasks from 12 less-popular repositories) and tested four agents (Claude Code with Sonnet 4.5, Codex with GPT-5.2 and GPT-5.1 Mini, Qwen Code) across three conditions: no context file, LLM-generated, human-written.

The findings, summarized:

| Condition | Task success Δ vs no file | Reasoning token Δ |
|---|---|---|
| **LLM-generated** (`/init` output) | **−3% on average** (worse) | +20% to +22% |
| **Human-written** | +4% on average | +14% to +19% |
| **No context file** | baseline | baseline |

LLM-generated context files (the kind you get from `/init`) **actively hurt** task success. Human-written files give a marginal benefit but still cost 14-22% more reasoning tokens for the same outcome. **Stronger models do not produce better context files.** Context files do **not** help agents find relevant files faster - agents took roughly the same number of steps to reach target files regardless of whether a context file was present. GPT-5.1 Mini was caught spending extra steps re-reading context files already loaded into its context window - pure waste.

Why does it backfire? The agent follows the instructions in the file faithfully (when AGENTS.md says `use uv`, agents use `uv` 1.6× per task instance vs <0.01× without). But that faithful following triggers broader exploration, deeper testing, more reasoning, without reliably improving the outcome. Compounding the problem, Anthropic's own implementation injects this with every CLAUDE.md load:

```
<system-reminder>
IMPORTANT: this context may or may not be relevant to your tasks. You should
not respond to this context unless it is highly relevant to your task.
</system-reminder>
```

Translation: Anthropic is *telling Claude to ignore CLAUDE.md if it's not directly relevant*. The more bloated the file, the more likely it gets dropped entirely.

### The corrected recommendation

For the bleu workspace specifically:

1. **Start with no `CLAUDE.md`.** Let Claude work without one. It will read `blueprint/README.md` and `blueprint/index.md` on its own once you point it there in your first prompt. For most tasks, that's enough.
2. **Add rules iteratively, only from observed friction.** Treat `CLAUDE.md` like `.gitignore`: it grows when you discover a *recurring* failure (not a one-off mistake), and it gets pruned when entries become irrelevant. A pattern is: "Claude keeps writing to `blueprint/plan/` directly instead of going through the curator." A one-off is: "Claude got the indentation wrong once."
3. **Write for the gap, not the overview.** Encode what the repository doesn't already explain. Tool choices that diverge from defaults (`use uv, not pip`), non-obvious test invocations (`pnpm test:integration --run`), constraints not apparent from the code. Skip everything inferable from `package.json`, `pyproject.toml`, `README.md`, existing config files. **A `CLAUDE.md` that restates the README is probably hurting you.**
4. **Target under 150 lines** for the file as a whole. Frontier thinking models follow ~150-200 instructions reliably, and Claude Code's own system prompt has ~50, so you have ~100-150 instructions to spend wisely.
5. **Use hooks instead of `CLAUDE.md` for things that must happen every time.** Hooks are deterministic; `CLAUDE.md` instructions are advisory. From Anthropic's own best-practices doc: "Use hooks for actions that must happen every time with zero exceptions. Hooks run scripts automatically. Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens."
6. **If `/init` runs, delete most of what it generates.** The default file includes filler ("this is a TypeScript project") that competes for attention. Edit down from a draft instead of starting from a blank file - but be aggressive about deletion.
7. **The hidden value isn't the tokens - it's the articulation.** Widely cited developer comment: "The actual token-level context CLAUDE.md provides matters less than the fact that writing it forces you to articulate things about your codebase that were previously just in your head." For the bleu, the same logic applies to `.claude/rules/blueprint-schema.md` - writing the rules down forces you to make implicit conventions explicit. Future Claudes benefit; future humans benefit too.

### A research-informed `CLAUDE.md` for a project using this skill

```markdown
# Project: <name>

The bleu workspace is at `blueprint/`. The kb-curator subagent
owns it; do not modify files there directly. To ingest new info, write to
`blueprint/raw/` and the FileChanged hook will queue it for the curator.

## Tool choices that aren't inferable from the repo
- Test runner: `pnpm test:integration --run` (not `pnpm test`)
- Package manager: `uv` (not `pip` or `poetry`)
- Linter: `biome` with our custom config; don't suggest prettier

## Conventions that aren't obvious
- PR titles must start with [BLUEPRINT-NN] referencing the action point
- Component files in `src/components/` use kebab-case, not PascalCase
```

That's it. ~15 lines. Everything else (architecture, test framework, language version, build commands) is inferable from the project's actual files.

### `.claude/rules/*.md` - a different mechanism

`.claude/rules/*.md` is related but different from `CLAUDE.md`: rule files that load **conditionally** via the `InstructionsLoaded` event when Claude accesses certain paths. This is the natural home for **schema-as-code** rules from `advanced-architecture.md`. Rules with `paths:` frontmatter only load when relevant - they don't compete for attention on every session like `CLAUDE.md` does.

```markdown
---
description: Schema rules for blueprint workspace
paths: ["blueprint/**"]
---

# Blueprint schema rules

Every action point file at action-points/AP-*.md MUST have:
- A "## Verification" section with at least one checkbox
- A "Files involved" table listing real paths
...
```

When Claude accesses any file matching `paths`, this rule file loads into context. The Linter can then enforce these rules - they're already in scope. The `InstructionsLoaded` event fires when this happens; you can register a hook on it for telemetry (no decision control - it's observability only).

The advantage of `.claude/rules/` over `CLAUDE.md` for blueprint-specific rules is that the rules are scoped to when they're relevant. They don't pay the always-loaded tax that `CLAUDE.md` does.

### Symlink pattern for multi-tool teams

If the user works in a project that ships with both Claude Code and Codex/Cursor/Copilot users, the cross-tool standard is `AGENTS.md` (donated to the Linux Foundation's Agentic AI Foundation in December 2025). A symlink keeps things in sync:

```bash
ln -s AGENTS.md CLAUDE.md
```

Both files are now the same file. No drift between formats.

## 9. The Anthropic harness pattern for long-running blueprints

Anthropic's engineering team published two posts in late 2025 / early 2026 directly relevant to the Phase 0-7 workflow: **"Effective harnesses for long-running agents"** and the GAN-inspired follow-up **"Harness design for long-running application development"**. Canonical URLs:

- https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- https://www.anthropic.com/engineering/harness-design-long-running-apps

The core problem they address: agents work in discrete sessions, each starting with no memory of what came before. Their analogy: "a software project staffed by engineers working in shifts, where each new engineer arrives with no memory of what happened on the previous shift."

### The two-fold harness

Anthropic's solution is two prompts on the same agent harness:

1. **Initializer agent** runs only on the very first session. Different prompt from subsequent sessions. Sets up the structured environment: a comprehensive feature list, the git repo, and a progress tracking file (`claude-progress.txt`).
2. **Coding agent** runs on every subsequent session. Reads `claude-progress.txt` and the feature list at the start, makes incremental progress on one feature at a time, updates the progress file before stopping, leaves the codebase in a "clean state" (mergeable, documented, no major bugs).

Critical implementation detail: the initializer and coding agents are **the same underlying agent with different initial prompts**. Not separate processes. Just a different first message.

### Mapping to the bleu workflow

The bleu already follows this shape conceptually - Phase 0 (intake) and Phase 1 (research) are the initializer; Phases 2-6 are the coding agent. What was missing: the explicit `claude-progress.txt` analog. The blueprint already has files that play this role, but they weren't being actively surfaced.

**Recommended additions to `blueprint/`** for users adopting Anthropic's harness pattern:

```
blueprint/
├── progress.md                ← claude-progress.txt analog: what's done, what's next
├── features.md                ← comprehensive feature list, expanded from intake
├── ... (rest of the workspace)
```

- **`blueprint/progress.md`** is updated by the Curator (or by Claude directly) at the end of every session. Format: a checklist organized by phase, with the current cursor marked. The `SessionStart` hook reads it and surfaces "you were here" to Claude on the next run.
- **`blueprint/features.md`** is written once during Phase 0 by the initializer. It's the comprehensive list of every feature the user has scoped, expanded beyond their initial prompt. **Its job is to prevent premature completion** - the agent has to walk through every item before declaring the blueprint done. Anthropic's research found that without this file, agents tend to one-shot a project at maybe 60% complete and call it done.

The `SessionStart` hook from section 3 should be extended to surface both files alongside `index.md`.

### The two failure modes the harness addresses

From Anthropic's posts:

- **Premature completion**: agents declare a project "complete" at maybe 60% done. *Mitigation: the comprehensive feature list - the agent must walk through all of it before calling it done.*
- **Context anxiety**: model wraps up work prematurely as it approaches what it *believes* is its context limit. Sonnet 4.5 exhibited this strongly; Opus 4.6 mostly fixed it. *Mitigation: context resets (clean slate) plus structured handoff artifacts. The progress.md file is exactly that handoff artifact.*

### Self-evaluation pitfall - "agents praise their own work"

From Anthropic's harness post:

> "When asked to evaluate work they've produced, agents tend to respond by confidently praising the work - even when, to a human observer, the quality is obviously mediocre. This problem is particularly pronounced for subjective tasks like design, where there is no binary check equivalent to a verifiable software test."

This is the canonical justification for the proposer-validator separation in `advanced-architecture.md`. The Linter is **not** the same agent as the Curator. The Auditor is **not** the same agent as the Linter. Anthropic's GAN-inspired three-agent architecture (Planner / Generator / Evaluator) makes this structural - and so does this skill's four-agent team.

### "Audit your harness as models improve"

A direct quote from Rajasekaran's harness post that should be re-read whenever the user upgrades models:

> "Audit your own harness. Are you running complex context management because the model actually needs it, or because you designed the system six months ago when the model did need it? Over-engineering the orchestration layer wastes tokens, adds latency, and introduces failure points that the current model could simply handle on its own."

When moving from Sonnet 4.5 → Opus 4.6, Rajasekaran specifically dropped context resets and the sprint construct from his harness because the newer model didn't need them. The same principle applies here: when Opus 4.7 (or whatever ships next) handles long horizons natively, some of the scaffolding in this skill (the four-agent team, the explicit reflection cycle) may become unnecessary. Revisit periodically. Don't carry yesterday's workarounds into tomorrow's runs.


## 10. UX shortcuts to mention to the user once

- **`/agents`** - interactive browser/manager for installed subagents. The user can `/agents` to see what's installed, edit them inline, or generate new ones.
- **`/hooks`** - read-only browser of all configured hooks across user/project/local/plugin scopes. Useful for "wait, what's actually firing?"
- **`@-mention`** - type `@"kb-curator (agent)"` to invoke a specific agent for one task.
- **`claude --agent kb-curator`** - start a session where the main thread itself is the curator. The agent's system prompt replaces the default Claude Code system prompt.
- **`claude agents`** - CLI command to list all configured subagents grouped by source.
- **`disableAllHooks: true`** in any settings file to temporarily kill all hooks without removing them (managed-hook respecting).

## 11. When NOT to install any of this

- The user is on Claude.ai or another non-Claude-Code surface.
- The blueprint is throwaway and won't be revisited.
- The repo is shared with people who haven't agreed to `.claude/` config landing in their tree.
- The user is on a Claude Code version older than the features used (the docs flag specific version requirements; the `defer` permissionDecision needs ≥ 2.1.89, the `Agent` rename of `Task` happened at 2.1.63, etc.). When in doubt, generate without the version-gated feature and tell the user what was skipped and why.
- The user explicitly says "just give me the files, no automation."
- The user wants this packaged as a Claude Code **plugin** - plugin subagents do **not** support `hooks`, `mcpServers`, or `permissionMode` frontmatter fields. If the user needs those, the agent file must live in `.claude/agents/` or `~/.claude/agents/`, not inside a plugin.

Fall back to the file-only workflow. The skill is fully usable without any of this.

## Final reminder

Before generating any settings file, agent file, or hook script, **re-fetch the canonical docs** linked at the top. Schemas evolve. The `claude-code-guide` built-in subagent is the fastest way to verify a specific question - Claude Code will spawn it automatically when you ask "how do I configure X."
