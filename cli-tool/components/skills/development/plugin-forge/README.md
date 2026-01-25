# CC Plugin Forge

A comprehensive skill for building and managing Claude Code plugins with proper structure, manifests, and marketplace integration.

## Purpose

Plugin Forge streamlines the entire lifecycle of Claude Code plugin development. It provides automation scripts, reference documentation, and structured workflows to help you create professional-quality plugins that integrate seamlessly with the Claude Code plugin ecosystem.

Whether you're building a framework-specific plugin for React or Vue, a utility plugin for common tasks, or a domain-specific knowledge plugin, Plugin Forge guides you through the correct structure and patterns.

## When to Use

Use this skill when you need to:

- **Create new plugins** - "Create a new Claude Code plugin for my project"
- **Add plugin components** - "Add a new command to my plugin", "Create a skill for this plugin"
- **Manage versions** - "Bump the plugin version", "Update plugin to 2.0.0"
- **Work with manifests** - "Update plugin.json", "Register plugin in marketplace"
- **Set up local testing** - "Test my plugin locally", "Install plugin for development"
- **Publish plugins** - "Publish plugin to marketplace", "Distribute my plugin"

**Trigger phrases:**
- "Create a Claude Code plugin"
- "Build a plugin for marketplace"
- "Add command/skill/agent/hook to plugin"
- "Bump plugin version"
- "Update plugin.json"
- "Set up plugin testing"

## How It Works

### Plugin Creation Flow

1. **Scaffold Structure** - The `create_plugin.py` script generates the correct directory hierarchy with all required files
2. **Generate Manifests** - Creates `plugin.json` with metadata and updates `marketplace.json` with the plugin entry
3. **Create Templates** - Generates a README template for your plugin documentation
4. **Guide Next Steps** - Provides instructions for adding components and testing

### Version Management Flow

1. **Parse Current Version** - Reads version from `plugin.json`
2. **Calculate New Version** - Applies semantic versioning rules (major/minor/patch)
3. **Sync Both Manifests** - Updates version in both `plugin.json` and `marketplace.json`
4. **Confirm Success** - Reports the version change

## Key Features

### Automation Scripts

| Script | Purpose |
|--------|---------|
| `create_plugin.py` | Scaffold new plugins with complete structure and manifests |
| `bump_version.py` | Update versions across all manifest files consistently |

### Reference Documentation

| Document | Content |
|----------|---------|
| `plugin-structure.md` | Directory hierarchy, manifest schema, component types |
| `marketplace-schema.md` | Marketplace format, plugin entries, source specifications |
| `workflows.md` | Development workflows, testing patterns, publishing guide |

### Plugin Patterns

- **Framework Plugin** - For framework-specific guidance (React, Vue, Nuxt)
- **Utility Plugin** - For tools and command collections
- **Domain Plugin** - For domain-specific knowledge with scripts

### Component Support

| Component | Location | Format |
|-----------|----------|--------|
| Commands | `commands/` | Markdown with frontmatter |
| Skills | `skills/<name>/` | Directory with `SKILL.md` |
| Agents | `agents/` | Markdown definitions |
| Hooks | `hooks/hooks.json` | Event handlers |
| MCP Servers | `.mcp.json` | External integrations |

## Usage Examples

### Create a New Plugin

```bash
python scripts/create_plugin.py my-awesome-plugin \
  --marketplace-root /path/to/marketplace \
  --author-name "Your Name" \
  --author-email "you@example.com" \
  --description "A plugin that does awesome things" \
  --keywords "awesome,utility,productivity" \
  --category "productivity"
```

This creates:
```
plugins/my-awesome-plugin/
├── .claude-plugin/
│   └── plugin.json
├── commands/
├── skills/
└── README.md
```

### Bump Version

```bash
# Patch bump (bug fixes): 1.0.0 → 1.0.1
python scripts/bump_version.py my-plugin patch --marketplace-root /path/to/marketplace

# Minor bump (new features): 1.0.0 → 1.1.0
python scripts/bump_version.py my-plugin minor --marketplace-root /path/to/marketplace

# Major bump (breaking changes): 1.0.0 → 2.0.0
python scripts/bump_version.py my-plugin major --marketplace-root /path/to/marketplace
```

### Local Testing

```bash
# Add your marketplace
/plugin marketplace add /path/to/marketplace-root

# Install the plugin
/plugin install my-plugin@marketplace-name

# After making changes, reinstall
/plugin uninstall my-plugin@marketplace-name
/plugin install my-plugin@marketplace-name
```

### Create Command with Namespace

Create `commands/docs/generate.md` to get `/docs:generate` command:

```markdown
---
description: Generate documentation for the current project
---

# Generate Documentation

Instructions for the command...
```

## Prerequisites

- **Python 3.10+** - Required for running automation scripts
- **Existing Marketplace** - A marketplace with `.claude-plugin/marketplace.json` must exist before creating plugins
- **Claude Code** - For testing and using plugins

## Output

### create_plugin.py Output

```
✅ Created plugin manifest: plugins/my-plugin/.claude-plugin/plugin.json
✅ Created README: plugins/my-plugin/README.md
✅ Updated marketplace manifest: .claude-plugin/marketplace.json

🎉 Plugin 'my-plugin' created successfully!

Next steps:
1. Add commands to: plugins/my-plugin/commands
2. Add skills to: plugins/my-plugin/skills
3. Test with: /plugin install my-plugin@marketplace-name
```

### bump_version.py Output

```
✅ Updated plugin.json: 1.0.0 → 1.1.0
✅ Updated marketplace.json: 1.0.0 → 1.1.0

🎉 Version bumped successfully: 1.0.0 → 1.1.0
```

## Best Practices

### Naming Conventions

- **Plugin names**: Use `kebab-case` (e.g., `vue-components`, `api-testing`)
- **Command files**: Use `kebab-case.md` (e.g., `generate-docs.md`)
- **Command namespaces**: Use subdirectories for grouping (e.g., `commands/prime/vue.md` becomes `/prime:vue`)

### Version Management

- Always use semantic versioning
- **Major (x.0.0)**: Breaking changes that require user action
- **Minor (0.x.0)**: New features, significant refactoring
- **Patch (0.0.x)**: Bug fixes, documentation updates
- Always bump versions in both `plugin.json` and `marketplace.json` - use `bump_version.py` to automate this

### Plugin Structure

- Keep the plugin manifest in `.claude-plugin/plugin.json` (required location)
- Place components at the plugin root, not inside `.claude-plugin/`
- Use `${CLAUDE_PLUGIN_ROOT}` for dynamic path resolution in hooks and MCP configs

### Git Commits

Use conventional commits for clear history:
```bash
git commit -m "feat: add new plugin"
git commit -m "fix: correct plugin manifest"
git commit -m "docs: update plugin README"
git commit -m "feat!: breaking change"
```

### Testing

- Always test locally before publishing
- Restart Claude Code after reinstalling to ensure changes take effect
- Claude Code caches plugin files, so reinstallation is needed for updates

## Plugin Directory Structure Reference

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Required: Plugin metadata manifest
├── commands/                 # Optional: Custom slash commands
│   ├── simple.md            # → /simple
│   └── namespace/
│       └── action.md        # → /namespace:action
├── agents/                   # Optional: Agent definitions
├── skills/                   # Optional: Agent Skills
│   └── skill-name/
│       ├── SKILL.md         # Required for each skill
│       ├── scripts/         # Optional: Executable code
│       ├── references/      # Optional: Documentation
│       └── assets/          # Optional: Output files
├── hooks/                    # Optional: Event handlers
│   └── hooks.json
├── .mcp.json                # Optional: MCP server integrations
└── README.md                # Recommended: Plugin documentation
```

## Troubleshooting

### Plugin directory already exists

The `create_plugin.py` script will not overwrite existing plugins. Either:
- Delete the existing directory if you want to start fresh
- Manually update the existing plugin

### Plugin not found in marketplace manifest

When using `bump_version.py`, ensure:
- The plugin name matches exactly (case-sensitive)
- The plugin entry exists in `.claude-plugin/marketplace.json`

### Changes not taking effect after reinstall

Claude Code caches plugin files. After reinstalling:
1. Restart Claude Code completely
2. Verify the plugin is listed with `/plugin list`

### Marketplace manifest not found

Ensure you're running scripts from the correct directory or provide the full path with `--marketplace-root`.
