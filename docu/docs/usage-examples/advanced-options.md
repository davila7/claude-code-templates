---
sidebar_position: 3
---

# Advanced Options

`claude-code-templates` provides several advanced command-line options for more granular control over its behavior.

## Template and Component Installation

```bash
# Modern template installation (recommended)
npx claude-code-templates@latest --template=react --yes
npx claude-code-templates@latest --template=python --yes

# Individual component installation
npx claude-code-templates@latest --agent=react-performance --yes
npx claude-code-templates@latest --command=check-file --yes
npx claude-code-templates@latest --mcp=github-integration --yes

# Legacy syntax (still supported but deprecated)
npx claude-code-templates@latest --language=javascript-typescript --framework=react --yes
```

## Installation Control Options

```bash
# Preview installation without making changes
npx claude-code-templates@latest --dry-run

# Skip all prompts and use defaults
npx claude-code-templates@latest --yes

# Install to custom directory
npx claude-code-templates@latest --directory /path/to/project
```

## System Analysis and Monitoring

```bash
# Run comprehensive system health check
npx claude-code-templates@latest --health-check
npx claude-code-templates@latest --health
npx claude-code-templates@latest --check
npx claude-code-templates@latest --verify

# Analyze existing commands 
npx claude-code-templates@latest --commands-stats

# Analyze automation hooks
npx claude-code-templates@latest --hooks-stats

# Analyze MCP server configurations 
npx claude-code-templates@latest --mcps-stats

# Launch real-time analytics dashboard
npx claude-code-templates@latest --analytics
npx cct --analytics
```

## Component-Specific Examples

### Installing Multiple Components
```bash
# Install multiple components in sequence
npx claude-code-templates@latest --agent=react-performance --yes
npx claude-code-templates@latest --command=check-file --yes
npx claude-code-templates@latest --mcp=github-integration --yes
```

### Combining with Analysis
```bash
# Install component and run stats
npx claude-code-templates@latest --template=react --yes
npx claude-code-templates@latest --commands-stats
```

## GitHub Download System

All installations now use the GitHub download system:

- **Real-time Downloads**: Always get the latest versions from GitHub
- **Caching**: Downloaded files are cached for better performance  
- **Transparency**: All download URLs are visible during installation
- **Repository Structure**: Templates from `templates/`, components from `components/`

For a complete list of options and their descriptions, refer to the [CLI Options](/docs/cli-options) documentation.
