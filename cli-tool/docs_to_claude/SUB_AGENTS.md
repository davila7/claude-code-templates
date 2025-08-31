# Sub agents

> Create and use specialized AI sub agents in Claude Code for task-specific workflows and improved context management.

Custom sub agents in Claude Code are specialized AI assistants that can be invoked to handle specific types of tasks. They enable more efficient problem-solving by providing task-specific configurations with customized system prompts, tools and a separate context window.

## What are sub agents?

Sub agents are pre-configured AI personalities that Claude Code can delegate tasks to. Each sub agent:

* Has a specific purpose and expertise area
* Uses its own context window separate from the main conversation
* Can be configured with specific tools it's allowed to use
* Includes a custom system prompt that guides its behavior

When Claude Code encounters a task that matches a sub agent's expertise, it can delegate that task to the specialized sub agent, which works independently and returns results.

## Key benefits

<CardGroup cols={2}>
  <Card title="Context preservation" icon="layer-group">
    Each sub agent operates in its own context, preventing pollution of the main conversation and keeping it focused on high-level objectives.
  </Card>

  <Card title="Specialized expertise" icon="brain">
    Sub agents can be fine-tuned with detailed instructions for specific domains, leading to higher success rates on designated tasks.
  </Card>

  <Card title="Reusability" icon="rotate">
    Once created, sub agents can be used across different projects and shared with your team for consistent workflows.
  </Card>

  <Card title="Flexible permissions" icon="shield-check">
    Each sub agent can have different tool access levels, allowing you to limit powerful tools to specific sub agent types.
  </Card>
</CardGroup>

## Quick start

To create your first sub agent:

<Steps>
  <Step title="Open the sub agents interface">
    Run the following command:

    ```
    /agents
    ```
  </Step>

  <Step title="Select 'Create New Agent'">
    Choose whether to create a project-level or user-level sub agent
  </Step>

  <Step title="Define the sub agent">
    * **Recommended**: Generate with Claude first, then customize to make it yours
    * Describe your subagent in detail and when it should be used
    * Select the tools you want to grant access to (or leave blank to inherit all tools)
    * The interface shows all available tools, making selection easy
    * If you're generating with Claude, you can also edit the system prompt in your own editor by pressing `e`
  </Step>

  <Step title="Save and use">
    Your sub agent is now available! Claude will use it automatically when appropriate, or you can invoke it explicitly:

    ```
    > Use the code-reviewer sub agent to check my recent changes
    ```
  </Step>
</Steps>

## Sub agent configuration

### File locations

Sub agents are stored as Markdown files with YAML frontmatter in two possible locations:

| Type                   | Location            | Scope                         | Priority |
| :--------------------- | :------------------ | :---------------------------- | :------- |
| **Project sub agents** | `.claude/agents/`   | Available in current project  | Highest  |
| **User sub agents**    | `~/.claude/agents/` | Available across all projects | Lower    |

When sub agent names conflict, project-level sub agents take precedence over user-level sub agents.

### File format

Each sub agent is defined in a Markdown file with this structure:

```markdown
---
name: your-sub-agent-name
description: Description of when this sub agent should be invoked
tools: tool1, tool2, tool3  # Optional - inherits all tools if omitted
---

Your sub agent's system prompt goes here. This can be multiple paragraphs
and should clearly define the sub agent's role, capabilities, and approach
to solving problems.

Include specific instructions, best practices, and any constraints
the sub agent should follow.
```

#### Configuration fields

| Field         | Required | Description                                                                                 |
| :------------ | :------- | :------------------------------------------------------------------------------------------ |
| `name`        | Yes      | Unique identifier using lowercase letters and hyphens                                       |
| `description` | Yes      | Natural language description of the sub agent's purpose                                     |
| `tools`       | No       | Comma-separated list of specific tools. If omitted, inherits all tools from the main thread |

### Available tools

Sub agents can be granted access to any of Claude Code's internal tools. See the [tools documentation](/en/docs/claude-code/settings#tools-available-to-claude) for a complete list of available tools.

<Tip>
  **Recommended:** Use the `/agents` command to modify tool access - it provides an interactive interface that lists all available tools, including any connected MCP server tools, making it easier to select the ones you need.
</Tip>

You have two options for configuring tools:

* **Omit the `tools` field** to inherit all tools from the main thread (default), including MCP tools
* **Specify individual tools** as a comma-separated list for more granular control (can be edited manually or via `/agents`)

**MCP Tools**: Sub agents can access MCP tools from configured MCP servers. When the `tools` field is omitted, sub agents inherit all MCP tools available to the main thread.

## Managing sub agents

### Using the /agents command (Recommended)

The `/agents` command provides a comprehensive interface for sub agent management:

```
/agents
```

This opens an interactive menu where you can:

* View all available sub agents (built-in, user, and project)
* Create new sub agents with guided setup
* Edit existing custom sub agents, including their tool access
* Delete custom sub agents
* See which sub agents are active when duplicates exist
* **Easily manage tool permissions** with a complete list of available tools

### Direct file management

You can also manage sub agents by working directly with their files:

```bash
# Create a project sub agent
mkdir -p .claude/agents
echo '---
name: test-runner
description: Use proactively to run tests and fix failures
---

You are a test automation expert. When you see code changes, proactively run the appropriate tests. If tests fail, analyze the failures and fix them while preserving the original test intent.' > .claude/agents/test-runner.md

# Create a user sub agent
mkdir -p ~/.claude/agents
# ... create sub agent file
```

## Using sub agents effectively

### Automatic delegation

Claude Code proactively delegates tasks based on:

* The task description in your request
* The `description` field in sub agent configurations
* Current context and available tools

<Tip>
  To encourage more proactive sub agent use, include phrases like "use PROACTIVELY" or "MUST BE USED" in your `description` field.
</Tip>

### Explicit invocation

Request a specific sub agent by mentioning it in your command:

```
> Use the test-runner sub agent to fix failing tests
> Have the code-reviewer sub agent look at my recent changes
> Ask the debugger sub agent to investigate this error
```

## Example sub agents

### Code reviewer

```markdown
---
name: code-reviewer
description: Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
---

You are a senior code reviewer ensuring high standards of code quality and security.

When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code is simple and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed

Provide feedback organized by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)

Include specific examples of how to fix issues.
```

### Debugger

```markdown
---
name: debugger
description: Debugging specialist for errors, test failures, and unexpected behavior. Use proactively when encountering any issues.
tools: Read, Edit, Bash, Grep, Glob
---

You are an expert debugger specializing in root cause analysis.

When invoked:
1. Capture error message and stack trace
2. Identify reproduction steps
3. Isolate the failure location
4. Implement minimal fix
5. Verify solution works

Debugging process:
- Analyze error messages and logs
- Check recent code changes
- Form and test hypotheses
- Add strategic debug logging
- Inspect variable states

For each issue, provide:
- Root cause explanation
- Evidence supporting the diagnosis
- Specific code fix
- Testing approach
- Prevention recommendations

Focus on fixing the underlying issue, not just symptoms.
```

### Data scientist

```markdown
---
name: data-scientist
description: Data analysis expert for SQL queries, BigQuery operations, and data insights. Use proactively for data analysis tasks and queries.
tools: Bash, Read, Write
---

You are a data scientist specializing in SQL and BigQuery analysis.

When invoked:
1. Understand the data analysis requirement
2. Write efficient SQL queries
3. Use BigQuery command line tools (bq) when appropriate
4. Analyze and summarize results
5. Present findings clearly

Key practices:
- Write optimized SQL queries with proper filters
- Use appropriate aggregations and joins
- Include comments explaining complex logic
- Format results for readability
- Provide data-driven recommendations

For each analysis:
- Explain the query approach
- Document any assumptions
- Highlight key findings
- Suggest next steps based on data

Always ensure queries are efficient and cost-effective.
```

## Best practices

* **Start with Claude-generated agents**: We highly recommend generating your initial sub agent with Claude and then iterating on it to make it personally yours. This approach gives you the best results - a solid foundation that you can customize to your specific needs.

* **Design focused sub agents**: Create sub agents with single, clear responsibilities rather than trying to make one sub agent do everything. This improves performance and makes sub agents more predictable.

* **Write detailed prompts**: Include specific instructions, examples, and constraints in your system prompts. The more guidance you provide, the better the sub agent will perform.

* **Limit tool access**: Only grant tools that are necessary for the sub agent's purpose. This improves security and helps the sub agent focus on relevant actions.

* **Version control**: Check project sub agents into version control so your team can benefit from and improve them collaboratively.

## Advanced usage

### Chaining sub agents

For complex workflows, you can chain multiple sub agents:

```
> First use the code-analyzer sub agent to find performance issues, then use the optimizer sub agent to fix them
```

### Dynamic sub agent selection

Claude Code intelligently selects sub agents based on context. Make your `description` fields specific and action-oriented for best results.

## Performance considerations

* **Context efficiency**: Agents help preserve main context, enabling longer overall sessions
* **Latency**: Sub agents start off with a clean slate each time they are invoked and may add latency as they gather context that they require to do their job effectively.

## Related documentation

* [Slash commands](/en/docs/claude-code/slash-commands) - Learn about other built-in commands
* [Settings](/en/docs/claude-code/settings) - Configure Claude Code behavior
* [Hooks](/en/docs/claude-code/hooks) - Automate workflows with event handlers
