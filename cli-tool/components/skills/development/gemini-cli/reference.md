# Gemini CLI Command Reference

Complete reference for Gemini CLI v0.16.0+

## Installation

```bash
npm install -g @google/gemini-cli
# Or without installing:
npx @google/gemini-cli
```

## Authentication

```bash
# Option 1: API Key
export GEMINI_API_KEY=your_key

# Option 2: OAuth (interactive)
gemini  # First run prompts for auth
```

## Command Line Flags

### Essential Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--yolo` | `-y` | Auto-approve all tool calls |
| `--output-format` | `-o` | Output format: `text`, `json`, `stream-json` |
| `--model` | `-m` | Model selection (e.g., `gemini-2.5-flash`) |

### Session Management

| Flag | Short | Description |
|------|-------|-------------|
| `--resume` | `-r` | Resume session by index or "latest" |
| `--list-sessions` | | List available sessions |
| `--delete-session` | | Delete session by index |

### Execution Options

| Flag | Short | Description |
|------|-------|-------------|
| `--sandbox` | `-s` | Run in isolated sandbox |
| `--approval-mode` | | `default`, `auto_edit`, or `yolo` |
| `--timeout` | | Request timeout in ms |
| `--checkpointing` | | Enable file change snapshots |

### Context & Tools

| Flag | Description |
|------|-------------|
| `--include-directories` | Add directories to workspace |
| `--allowed-tools` | Restrict available tools |
| `--allowed-mcp-server-names` | Restrict MCP servers |

### Other Options

| Flag | Short | Description |
|------|-------|-------------|
| `--debug` | `-d` | Enable debug output |
| `--version` | `-v` | Show version |
| `--help` | `-h` | Show help |
| `--list-extensions` | `-l` | List installed extensions |
| `--prompt-interactive` | `-i` | Interactive mode with initial prompt |

## Output Formats

### Text (`-o text`)
```bash
gemini "prompt" -o text
# Returns: Human-readable response
```

### JSON (`-o json`)
```bash
gemini "prompt" -o json
```

Returns structured data:
```json
{
  "response": "The actual response content",
  "stats": {
    "models": {
      "gemini-2.5-flash": {
        "api": {
          "totalRequests": 3,
          "totalErrors": 0,
          "totalLatencyMs": 5000
        },
        "tokens": {
          "prompt": 1500,
          "candidates": 500,
          "total": 2000,
          "cached": 800,
          "thoughts": 150,
          "tool": 50
        }
      }
    },
    "tools": {
      "totalCalls": 2,
      "totalSuccess": 2,
      "totalFail": 0,
      "byName": {
        "google_web_search": {
          "count": 1,
          "success": 1,
          "durationMs": 3000
        }
      }
    }
  }
}
```

### Stream JSON (`-o stream-json`)
Real-time newline-delimited JSON events for monitoring long tasks.

## Model Selection

### Available Models

| Model | Use Case | Context |
|-------|----------|---------|
| `gemini-3-pro` | Complex tasks (default) | 1M tokens |
| `gemini-2.5-flash` | Quick tasks, lower latency | Large |
| `gemini-2.5-flash-lite` | Fastest, simplest tasks | Medium |

### Usage
```bash
# Default (Pro)
gemini "complex analysis" -o text

# Flash for speed
gemini "simple task" -m gemini-2.5-flash -o text
```

## Configuration Files

### Settings Location
Priority order (highest first):
1. `/etc/gemini-cli/settings.json` (system)
2. `~/.gemini/settings.json` (user)
3. `.gemini/settings.json` (project)

### Example Settings
```json
{
  "security": {
    "auth": {
      "selectedType": "oauth-personal"
    }
  },
  "general": {
    "previewFeatures": true,
    "vimMode": false,
    "checkpointing": true
  },
  "mcpServers": {}
}
```

### Project Context (GEMINI.md)

Create `.gemini/GEMINI.md` in project root:
```markdown
# Project Context

Project description and guidelines.

## Coding Standards
- Standards Gemini should follow

## When Making Changes
- Guidelines for modifications
```

### Ignore Files (.geminiignore)

Like `.gitignore`, excludes files from context:
```
node_modules/
dist/
*.log
.env
```

## Session Management

### List Sessions
```bash
gemini --list-sessions
```

Output:
```
Available sessions for this project (5):
  1. Create task manager (10 minutes ago) [uuid]
  2. Review code (20 minutes ago) [uuid]
  ...
```

### Resume Session
```bash
# By index
echo "follow-up question" | gemini -r 1 -o text

# Latest session
echo "continue" | gemini -r latest -o text
```

## Rate Limits

### Free Tier Limits
- 60 requests per minute
- 1000 requests per day

### Rate Limit Behavior
- CLI auto-retries with exponential backoff
- Message: `"quota will reset after Xs"`
- Typical wait: 1-5 seconds

### Mitigation
1. Use `gemini-2.5-flash` for simple tasks
2. Batch operations into single prompts
3. Run long tasks in background

## Interactive Commands

In interactive mode, these slash commands are available:

| Command | Purpose |
|---------|---------|
| `/help` | Show available commands |
| `/tools` | List available tools |
| `/stats` | Show token usage |
| `/compress` | Summarize context to save tokens |
| `/restore` | Restore file checkpoints |
| `/chat save <tag>` | Save conversation |
| `/chat resume <tag>` | Resume conversation |
| `/memory show` | Display GEMINI.md context |
| `/memory refresh` | Reload context files |

## Piping & Scripting

### Pipe Input
```bash
echo "What is 2+2?" | gemini -o text
cat file.txt | gemini "summarize this" -o text
```

### File Reference Syntax
In prompts, reference files with `@`:
```bash
gemini "Review @./src/main.js for bugs" -o text
```

### Shell Command Execution
In interactive mode, prefix with `!`:
```
> !git status
```

## Keyboard Shortcuts (Interactive)

| Shortcut | Function |
|----------|----------|
| `Ctrl+L` | Clear screen |
| `Ctrl+V` | Paste from clipboard |
| `Ctrl+Y` | Toggle YOLO mode |
| `Ctrl+X` | Open in external editor |

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "API key not found" | Set `GEMINI_API_KEY` env var |
| "Rate limit exceeded" | Wait for auto-retry or use Flash |
| "Context too large" | Use `.geminiignore` or be specific |
| "Tool call failed" | Check JSON stats for details |

### Debug Mode
```bash
gemini "prompt" --debug -o text
```

### Error Reports
Full error reports saved to:
```
/var/folders/.../gemini-client-error-*.json
```
