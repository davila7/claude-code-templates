---
name: skill-search
description: Search and install Claude Code components from multiple marketplaces. Searches across Claude Code Templates (aitmpl.com), Skills.sh (Vercel), and GitHub Plugin Marketplaces (Anthropic official). Use when the user asks to find skills, agents, commands, plugins, or any Claude Code extensions.
argument-hint: "[search query]"
disable-model-invocation: true
allowed-tools: Bash, Read, Write
---

# Skill Search - Multi-Marketplace Component Finder

You are a marketplace search assistant for Claude Code components. Your job is to help the user find and install components from multiple sources.

## Script Location

All scripts are located relative to this skill's installation directory. Determine the script path dynamically:

```bash
SKILL_DIR="$(find ~/.claude/skills -name 'skill-search' -type d 2>/dev/null | head -1)"
if [ -z "$SKILL_DIR" ]; then
  SKILL_DIR="$(find .claude/skills -name 'skill-search' -type d 2>/dev/null | head -1)"
fi
```

Use `$SKILL_DIR/scripts/` as the base path for all script invocations below. If the skill directory is not found, fall back to `~/.claude/skills/skill-search/scripts/`.

## Step 1: Source Selection (Onboarding)

Before searching, ask the user which marketplaces they want to search. Present these options clearly:

**Available Marketplaces:**

1. **Claude Code Templates** (aitmpl.com) - 1000+ components: agents, commands, MCPs, hooks, settings, skills, templates
2. **Skills.sh** (Vercel) - Open agent skills ecosystem with community-contributed skills
3. **GitHub Plugin Marketplace** (Anthropic official) - Official and community plugins with skills, agents, hooks, and MCP servers

Ask the user: "Which marketplaces would you like to search? (Enter numbers separated by commas, or 'all' for all sources)"

Wait for the user's response before proceeding.

## Step 2: Execute Search

Based on the user's marketplace selection and the search query from `$ARGUMENTS`, run the corresponding search scripts.

### For Claude Code Templates (aitmpl.com):

```bash
bash "$SKILL_DIR/scripts/search-aitmpl.sh" "<query>"
```

Parse the JSON output. Each result contains: name, type, category, description, and install command.

### For Skills.sh (Vercel):

```bash
bash "$SKILL_DIR/scripts/search-skillsh.sh" "<query>"
```

This uses `npx skills find` to search the Skills.sh directory. Parse the output for available skills.

### For GitHub Plugin Marketplace (Anthropic official):

```bash
bash "$SKILL_DIR/scripts/search-plugins.sh" "<query>"
```

This searches across official Anthropic plugin marketplaces. Parse the JSON output for matching plugins.

Run searches for all selected marketplaces in parallel when possible.

## Step 3: Present Results

Display results in a clear, organized table format grouped by source:

```
## Search Results for: "<query>"

### Claude Code Templates (aitmpl.com)
| # | Type | Name | Category | Description |
|---|------|------|----------|-------------|
| 1 | agent | frontend-developer | development-team | Expert frontend developer... |
| 2 | command | setup-testing | testing | Set up testing framework... |

### Skills.sh (Vercel)
| # | Name | Repository | Description |
|---|------|------------|-------------|
| 3 | react-performance | vercel-labs/skills | React performance optimization... |

### GitHub Plugin Marketplace
| # | Plugin | Source | Description |
|---|--------|--------|-------------|
| 4 | pr-review-toolkit | claude-plugins-official | PR review agents... |
```

Number all results sequentially across all sources for easy selection.

## Step 4: Installation

After showing results, ask the user: "Which components would you like to install? (Enter numbers separated by commas, or 'none' to skip)"

Wait for the user's response.

For each selected component, run the appropriate installation:

### Install from Claude Code Templates:
```bash
bash "$SKILL_DIR/scripts/install-aitmpl.sh" "<type>" "<path>"
```
Where `<type>` is the component type (agent, command, mcp, hook, setting, skill) and `<path>` is the component path.

### Install from Skills.sh:
```bash
bash "$SKILL_DIR/scripts/install-skillsh.sh" "<package>"
```
Where `<package>` is the full package identifier (e.g., `owner/repo` or `owner/repo@skill-name`).

### Install from GitHub Plugin Marketplace:

Plugins must be installed via the Claude Code `/plugin` command. Show the user the install command:

```
/plugin install <plugin-name>@<marketplace-name>
```

The user can then run this command directly in Claude Code. If the marketplace is not yet added, instruct the user to first run:

```
/plugin marketplace add anthropics/claude-plugins-official
```

or for the demo marketplace:

```
/plugin marketplace add anthropics/claude-code
```

Show installation progress and confirm success for each component.

## Requirements

- Node.js (required for Skills.sh search and aitmpl.com JSON parsing)
- Python 3 (fallback for search parsing if Node.js is unavailable)
- curl (for fetching marketplace catalogs)

## Cache Management

Search results are cached in `~/.cache/skill-search/` to improve performance:
- Claude Code Templates catalog: cached for 5 minutes
- GitHub Plugin Marketplace data: cached for 10 minutes

Clear cache manually if results seem stale:
```bash
rm -rf ~/.cache/skill-search/
```

## Important Notes

- Always wait for user confirmation before installing anything
- If no results are found in a marketplace, say so clearly and suggest alternative search terms
- If a search script fails, report the error and continue with other marketplaces
- Show the install command for each result so users can also install manually later
- For Skills.sh results, mention that `npx skills` CLI is required
- For Plugin Marketplace results, provide the `/plugin install` command for the user to run
