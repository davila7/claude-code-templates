---
name: command-creator
description: This skill should be used when creating a Claude Code slash command. Use when users ask to "create a command", "make a slash command", "add a command", or want to document a workflow as a reusable command. Essential for creating optimized, agent-executable slash commands with proper structure and best practices.
---

# Command Creator

This skill guides the creation of Claude Code slash commands - reusable workflows that can be invoked with `/command-name` in Claude Code conversations.

## About Slash Commands

Slash commands are markdown files stored in `.claude/commands/` (project-level) or `~/.claude/commands/` (global/user-level) that get expanded into prompts when invoked. They're ideal for:

- Repetitive workflows (code review, PR submission, CI fixing)
- Multi-step processes that need consistency
- Agent delegation patterns
- Project-specific automation

## When to Use This Skill

Invoke this skill when users:

- Ask to "create a command" or "make a slash command"
- Want to automate a repetitive workflow
- Need to document a consistent process for reuse
- Say "I keep doing X, can we make a command for it?"
- Want to create project-specific or global commands

## Bundled Resources

This skill includes reference documentation for detailed guidance:

- **references/patterns.md** - Command patterns (workflow automation, iterative fixing, agent delegation, simple execution)
- **references/examples.md** - Real command examples with full source (submit-stack, ensure-ci, create-implementation-plan)
- **references/best-practices.md** - Quality checklist, common pitfalls, writing guidelines, template structure

Load these references as needed when creating commands to understand patterns, see examples, or ensure quality.

## Command Structure Overview

Every slash command is a markdown file with:

```markdown
---
description: Brief description shown in /help (required)
argument-hint: <placeholder> (optional, if command takes arguments)
---

# Command Title

[Detailed instructions for the agent to execute autonomously]
```

## Command Creation Workflow

### Step 1: Determine Location

**Auto-detect the appropriate location:**

1. Check git repository status: `git rev-parse --is-inside-work-tree 2>/dev/null`
2. Default location:
   - If in git repo → Project-level: `.claude/commands/`
   - If not in git repo → Global: `~/.claude/commands/`
3. Allow user override:
   - If user explicitly mentions "global" or "user-level" → Use `~/.claude/commands/`
   - If user explicitly mentions "project" or "project-level" → Use `.claude/commands/`

Report the chosen location to the user before proceeding.

### Step 2: Show Command Patterns

Help the user understand different command types. Load **references/patterns.md** to see available patterns:

- **Workflow Automation** - Analyze → Act → Report (e.g., submit-stack)
- **Iterative Fixing** - Run → Parse → Fix → Repeat (e.g., ensure-ci)
- **Agent Delegation** - Context → Delegate → Iterate (e.g., create-implementation-plan)
- **Simple Execution** - Run command with args (e.g., codex-review)

Ask the user: "Which pattern is closest to what you want to create?" This helps frame the conversation.

### Step 3: Gather Command Information

Ask the user for key information:

#### A. Command Name and Purpose

Ask:

- "What should the command be called?" (for filename)
- "What does this command do?" (for description field)

Guidelines:

- Command names MUST be kebab-case (hyphens, NOT underscores)
  - ✅ CORRECT: `submit-stack`, `ensure-ci`, `create-from-plan`
  - ❌ WRONG: `submit_stack`, `ensure_ci`, `create_from_plan`
- File names match command names: `my-command.md` → invoked as `/my-command`
- Description should be concise, action-oriented (appears in `/help` output)

#### B. Arguments

Ask:

- "Does this command take any arguments?"
- "Are arguments required or optional?"
- "What should arguments represent?"

If command takes arguments:

- Add `argument-hint: <placeholder>` to frontmatter
- Use `<angle-brackets>` for required arguments
- Use `[square-brackets]` for optional arguments

#### C. Workflow Steps

Ask:

- "What are the specific steps this command should follow?"
- "What order should they happen in?"
- "What tools or commands should be used?"

Gather details about:

- Initial analysis or checks to perform
- Main actions to take
- How to handle results
- Success criteria
- Error handling approach

#### D. Tool Restrictions and Guidance

Ask:

- "Should this command use any specific agents or tools?"
- "Are there any tools or operations it should avoid?"
- "Should it read any specific files for context?"

### Step 4: Generate Optimized Command

Create the command file with agent-optimized instructions. Load **references/best-practices.md** for:

- Template structure
- Best practices for agent execution
- Writing style guidelines
- Quality checklist

Key principles:

- Use imperative/infinitive form (verb-first instructions)
- Be explicit and specific
- Include expected outcomes
- Provide concrete examples
- Define clear error handling

### Step 5: Create the Command File

1. Determine full file path:
   - Project: `.claude/commands/[command-name].md`
   - Global: `~/.claude/commands/[command-name].md`

2. Ensure directory exists:

   ```bash
   mkdir -p [directory-path]
   ```

3. Write the command file using the Write tool

4. Confirm with user:
   - Report the file location
   - Summarize what the command does
   - Explain how to use it: `/command-name [arguments]`

### Step 6: Test and Iterate (Optional)

If the user wants to test:

1. Suggest testing: `You can test this command by running: /command-name [arguments]`
2. Be ready to iterate based on feedback
3. Update the file with improvements as needed

## Quick Tips

**For detailed guidance, load the bundled references:**

- Load **references/patterns.md** when designing the command workflow
- Load **references/examples.md** to see how existing commands are structured
- Load **references/best-practices.md** before finalizing to ensure quality

**Common patterns to remember:**

- Use Bash tool for `pytest`, `pyright`, `ruff`, `prettier`, `make`, `gt` commands
- Use Task tool to invoke subagents for specialized tasks
- Check for specific files first (e.g., `.PLAN.md`) before proceeding
- Mark todos complete immediately, not in batches
- Include explicit error handling instructions
- Define clear success criteria

## Summary

When creating a command:

1. **Detect location** (project vs global)
2. **Show patterns** to frame the conversation
3. **Gather information** (name, purpose, arguments, steps, tools)
4. **Generate optimized command** with agent-executable instructions
5. **Create file** at appropriate location
6. **Confirm and iterate** as needed

Focus on creating commands that agents can execute autonomously, with clear steps, explicit tool usage, and proper error handling.
