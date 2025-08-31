---
sidebar_position: 1
---

# CLI Options Reference

This section provides a comprehensive reference of all available command-line options for `claude-code-templates`.

## Template and Component Options

| Option | Description | Example |
|--------|-------------|---------|
| `--template` | **[PREFERRED]** Specify template to install | `--template=python`, `--template=react` |
| `--agent` | Install individual agent component | `--agent=react-performance` |
| `--command` | Install individual command component | `--command=check-file` |
| `--mcp` | Install individual MCP component | `--mcp=github-integration` |

## Legacy Options (Deprecated)

| Option | Description | Example | Status |
|--------|-------------|---------|---------|
| `-l, --language` | Specify programming language | `--language python` | ⚠️ **Deprecated** - Use `--template` instead |
| `-f, --framework` | Specify framework | `--framework react` | ⚠️ **Deprecated** - Use `--template` instead |

## General Options

| Option | Description | Example |
|--------|-------------|---------|
| `-d, --directory` | Target directory | `--directory /path/to/project` |
| `-y, --yes` | Skip prompts and use defaults | `--yes` |
| `--dry-run` | Show what would be installed | `--dry-run` |

## Analysis and Monitoring Options

| Option | Description | Example |
|--------|-------------|---------|
| `--health-check` | Run comprehensive system validation | `--health-check` |
| `--command-stats, --commands-stats` | Analyze existing commands | `--command-stats` |
| `--hook-stats, --hooks-stats` | Analyze automation hooks | `--hook-stats` |
| `--mcp-stats, --mcps-stats` | Analyze MCP server configurations | `--mcp-stats` |
| `--analytics` | Launch real-time analytics dashboard | `--analytics` |

## Help and Information

| Option | Description | Example |
|--------|-------------|---------|
| `--help` | Show help information | `--help` |

## Usage Examples

### Modern Template Installation (Recommended)
```bash
# Install React template with all components
npx claude-code-templates@latest --template=react --yes

# Install Python template with all components
npx claude-code-templates@latest --template=python --yes

# Install Node.js template with all components
npx claude-code-templates@latest --template=nodejs --yes
```

### Individual Component Installation
```bash
# Install specific agent
npx claude-code-templates@latest --agent=react-performance --yes

# Install specific command
npx claude-code-templates@latest --command=check-file --yes

# Install specific MCP
npx claude-code-templates@latest --mcp=github-integration --yes
```

### Legacy Syntax (Still Supported)
```bash
# Old syntax - still works but deprecated
npx claude-code-templates@latest --language=javascript-typescript --framework=react --yes
```

## GitHub Download System

All templates and components are now downloaded directly from GitHub in real-time:

- **Templates**: Downloaded from `templates/` directory
- **Components**: Downloaded from `components/` directory (agents, commands, MCPs)
- **Caching**: Downloaded files are cached for performance
- **Transparency**: All download URLs are visible during installation

This ensures you always get the latest versions and provides complete transparency about what is being installed.
