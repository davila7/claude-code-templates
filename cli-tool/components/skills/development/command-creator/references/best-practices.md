# Command Best Practices

This document provides quality guidelines, writing style recommendations, common pitfalls, and a detailed template structure for creating effective slash commands.

## Command Writing Style

Commands are executed by AI agents, so optimize for autonomous execution.

### Writing Form

**ALWAYS use imperative/infinitive form** (verb-first instructions), not second person.

```markdown
✅ CORRECT:

- "Run git status to check current branch"
- "Check if .PLAN.md exists before proceeding"
- "Use the Task tool with Bash tool"

❌ WRONG:

- "You should run git status"
- "You need to check if .PLAN.md exists"
- "You'll want to use the Task tool"
```

### Specificity

Be explicit and specific, not vague.

```markdown
✅ CORRECT:

- "Run make lint to check for linting errors"
- "Read src/config.py lines 45-67 to understand the config structure"
- "Use Edit tool to replace 'List[str]' with 'list[str]'"

❌ WRONG:

- "Check for errors"
- "Look at the config file"
- "Fix the type annotation"
```

### Expected Outcomes

Include what should happen after each action.

```markdown
✅ CORRECT:

- "Run git status - this should show modified files in src/ directory"
- "After running make format, all Python files should be formatted"
- "The output should contain PR URLs for each submitted branch"

❌ WRONG:

- "Run git status"
- "Run make format"
- "Submit the PRs"
```

### Concrete Examples

Provide realistic examples, not placeholders like foo/bar.

```markdown
✅ CORRECT:

- "Example: `git commit -m 'Add user authentication with OAuth2'`"
- "Example: `/submit-stack 'Implement caching for API responses'`"
- "If error shows: `src/erk/cli/commands/init.py:45: Type error`"

❌ WRONG:

- "Example: `git commit -m 'foo bar'`"
- "Example: `/submit-stack 'something'`"
- "If error shows: `file.py:123: Error message`"
```

## Template Structure

Use this template structure for comprehensive commands:

```markdown
---
description: [One-line description for /help output]
argument-hint: [<required>] or [[optional]] (omit if no arguments)
---

# [Command Title]

[1-2 sentence overview of what this command does]

## What This Command Does

[Numbered list of main steps, user-facing description]

1. **[First action]**: [What it does]
2. **[Second action]**: [What it does]
3. **[Third action]**: [What it does]

## Usage

\`\`\`bash

# [Example with arguments]

/command-name "argument example"

# [Example without arguments if optional]

/command-name
\`\`\`

## Implementation Steps

When this command is invoked:

### 1. [First Major Step]

[Clear instructions with specifics]

\`\`\`bash

# Example commands if applicable

command --flag value
\`\`\`

[Explain what to do with results]

### 2. [Second Major Step]

[Continue with clear, actionable instructions]

### 3. [Continue for all steps]

## Important Notes

- **[Key constraint or requirement]**
- **[What to check first]**
- **[What NOT to do]**
- **[Error handling approach]**

## Error Handling

[Specify how to handle failures]

If any step fails:

- Report the specific command that failed
- Show the error message
- [What to do next - retry/ask user/stop]

## Example Output

\`\`\`
[Show expected terminal output]
\`\`\`
```

## Agent Optimization Elements

### 1. Explicit File Checks

Tell the agent exactly what to check and when.

```markdown
**FIRST**: Check if `.PLAN.md` exists in the repository root:

\`\`\`bash
if [ -f .PLAN.md ]; then

# Use .PLAN.md for context

else

# Fall back to alternative approach

fi
\`\`\`
```

### 2. Tool Usage Guidance

Be explicit about which tools to use.

```markdown
**Use the Bash tool for pytest/pyright/ruff/prettier/make/gt commands:**

Use Bash tool to run:
\`\`\`bash
make all-ci
\`\`\`

**DO NOT use Bash tool for make commands**
```

### 3. Anti-Patterns

Call out what NOT to do.

```markdown
## Important Notes

- **NEVER run additional exploration commands** beyond checking .PLAN.md, git status/diff
- **DO NOT batch completions** - mark todos complete immediately after finishing
- **DO NOT use Edit tool during planning phase**
- **DO NOT retry automatically** - ask user how to proceed
```

### 4. Conditional Logic

Use clear if/else structure.

```markdown
If condition A:

- Do X
- Then do Y

Otherwise (if condition B):

- Do Z
- Then do W

If neither condition is met:

- Report to user
- Exit gracefully
```

### 5. Success Criteria

Define exactly when to stop.

```markdown
## When to Stop

**SUCCESS**: Stop when `make all-ci` exits with code 0 (all checks passed)

**STUCK**: Stop and report to user if:

1. You've completed 10 iterations without success
2. The same error persists after 3 fix attempts
3. You encounter an error you cannot automatically fix
```

### 6. Error Handling

Provide explicit error handling instructions.

```markdown
## Error Handling

If any step fails:

- Report the specific command that failed
- Show the error message to the user
- Ask how to proceed (don't retry automatically)

Example:

\`\`\`
Error: git commit failed with exit code 1

Error message:
nothing to commit, working tree clean

Next steps: Please make changes before committing.
\`\`\`
```

### 7. Progress Tracking

Specify when and how to track progress.

```markdown
## Progress Reporting

Use TodoWrite to track your progress:

- Create todos at the start for each iteration
- Mark as in_progress when starting
- Mark as completed immediately after finishing (not batched)
- Update with iteration number: "Iteration 3: Fixing type errors"
```

## Common Patterns

### Pattern: TodoWrite Usage

```markdown
## Progress Tracking

Use TodoWrite to create todos for:

1. Each major step in the workflow
2. Each iteration in a loop
3. Each error category being fixed

Mark todos as completed IMMEDIATELY after finishing each task, not batched at the end.
```

### Pattern: File Operations

```markdown
### Read Before Modifying

Before making any changes:

1. Use Read tool to examine the current file state
2. Understand the code structure and context
3. Identify exact changes needed
4. Use Edit tool with precise old_string/new_string
```

### Pattern: Git Operations

```markdown
### Git Workflow

1. Check current git status:
   \`\`\`bash
   git status
   \`\`\`

2. Review changes:
   \`\`\`bash
   git diff HEAD
   \`\`\`

3. Check recent commits for style:
   \`\`\`bash
   git log --oneline -5
   \`\`\`

4. Stage all changes:
   \`\`\`bash
   git add .
   \`\`\`

5. Create commit:
   \`\`\`bash
   git commit -m "[message]"
   \`\`\`
```

### Pattern: Conditional Tool Selection

```markdown
### Tool Selection Based on Scope

Analyze the changes first:

If changes span 3+ files OR involve new abstractions:

- Use Task tool with subagent_type="subagent"
- Create detailed plan
- Execute with subagent agent

Otherwise (changes are contained):

- Execute changes directly
- Use Edit tool for modifications
- Skip planning overhead
```

### Pattern: Makefile Integration

```markdown
### Running Make Commands

**ALWAYS use Bash tool for pytest/pyright/ruff/prettier/make/gt commands**

Use Bash tool:

\`\`\`markdown
Use Bash tool to run command: "make all-ci"
\`\`\`

**DO NOT use Bash tool for make commands** - this is less efficient and provides worse output handling.
```

## Quality Checklist

Before finalizing a command, verify:

**Structure:**

- [ ] Command name is descriptive and kebab-case
- [ ] Description is concise and action-oriented (for `/help` output)
- [ ] Frontmatter includes `description` (required)
- [ ] Frontmatter includes `argument-hint` if applicable
- [ ] Has "What This Command Does" user-facing summary
- [ ] Has "Implementation Steps" with numbered sections

**Content:**

- [ ] Steps are numbered and clearly ordered
- [ ] Each step has specific, actionable instructions
- [ ] Tool usage is explicitly specified
- [ ] File checks are explicit (with code examples)
- [ ] Conditional logic uses clear if/else structure
- [ ] Anti-patterns are called out with "NEVER" or "DO NOT"
- [ ] Error handling is defined with specific actions
- [ ] Success criteria are clearly stated

**Writing Style:**

- [ ] Uses imperative/infinitive form (not second person)
- [ ] Specific, not vague ("Run make lint" not "Check for errors")
- [ ] Includes expected outcomes ("This should output...")
- [ ] Provides realistic examples (not foo/bar placeholders)

**Location:**

- [ ] Location (project vs global) is appropriate
- [ ] Directory exists or will be created
- [ ] File path is correct (`.claude/commands/` or `~/.claude/commands/`)

**Testing:**

- [ ] User knows how to invoke: `/command-name [arguments]`
- [ ] Command has been tested if possible
- [ ] Iterations incorporated user feedback

## Common Pitfalls

### 1. Vague Instructions

❌ **WRONG:**

```markdown
Fix any errors that appear
```

✅ **CORRECT:**

```markdown
If lint errors appear:

- Run `make fix` to auto-fix lint errors
- Run `make format` to fix formatting errors
- For manual fixes, use Edit tool to modify files
```

### 2. Missing Error Handling

❌ **WRONG:**

```markdown
Run make all-ci
Apply fixes
Done
```

✅ **CORRECT:**

```markdown
Run make all-ci

If exit code is 0:

- All checks passed, report success

If exit code is non-zero:

- Parse error output
- Apply targeted fixes
- Run again to verify
- Stop if same error appears 3 times
```

### 3. Ambiguous Conditionals

❌ **WRONG:**

```markdown
Check if file exists and do something
```

✅ **CORRECT:**

```markdown
Check if .PLAN.md exists:

If file exists:

- Read .PLAN.md for context
- Use plan summary in commit message

If file does not exist:

- Run git diff to analyze changes
- Create commit message from diff
```

### 4. Batch Operations

❌ **WRONG:**

```markdown
Fix all the errors, then mark all todos as completed
```

✅ **CORRECT:**

```markdown
For each error category:

1. Fix the errors in that category
2. Mark the todo as completed immediately
3. Move to next category

Do NOT batch todo completions at the end
```

### 5. Tool Confusion

❌ **WRONG:**

```markdown
Use an agent to run make
```

✅ **CORRECT:**

```markdown
Use Bash tool to run make commands:

\`\`\`bash
make all-ci
\`\`\`

DO NOT use Bash tool for make commands
```

### 6. Missing Context

❌ **WRONG:**

```markdown
Create a commit and submit PRs
```

✅ **CORRECT:**

```markdown
### 1. Check for Context Files

FIRST, check if .PLAN.md exists in repository root

### 2. Analyze Changes

- If .PLAN.md exists: read for context
- Otherwise: run git status and git diff HEAD

### 3. Create Commit

Based on context from step 1 and 2:

- Draft single-sentence commit message
- Check git log for repo style
- Create commit with git commit -m "message"

### 4. Submit PRs

Run: gt submit --stack --publish --no-edit
```

### 7. Poor Descriptions

❌ **WRONG:**

```yaml
---
description: A command that helps with CI stuff
---
```

✅ **CORRECT:**

```yaml
---
description: Run make all-ci and iteratively fix issues until all checks pass
---
```

The description appears in `/help` output - make it clear and action-oriented.

## Advanced Best Practices

### Multi-Step Verification

For complex workflows, verify each step:

```markdown
### 3. Create Commit

1. Stage changes:
   \`\`\`bash
   git add .
   \`\`\`

2. Verify staging:
   \`\`\`bash
   git status
   \`\`\`
   Should show files in "Changes to be committed"

3. Create commit:
   \`\`\`bash
   git commit -m "message"
   \`\`\`
   Should output "[branch-name abc1234] message"

4. Verify commit created:
   \`\`\`bash
   git log -1 --oneline
   \`\`\`
   Should show the new commit
```

### Iteration Control

For iterative commands, implement safeguards:

```markdown
## Iteration Control

**Maximum iterations**: 10 attempts

**Stuck detection logic:**

- Track errors seen in each iteration
- If same error appears 3 consecutive times: STOP
- If no progress after 5 iterations: STOP

**Stop immediately if:**

- Max iterations reached (10)
- Same error persists (3 times)
- Unrecoverable error encountered
```

### Context Gathering

For analysis-heavy commands, gather context systematically:

```markdown
## Context Gathering

Check these sources in order:

1. **Context files** (if they exist):
   - .PLAN.md - implementation plan
   - AGENTS.md - coding standards
   - CONTRIBUTING.md - contribution guidelines

2. **Git information**:
   - git status - current changes
   - git diff HEAD - actual diff
   - git log -5 --oneline - recent commits

3. **Project files** (if needed):
   - pyproject.toml - project config
   - Makefile - available commands
   - README.md - project overview

Stop gathering context once you have enough information - don't over-analyze.
```

### Output Formatting

Provide clear output format specifications:

```markdown
## Expected Output Format

After command completes, output should follow this format:

\`\`\`

## [Command Name] Results

**Status**: [SUCCESS/STUCK/ERROR]

**Actions Taken**:

1. [First action and result]
2. [Second action and result]
3. [Third action and result]

**Summary**:
[One sentence summary of what was accomplished]

**Next Steps**:
[What the user should do next, if applicable]
\`\`\`
```

## Summary

Effective slash commands:

1. **Use imperative form** (verb-first, not second person)
2. **Be specific** (not vague)
3. **Include outcomes** (what should happen)
4. **Provide examples** (realistic, not foo/bar)
5. **Specify tools** (Task tool with subagent_type)
6. **Call out anti-patterns** (NEVER/DO NOT)
7. **Define error handling** (explicit actions)
8. **State success criteria** (when to stop)
9. **Track progress** (TodoWrite for multi-step)
10. **Verify each step** (check results before proceeding)

Focus on creating commands that agents can execute autonomously without asking clarifying questions.
