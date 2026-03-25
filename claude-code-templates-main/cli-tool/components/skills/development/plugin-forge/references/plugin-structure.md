# Plugin Structure Reference

## Directory Hierarchy

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Required: Plugin metadata manifest
├── commands/                 # Optional: Custom slash commands
├── agents/                   # Optional: Agent definitions
├── skills/                   # Optional: Agent Skills
│   └── skill-name/
│       ├── SKILL.md         # Required for each skill
│       ├── scripts/         # Optional: Executable code
│       ├── references/      # Optional: Documentation
│       └── assets/          # Optional: Output files
├── hooks/                    # Optional: Event handlers
│   └── hooks.json
└── .mcp.json                # Optional: MCP server integrations
```

## Plugin Manifest (`plugin.json`)

**Location:** `.claude-plugin/plugin.json` (must be in this directory)

**Required fields:**

- `name`: Unique identifier (kebab-case)

**Standard metadata:**

- `version`: Semantic versioning (e.g., "1.0.0")
- `description`: Plugin purpose
- `author`: Object with name, email, url
- `homepage`: URL
- `repository`: URL
- `license`: SPDX identifier
- `keywords`: Array of search terms

**Component paths (optional):**

- `commands`: Path to commands directory
- `agents`: Path to agents directory
- `hooks`: Path to hooks configuration
- `mcpServers`: Path to MCP configuration

### Example plugin.json

```json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "Example plugin for demonstration",
  "author": {
    "name": "Plugin Creator",
    "email": "creator@example.com"
  },
  "keywords": ["example", "demo"]
}
```

## Component Types

### Commands

**Location:** `commands/` directory
**Format:** Markdown files with frontmatter
**Naming:** Subdirectories create namespaces via `:`

```
commands/
├── simple.md              # Invoked as /simple
└── namespace/
    └── command.md         # Invoked as /namespace:command
```

### Agents

**Location:** `agents/` directory
**Format:** Markdown files describing agent capabilities

### Skills

**Location:** `skills/` directory
**Format:** Subdirectories with `SKILL.md` file
**Structure:** See skills documentation

### Hooks

**Location:** `hooks/hooks.json` or path specified in manifest
**Events:** PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop, SubagentStop, SessionStart, SessionEnd, PreCompact

### MCP Servers

**Location:** `.mcp.json` at plugin root
**Purpose:** External tool integrations

## Path Requirements

- All paths relative to plugin root
- Start with `./` for custom paths
- Use `${CLAUDE_PLUGIN_ROOT}` for dynamic resolution in hooks/MCP
- Components must be at plugin root, not inside `.claude-plugin/`
