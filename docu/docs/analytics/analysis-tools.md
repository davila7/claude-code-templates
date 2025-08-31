---
sidebar_position: 4
---

# Analysis Tools

The `claude-code-templates` CLI provides dedicated analysis tools to help you understand and optimize your existing Claude Code configurations. These tools offer insights into your commands, automation hooks, and MCP server configurations.

## Command Analysis

View detailed statistics about your custom commands:

```bash
npx claude-code-templates --commands-stats
```

**What you get:**

-   Command name, file size, and token count
-   Lines, words, and last modified date
-   AI-powered optimization recommendations
-   Project-specific improvement suggestions

## Hook Analysis

Analyze your automation hooks configuration:

```bash
npx claude-code-templates --hooks-stats
```

**What you get:**

-   Hook name, type, and status (enabled/disabled)
-   Hook descriptions and purpose
-   Hook summary by type (PreToolUse, PostToolUse, etc.)
-   AI-powered hook optimization suggestions
-   Missing hook recommendations for your workflow

## MCP Server Analysis

Analyze your MCP server configurations:

```bash
npx claude-code-templates --mcps-stats
```

**What you get:**

-   Server name, category, and status (enabled/disabled)
-   Command, complexity rating, and descriptions
-   Server summary by category (IDE, Database, Web, etc.)
-   AI-powered MCP configuration optimization
-   Missing server recommendations for your workflow
