---
sidebar_position: 2
---

# Framework-Specific Setup

While the interactive setup is recommended, you can also quickly configure `claude-code-templates` for specific templates using the modern `--template` parameter or legacy `--language`/`--framework` commands.

## Modern Template Installation (Recommended)

Use the new `--template` parameter for streamlined template installation:

```bash
# React project with all components
npx claude-code-templates@latest --template=react --yes

# Python project with all components
npx claude-code-templates@latest --template=python --yes

# Node.js project with all components
npx claude-code-templates@latest --template=nodejs --yes

# Vue.js project with all components
npx claude-code-templates@latest --template=vue --yes

# Django project with all components
npx claude-code-templates@latest --template=django --yes
```

## Legacy Syntax (Still Supported)

The original `--language` and `--framework` flags are still supported but deprecated:

```bash
# React + TypeScript project (legacy)
npx claude-code-templates@latest --language=javascript-typescript --framework=react --yes

# Python + Django project (legacy)
npx claude-code-templates@latest --language=python --framework=django --yes
```

**Note**: These legacy parameters will continue to work but using `--template` is preferred for new installations.

The `--yes` flag will skip all prompts and use default configurations, making the setup process fully automated.

## Interactive Setup (Recommended)

Even when you know your framework, running the tool without specific flags is often the best approach:

```bash
cd my-react-app
npx claude-code-templates@latest
# The tool will auto-detect React and suggest optimal configuration
```

This method allows the tool to intelligently detect your project's environment and offer tailored suggestions, ensuring the best possible setup for your Claude Code workflow.

## Template vs Component Installation

### Complete Templates (`--template`)
- Downloads complete project configuration from `templates/` directory
- Includes CLAUDE.md, agents, commands, and MCP configurations
- Best for new project setups

### Individual Components
You can also install individual components instead of complete templates:

```bash
# Install specific agent
npx claude-code-templates@latest --agent=react-performance --yes

# Install specific command
npx claude-code-templates@latest --command=check-file --yes

# Install specific MCP
npx claude-code-templates@latest --mcp=github-integration --yes
```

## GitHub Download System

All templates and components are now downloaded directly from GitHub:

- **Real-time Downloads**: Always get the latest versions
- **Transparent URLs**: See exactly what files are being downloaded
- **Caching**: Downloaded files are cached for better performance
- **Repository Structure**: Templates in `templates/`, components in `components/`
