---
name: enhance-setup
description: Analyze Claude Code setup and recommend optimizations based on latest changelog
author: Community contribution
license: MIT
category: analysis
tools: Bash, WebFetch
model: sonnet
---

# Claude Code Setup Analyzer

Analyzes your Claude Code configuration against the latest changelog and recommends optimizations for token usage, feature adoption, and setup improvements.

## What This Command Does

1. Fetches the latest Claude Code changelog from GitHub
2. Analyzes your token usage and identifies hidden drains
3. Groups agents by domain to find consolidation opportunities
4. Detects overlap between custom and plugin agents
5. Checks configuration for new features and best practices
6. Generates a prioritized report with actionable recommendations

---

## Step 0: Request Context Data

**Ask the user for their `/context` output:**

> Please run `/context` and share the output (especially the Memory files section) so I can see your accurate token usage.

Parse the response for:
- Memory files and their token counts
- Total usage by category
- Any unexpected files loading

If not provided, proceed with estimates and note the limitation.

---

## Step 1: Version and Changelog

```bash
claude --version 2>/dev/null || echo "Version unknown"
```

Fetch the latest changelog:
- URL: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
- Use WebFetch to analyze the last 3-5 releases
- Look for: new features, configuration options, deprecations, breaking changes

---

## Step 2: Token Usage Analysis

### 2.1 Rules Directory Check

The `~/.claude/rules/` directory loads ALL `.md` files including subdirectories. This is a common source of token waste.

```bash
echo "=== Rules Directory Analysis ==="
rules_count=$(find ~/.claude/rules -name '*.md' -type f 2>/dev/null | wc -l)
if [ "$rules_count" -gt 0 ]; then
  echo "🔴 WARNING: $rules_count .md files in ~/.claude/rules/ will load every prompt:"
  find ~/.claude/rules -name '*.md' -type f 2>/dev/null
  echo ""
  echo "Fix: Move unwanted files outside ~/.claude/rules/"
else
  echo "✓ Rules directory is clean"
fi
```

### 2.2 Agent Analysis

Agents always load into context. Group them by domain to identify consolidation opportunities.

```bash
echo "=== Agent Analysis ==="
agent_count=$(find ~/.claude/agents -name '*.md' -not -path '*/_archived/*' 2>/dev/null | wc -l)
echo "Active agents: $agent_count (all load every prompt)"

agent_bytes=$(find ~/.claude/agents -name '*.md' -not -path '*/_archived/*' -exec cat {} \; 2>/dev/null | wc -c)
echo "Estimated tokens: ~$((agent_bytes/4))"

agents=$(find ~/.claude/agents -name '*.md' -not -path '*/_archived/*' -exec basename {} .md \; 2>/dev/null | sort)

# Domain patterns
db='supabase|database|db|postgres|redis|mongo'
test='test|qa|quality|spec'
security='security|audit|vuln|pentest'
devops='devops|deploy|cicd|docker|k8s|kubernetes|aws|gcp|azure'
frontend='frontend|react|vue|angular|ui|ux|css'
backend='backend|api|express|node|server'
review='review|architect|design'
ai='ai|llm|ml|langchain|prompt'
error='error|debug|fix|troubleshoot'

echo ""
echo "=== Agent Domain Grouping ==="

for domain in "Database:$db" "Testing:$test" "Security:$security" "DevOps:$devops" \
              "Frontend:$frontend" "Backend:$backend" "Review:$review" "AI/ML:$ai" "Errors:$error"; do
  name="${domain%%:*}"
  pattern="${domain#*:}"
  matches=$(echo "$agents" | grep -iE "$pattern" 2>/dev/null)
  echo ""
  echo "$name:"
  if [ -n "$matches" ]; then
    echo "$matches" | sed 's/^/  /'
  else
    echo "  (none)"
  fi
done

# Uncategorized
all_patterns="$db|$test|$security|$devops|$frontend|$backend|$review|$ai|$error"
echo ""
echo "Uncategorized:"
uncategorized=$(echo "$agents" | grep -ivE "$all_patterns" 2>/dev/null)
if [ -n "$uncategorized" ]; then
  echo "$uncategorized" | sed 's/^/  /'
else
  echo "  (all agents categorized)"
fi
```

### 2.3 Plugin Overlap Detection

Check if custom agents duplicate functionality provided by official plugins.

```bash
echo ""
echo "=== Plugin vs Custom Agent Overlap ==="
echo ""
echo "Official plugins provide:"
echo "  pr-review-toolkit: code-reviewer, test-analyzer, type-analyzer"
echo "  feature-dev: code-architect, code-explorer"
echo "  superpowers: various review skills"
echo ""
echo "Custom agents that may overlap:"

agents=$(find ~/.claude/agents -name '*.md' -not -path '*/_archived/*' -exec basename {} .md \; 2>/dev/null)
overlap=0
for agent in $agents; do
  case "$agent" in
    *review*|*architect*|*explorer*|*simplif*|*analyz*)
      echo "  ⚠️  $agent"
      overlap=1
      ;;
  esac
done
[ "$overlap" -eq 0 ] && echo "  ✓ No obvious overlap"
```

### 2.4 Large Skills Check

Skills load on-demand but large ones consume significant context when invoked.

```bash
echo ""
echo "=== Large Skills (>2000 tokens) ==="
found=0
for f in $(find ~/.claude/skills ~/.claude/commands -name '*.md' -not -path '*/_archived/*' 2>/dev/null); do
  bytes=$(wc -c < "$f" 2>/dev/null || echo 0)
  tokens=$((bytes/4))
  if [ "$tokens" -gt 2000 ]; then
    echo "$tokens $(basename "$f")"
    found=1
  fi
done | sort -rn | head -10
[ "$found" -eq 0 ] && echo "✓ No large skills found"
```

---

## Step 3: Configuration Analysis

### 3.1 Core Settings

```bash
echo "=== Settings Analysis ==="

# Keybindings
[ -f ~/.claude/keybindings.json ] && echo "✓ Custom keybindings" || echo "○ No keybindings (/keybindings to configure)"

# SpinnerVerbs
grep -q "spinnerVerbs" ~/.claude/settings.json 2>/dev/null && echo "✓ Custom spinnerVerbs" || echo "○ Default spinnerVerbs"

# Permission mode
perm=$(grep -o '"defaultMode"[^,]*' ~/.claude/settings.json 2>/dev/null | head -1)
echo "Permission mode: ${perm:-not set}"
```

### 3.2 Hooks

```bash
echo ""
echo "=== Hooks Analysis ==="
configured=0
for hook in SessionStart SessionEnd UserPromptSubmit Stop Notification \
            PreToolUse PostToolUse PostToolUseFailure SubagentStart PreCompact; do
  if grep -q "\"$hook\"" ~/.claude/settings.json 2>/dev/null; then
    echo "✓ $hook"
    configured=$((configured+1))
  else
    echo "○ $hook"
  fi
done
echo "Configured: $configured/10"

# Check executability
echo ""
echo "=== Hook Files ==="
for hook in ~/.claude/hooks/*.sh 2>/dev/null; do
  [ -f "$hook" ] || continue
  name=$(basename "$hook")
  [ -x "$hook" ] && echo "✓ $name" || echo "✗ $name (not executable)"
done
```

### 3.3 Plugins

```bash
echo ""
echo "=== Plugins ==="
enabled=$(grep -cE '"[^"]+@[^"]+": true' ~/.claude/settings.json 2>/dev/null || echo 0)
disabled=$(grep -cE '"[^"]+@[^"]+": false' ~/.claude/settings.json 2>/dev/null || echo 0)
echo "Enabled: $enabled | Disabled: $disabled"

echo ""
echo "Enabled list:"
grep -E '"[^"]+@[^"]+": true' ~/.claude/settings.json 2>/dev/null | \
  sed 's/.*"\([^"]*\)".*/  \1/' | sort

echo ""
echo "=== MCP Permission Mismatches ==="
mismatch=0
for plugin in $(grep -E '"[^"]+@[^"]+": false' ~/.claude/settings.json 2>/dev/null | sed 's/.*"\([^"]*\)@.*/\1/'); do
  if grep -q "mcp__plugin_${plugin}" ~/.claude/settings.json 2>/dev/null; then
    echo "⚠️  Permissions exist for disabled: $plugin"
    mismatch=1
  fi
done
[ "$mismatch" -eq 0 ] && echo "✓ No mismatches"
```

### 3.4 MCP Servers

```bash
echo ""
echo "=== MCP Configuration ==="
if [ -f ~/.mcp.json ]; then
  count=$(grep -cE '^\s*"[^"]+":' ~/.mcp.json 2>/dev/null || echo 0)
  echo "Global servers: $count"
else
  echo "No global ~/.mcp.json"
fi
```

---

## Step 4: Feature Checklist

Compare against recent Claude Code features:

- [ ] Keybindings (`/keybindings` command)
- [ ] SpinnerVerbs customization
- [ ] Python venv auto-activation (VSCode)
- [ ] PR review status indicators
- [ ] Task management (TaskCreate/TaskUpdate/TaskList)
- [ ] Deferred tool loading (ToolSearch)
- [ ] Model selection in Task tool
- [ ] SubagentStart hook
- [ ] PreCompact hook

---

## Step 5: Generate Report

### Priority Framework

| Priority | Criteria |
|----------|----------|
| 🔴 Critical | Token waste >5k/prompt, security issues |
| 🟠 High | Token waste 1-5k/prompt, missing major features |
| 🟡 Medium | Agent consolidation, optimizations |
| 🟢 Low | Nice-to-have improvements |

### Report Template

```markdown
# Claude Code Setup Report

## Version: [version]
## Date: [date]

## Token Analysis

| Category | Tokens | Status |
|----------|--------|--------|
| Memory files | Xk | [status] |
| Agents | Xk | [status] |
| Rules | Xk | [status] |

## Issues

### 🔴 Critical
- [issues]

### 🟠 High Priority
- [issues]

### 🟡 Medium Priority
- [issues]

### 🟢 Low Priority
- [issues]

## Recommendations

1. **Backup first**: `cp -r ~/.claude ~/.claude.backup.$(date +%Y%m%d)`
2. [specific steps]
```

---

## Step 6: Implementation

After presenting the report:

1. Ask which priority level to implement
2. Create backup before changes
3. Implement incrementally
4. Verify with `/context` after changes
5. Restart Claude Code if needed

---

## Notes

- `/context` is the source of truth for token usage
- `~/.claude/rules/` loads ALL subdirectories (unlike agents/skills)
- Agents always load; skills load on-demand
- Plugin agents may duplicate custom agents
- Always backup before making changes
