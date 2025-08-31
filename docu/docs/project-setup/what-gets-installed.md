---
sidebar_position: 3
---

# What Gets Installed

When you use `claude-code-templates` to set up your project, it installs several core files and configurations to integrate Claude Code effectively into your development environment. You can choose between **complete templates** (comprehensive project setup) or **individual components** (selective functionality).

## Installation Methods

### Complete Template Installation
For comprehensive project setup with all recommended components:

```bash
# Interactive setup (recommended)
npx claude-code-templates@latest

# Modern template installation (preferred)
npx claude-code-templates@latest --template=react --yes
npx claude-code-templates@latest --template=python --yes
npx claude-code-templates@latest --template=nodejs --yes

# Legacy syntax (still supported but deprecated)
npx claude-code-templates@latest --language=javascript-typescript --framework=react
```

### Individual Component Installation
For selective component installation using **dedicated CLI parameters**:

#### Agents (🤖)
Install specialized AI assistants using the `--agent` parameter:

```bash
# Install specific agents
npx claude-code-templates@latest --agent=react-performance --yes
npx claude-code-templates@latest --agent=api-security-audit --yes
npx claude-code-templates@latest --agent=database-optimization --yes
```

**Available agents include:**
- React Performance Optimization Agent
- API Security Audit Agent  
- Database Optimization Agent
- And more framework-specific agents

#### Commands (⚡)
Install custom slash commands using the `--command` parameter:

```bash
# Install specific commands
npx claude-code-templates@latest --command=check-file --yes
npx claude-code-templates@latest --command=generate-tests --yes
npx claude-code-templates@latest --command=optimize-imports --yes
```

**Manual installation (alternative method):**
```bash
# Create commands directory
mkdir -p .claude/commands

# Install specific commands via direct download
curl -o .claude/commands/check-file.md \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/commands/check-file.md
```

#### MCPs (🔌)
Install Model Context Protocol integrations using the `--mcp` parameter:

```bash
# Install specific MCPs
npx claude-code-templates@latest --mcp=github-integration --yes
npx claude-code-templates@latest --mcp=database-integration --yes
npx claude-code-templates@latest --mcp=deepgraph-react --yes
```

**Manual installation (alternative method):**
```bash
# GitHub integration
curl -o ./github-integration.json \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/mcps/github-integration.json
```

## Core Files Installed

### Complete Template Installation Files

-   **`CLAUDE.md`**: This is the main configuration file for Claude Code, containing language-specific best practices and instructions.
-   **`.claude/settings.json`**: This file stores automation hooks and general Claude Code settings.
-   **`.claude/commands/`**: This directory contains custom commands tailored for common development tasks within your project.
-   **`.mcp.json`**: This file holds Model Context Protocol (MCP) server configurations, extending Claude Code's capabilities.

### Individual Component Files

#### Agent Files
- **Embedded in `CLAUDE.md`**: Agent configurations are integrated into the main Claude Code configuration file
- **Specialized prompts**: Domain-specific instructions for focused AI assistance

#### Command Files
- **`.claude/commands/*.md`**: Individual command files in Markdown format
- **Custom slash commands**: Extend Claude Code with project-specific functionality

#### MCP Files
- **`*.json`**: MCP configuration files for external service integrations
- **Authentication configs**: Secure connection settings for external services

## Templates vs Individual Components

### Complete Templates (`--template`)
**Full project setup with comprehensive configuration**

```bash
# Downloads complete template with multiple components
npx claude-code-templates@latest --template=react --yes
```

**Use Templates When:**
- ✅ Setting up a new project from scratch
- ✅ You want a comprehensive, tested configuration
- ✅ You're new to Claude Code and want everything configured properly
- ✅ You prefer opinionated setups with best practices included

### Individual Components (`--agent`, `--command`, `--mcp`)
**Selective installation of specific functionality**

```bash
# Downloads individual components to specific locations
npx claude-code-templates@latest --agent=react-performance --yes
npx claude-code-templates@latest --command=check-file --yes
npx claude-code-templates@latest --mcp=github-integration --yes
```

**Use Individual Components When:**
- ✅ You have an existing Claude Code setup to enhance
- ✅ You only need specific functionality (e.g., just GitHub integration)
- ✅ You want to gradually add capabilities to your workflow
- ✅ You're experimenting with new tools and integrations
- ✅ You have custom requirements that don't match standard templates

## GitHub Download System

All templates and components are now downloaded directly from GitHub in real-time:

- **Templates**: Downloaded from `templates/` directory
- **Components**: Downloaded from `components/` directory
  - Agents: `components/agents/`
  - Commands: `components/commands/`
  - MCPs: `components/mcps/`
- **Caching**: Downloaded files are cached for performance
- **Transparency**: All download URLs are visible during installation
- **Latest Versions**: Always get the most up-to-date components

## Component Discovery

You can discover and install components through:

1. **CLI Parameters**: Use dedicated parameters (`--agent`, `--command`, `--mcp`, `--template`)
2. **Web Interface**: Visit the [unified component browser](https://davila7.github.io/claude-code-templates/) to explore all available templates and components
3. **Interactive CLI**: Run `npx claude-code-templates@latest` and select "⚙️ Project Setup"
4. **GitHub Repository**: Browse components directly in the [repository structure](https://github.com/davila7/claude-code-templates)

## Installation Paths

Components are installed to specific locations based on their type:

| Component Type | CLI Parameter | Installation Path | Example |
|----------------|---------------|-------------------|----------|
| **Template** | `--template=name` | Multiple files | Full project setup |
| **Agent** | `--agent=name` | `.claude/agents/` | Embedded in CLAUDE.md |
| **Command** | `--command=name` | `.claude/commands/` | `.claude/commands/name.md` |
| **MCP** | `--mcp=name` | `.mcp.json` | MCP configuration |

For detailed information about each component type, see:
- [Individual Components Overview](../components/overview)
- [Agents Documentation](../components/agents)
- [Commands Documentation](../components/commands)
- [MCPs Documentation](../components/mcps)
