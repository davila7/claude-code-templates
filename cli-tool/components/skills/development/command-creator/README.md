# Command Creator

A comprehensive skill for creating optimized, agent-executable slash commands in Claude Code. This skill guides you through the entire process of designing, implementing, and testing reusable workflow automation commands.

## Table of Contents

- [Overview](#overview)
- [When to Use This Skill](#when-to-use-this-skill)
- [What Are Slash Commands?](#what-are-slash-commands)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Command Patterns](#command-patterns)
- [Location Strategy](#location-strategy)
- [Bundled Resources](#bundled-resources)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Common Use Cases](#common-use-cases)

---

## Overview

The Command Creator skill helps you transform repetitive workflows into reusable slash commands that can be invoked with `/command-name` in Claude Code conversations. It provides expert guidance on command structure, agent optimization, and best practices to ensure your commands execute reliably and autonomously.

**Purpose**: Create high-quality, agent-executable slash commands with proper structure, clear instructions, and optimal tool usage patterns.

**Target Users**: Developers who want to:
- Automate repetitive workflows
- Document consistent processes for reuse
- Create project-specific or global automation
- Delegate complex tasks to specialized agents

---

## When to Use This Skill

Invoke this skill when you need to:

- Create a new slash command from scratch
- Automate a workflow you find yourself repeating
- Document a multi-step process for consistent execution
- Convert manual procedures into automated commands
- Create project-specific commands for team workflows
- Build global commands for personal productivity

**Trigger Phrases**:
- "create a command"
- "make a slash command"
- "add a command"
- "I keep doing X, can we make a command for it?"
- "automate this workflow"
- "create a reusable command"

---

## What Are Slash Commands?

Slash commands are markdown files stored in `.claude/commands/` (project-level) or `~/.claude/commands/` (global/user-level) that get expanded into prompts when invoked.

**Structure**:
```markdown
---
description: Brief description shown in /help (required)
argument-hint: <placeholder> (optional, if command takes arguments)
---

# Command Title

[Detailed instructions for the agent to execute autonomously]
```

**Invocation**:
```
/command-name [arguments]
```

**Storage Locations**:
- **Project-level**: `.claude/commands/my-command.md` (only available in this project)
- **Global/User-level**: `~/.claude/commands/my-command.md` (available everywhere)

---

## Key Features

### 1. Intelligent Location Detection

Automatically determines whether commands should be project-level or global based on:
- Current directory git repository status
- User explicit preferences
- Command scope and purpose

### 2. Pattern-Based Design

Guides you through proven command patterns:
- **Workflow Automation**: Multi-step processes with analysis, action, and reporting
- **Iterative Fixing**: Continuous improvement loops (run → parse → fix → repeat)
- **Agent Delegation**: Complex tasks broken into specialized agent work
- **Simple Execution**: Direct tool or script execution with arguments

### 3. Agent-Optimized Instructions

Creates commands that agents can execute autonomously with:
- Imperative/infinitive verb-first instructions
- Explicit tool usage specifications
- Clear success criteria
- Concrete error handling
- Expected outcomes defined

### 4. Quality Assurance

Includes comprehensive best practices for:
- Proper naming conventions (kebab-case enforced)
- Argument handling and hints
- Tool restriction guidelines
- Error recovery strategies
- Progress reporting patterns

### 5. Bundled Reference Documentation

Provides three comprehensive reference files:
- **patterns.md**: Command design patterns with detailed examples
- **examples.md**: Real-world command implementations
- **best-practices.md**: Quality checklist and writing guidelines

---

## How It Works

The Command Creator follows a structured 6-step workflow:

### Step 1: Determine Location

**Auto-detection Logic**:
1. Check if current directory is inside a git repository
2. Default to project-level (`.claude/commands/`) if in git repo
3. Default to global (`~/.claude/commands/`) if not in git repo
4. Allow user override for explicit location preference

**User is informed** of the chosen location before proceeding.

### Step 2: Show Command Patterns

Present available command patterns to help frame the conversation:

- **Workflow Automation**: Analyze → Act → Report (e.g., submit PR stack)
- **Iterative Fixing**: Run → Parse → Fix → Repeat (e.g., ensure CI passes)
- **Agent Delegation**: Context → Delegate → Iterate (e.g., create implementation plan)
- **Simple Execution**: Run command with args (e.g., code review)

User selects the closest pattern to their needs.

### Step 3: Gather Command Information

Interactive Q&A to collect:

**A. Command Name and Purpose**
- Command name (must be kebab-case: `my-command`, not `my_command`)
- Description for `/help` output
- Purpose and scope

**B. Arguments**
- Does it take arguments? (yes/no)
- Required or optional?
- Argument hint format (`<required>` or `[optional]`)

**C. Workflow Steps**
- Specific steps in execution order
- Tools/commands to use
- Success criteria
- Error handling approach

**D. Tool Restrictions**
- Specific agents or tools to use
- Operations to avoid
- Context files to read

### Step 4: Generate Optimized Command

Create agent-executable instructions using:
- Template structure from best-practices.md
- Imperative verb-first language
- Explicit tool specifications
- Clear expected outcomes
- Concrete examples where needed

### Step 5: Create the Command File

1. Construct full file path (project or global)
2. Ensure directory exists (`mkdir -p`)
3. Write command file using Write tool
4. Confirm with user:
   - Report file location
   - Summarize command function
   - Explain invocation syntax

### Step 6: Test and Iterate

1. Suggest testing the command
2. Wait for user feedback
3. Iterate and improve based on results
4. Update file with refinements

---

## Command Patterns

### 1. Workflow Automation

**Use Case**: Multi-step processes requiring analysis, action, and reporting

**Example**: Submit PR stack
```markdown
1. Analyze git history to identify commit stack
2. Create PRs for each commit with proper dependencies
3. Report created PRs with links and status
```

**Key Characteristics**:
- Sequential steps with dependencies
- Clear analysis phase before action
- Comprehensive final report

### 2. Iterative Fixing

**Use Case**: Continuous improvement until success criteria met

**Example**: Ensure CI passes
```markdown
1. Run tests and capture output
2. Parse failures and errors
3. Fix identified issues
4. Repeat until all tests pass
```

**Key Characteristics**:
- Loop until success condition
- Parse errors to guide fixes
- Progress tracking across iterations

### 3. Agent Delegation

**Use Case**: Complex tasks requiring specialized agent expertise

**Example**: Create implementation plan
```markdown
1. Gather context (requirements, codebase)
2. Delegate to subagent agent
3. Iterate on plan with user feedback
4. Save final plan to .PLAN.md
```

**Key Characteristics**:
- Use Task tool for specialized agents
- Pass relevant context to delegated agent
- Iterate on specialized agent output

### 4. Simple Execution

**Use Case**: Direct tool/script execution with arguments

**Example**: Code review
```markdown
1. Run codex review on specified files
2. Present results to user
```

**Key Characteristics**:
- Minimal logic, direct execution
- Pass through arguments to underlying tool
- Quick feedback loop

---

## Location Strategy

### Project-Level Commands (`.claude/commands/`)

**When to Use**:
- Command is specific to this project's workflow
- Requires project-specific context or files
- Team members should share this command
- Automation tied to project structure

**Examples**:
- `/submit-stack` (project's PR submission workflow)
- `/ensure-ci` (project's test suite)
- `/deploy-staging` (project's deployment process)

**Advantages**:
- Version controlled with project
- Shared across team
- Project-specific customization

### Global Commands (`~/.claude/commands/`)

**When to Use**:
- Command works across any project
- Personal productivity tool
- Generic workflow automation
- No project-specific dependencies

**Examples**:
- `/codex-review` (code review any files)
- `/create-implementation-plan` (generic planning)
- `/git-cleanup` (git maintenance anywhere)

**Advantages**:
- Available everywhere
- Personal customization
- Independent of project

---

## Bundled Resources

This skill includes three comprehensive reference files in the `references/` directory:

### references/patterns.md

**Purpose**: Detailed command design patterns with implementation guidance

**Contents**:
- Pattern 1: Workflow Automation (Analyze → Act → Report)
- Pattern 2: Iterative Fixing (Run → Parse → Fix → Repeat)
- Pattern 3: Agent Delegation (Context → Delegate → Iterate)
- Pattern 4: Simple Execution (Run command with args)
- When to use each pattern
- Tool usage recommendations
- Real examples for each pattern

**Load When**: Designing the command workflow and choosing the right pattern

### references/examples.md

**Purpose**: Real-world command implementations with full source code

**Contents**:
- `/submit-stack`: Submit PR stack from git history
- `/ensure-ci`: Iteratively fix CI failures
- `/create-implementation-plan`: Delegate to planner agent
- Full markdown source for each example
- Annotations explaining key decisions
- Best practices demonstrated in context

**Load When**: Need concrete examples of how to structure specific command types

### references/best-practices.md

**Purpose**: Quality checklist and writing guidelines

**Contents**:
- Command template structure
- Agent-optimized writing style
- Common pitfalls to avoid
- Quality checklist before finalizing
- Tool restriction patterns
- Error handling strategies
- Naming conventions

**Load When**: Finalizing command to ensure quality and completeness

---

## Usage Examples

### Example 1: Create Project-Level CI Fixer

**User Request**: "I keep fixing CI failures manually. Can we make a command for this?"

**Skill Flow**:
1. Detects project-level (in git repo)
2. Suggests "Iterative Fixing" pattern
3. Gathers info:
   - Name: `ensure-ci`
   - Description: "Iteratively fix CI failures until all tests pass"
   - Arguments: None
   - Steps: Run tests → Parse failures → Fix issues → Repeat
4. Generates command with Bash tool for pytest
5. Creates `.claude/commands/ensure-ci.md`
6. User invokes: `/ensure-ci`

### Example 2: Create Global Code Review Command

**User Request**: "Create a global command to review code with Codex"

**Skill Flow**:
1. Detects global (user requests "global")
2. Suggests "Simple Execution" pattern
3. Gathers info:
   - Name: `codex-review`
   - Description: "Review code files using Codex"
   - Arguments: `<files>` (required)
   - Steps: Run codex review → Present results
4. Generates command with codex skill invocation
5. Creates `~/.claude/commands/codex-review.md`
6. User invokes: `/codex-review src/app.py src/utils.py`

### Example 3: Create PR Submission Workflow

**User Request**: "Make a command that analyzes my commits and creates a PR stack"

**Skill Flow**:
1. Detects project-level (in git repo)
2. Suggests "Workflow Automation" pattern
3. Gathers info:
   - Name: `submit-stack`
   - Description: "Create PR stack from commit history"
   - Arguments: `[base-branch]` (optional, defaults to main)
   - Steps: Analyze commits → Create PRs → Report results
4. Generates command with git analysis and gh CLI
5. Creates `.claude/commands/submit-stack.md`
6. User invokes: `/submit-stack` or `/submit-stack develop`

---

## Best Practices

### Naming Conventions

**MUST use kebab-case** (hyphens, not underscores):
- Correct: `submit-stack`, `ensure-ci`, `create-from-plan`
- Wrong: `submit_stack`, `ensure_ci`, `create_from_plan`

### Argument Hints

- Use `<angle-brackets>` for **required** arguments
- Use `[square-brackets]` for **optional** arguments
- Examples:
  - `argument-hint: <file-path>` (required)
  - `argument-hint: [base-branch]` (optional)
  - `argument-hint: <command> [args...]` (mixed)

### Agent-Optimized Instructions

**Write in imperative/infinitive form**:
- Correct: "Run pytest to execute tests"
- Wrong: "You should run pytest to execute tests"

**Be explicit about tools**:
- Correct: "Use the Bash tool to run `pytest tests/`"
- Wrong: "Run the tests"

**Define success criteria**:
- Correct: "Continue until all tests pass (exit code 0)"
- Wrong: "Fix the tests"

**Include error handling**:
- Correct: "If pytest fails, parse the output to identify failing tests, then fix each one"
- Wrong: "Fix any test failures"

### Tool Restrictions

**Use Bash tool for**:
- `pytest`, `pyright`, `ruff`, `prettier`
- `make`, `npm`, `yarn`
- `gt` (git-town commands)

**Use Task tool for**:
- Specialized agents (`subagent`, `subagents`)
- Long-running or complex delegated tasks

**Avoid in commands**:
- Interactive prompts (commands must be autonomous)
- User confirmation loops (unless explicit in pattern)
- Ambiguous instructions that require interpretation

---

## Common Use Cases

### Development Workflows

- **Submit PRs**: Analyze commits, create PR stack with dependencies
- **Fix CI**: Iteratively run tests, parse failures, fix issues
- **Code Review**: Run linters, formatters, static analysis
- **Deploy**: Build, test, deploy to staging/production

### Project Automation

- **Setup**: Initialize project structure, install dependencies
- **Documentation**: Generate docs from code, update README
- **Testing**: Run full test suite with coverage reports
- **Release**: Bump version, create changelog, tag release

### Personal Productivity

- **Git Cleanup**: Delete merged branches, prune remotes
- **Codebase Analysis**: Generate architecture diagrams, dependency graphs
- **Refactoring**: Apply consistent patterns across files
- **Planning**: Create implementation plans for features

### Team Collaboration

- **Onboarding**: Setup development environment, clone repos
- **Standards**: Enforce code style, commit message format
- **Knowledge**: Document architectural decisions, add examples
- **Review**: Automated code review checks before human review

---

## Summary

The Command Creator skill provides a comprehensive, guided workflow for creating high-quality slash commands in Claude Code. By following proven patterns, gathering detailed requirements, and generating agent-optimized instructions, it ensures your commands are:

- **Reliable**: Execute autonomously without manual intervention
- **Maintainable**: Clear structure and documentation
- **Reusable**: Available project-wide or globally
- **Optimized**: Use appropriate tools and agents for the task

**Next Steps**:
1. Identify a repetitive workflow you want to automate
2. Invoke the command-creator skill
3. Follow the guided workflow to create your command
4. Test and iterate based on results
5. Share with your team (project-level) or use personally (global)

**Get Started**:
```
/command-creator
```

Or simply say: "I want to create a command that [does something]"
