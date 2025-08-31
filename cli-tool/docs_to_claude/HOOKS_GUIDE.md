# Complete Guide to Claude Code Hooks

This guide teaches you how to create and configure custom hooks for Claude Code to automate workflows, validate operations, and enhance your development experience.

## What are Claude Code Hooks?

Hooks are automated scripts that execute at specific points during Claude Code sessions. Each hook:

- **Responds to specific events** like tool usage, prompt submission, or session start/end
- **Can validate, modify, or block operations** based on your criteria
- **Executes shell commands automatically** with access to session data
- **Integrates seamlessly with your development workflow**
- **Provides fine-grained control** over Claude's behavior

## Key Benefits

### 🔄 Automated Workflows
Execute custom scripts automatically when specific events occur during Claude Code sessions.

### 🛡️ Enhanced Security
Validate and block potentially dangerous operations before they execute.

### 📊 Session Monitoring
Track usage patterns, log operations, and gather analytics from your Claude Code sessions.

### 🔧 Custom Validation
Implement project-specific rules and requirements that Claude must follow.

### ⚡ Real-time Feedback
Provide immediate feedback to Claude based on the results of operations.

## Hook Configuration

### Configuration Files

Hooks are configured in your Claude Code settings files with the following priority order:

| Type | Location | Scope | Usage |
|------|----------|-------|--------|
| **User Settings** | `~/.claude/settings.json` | All projects | Personal hooks across all projects |
| **Project Settings** | `.claude/settings.json` | Current project | Shared team hooks (committed to repo) |
| **Local Project Settings** | `.claude/settings.local.json` | Current project | Personal project hooks (not committed) |
| **Enterprise Settings** | Managed by policy | Organization | Company-wide hooks and policies |

*When there are conflicts, settings files lower in the list take precedence.*

### Basic Hook Structure

Each hook is defined using event-based configuration:

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolPattern",
        "hooks": [
          {
            "type": "command",
            "command": "your-script-here",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

### Configuration Elements

#### Event Names
- **PreToolUse**: Before Claude executes a tool
- **PostToolUse**: After Claude executes a tool successfully
- **UserPromptSubmit**: When user submits a prompt
- **Notification**: When Claude Code sends notifications
- **Stop**: When Claude finishes responding
- **SubagentStop**: When a subagent completes
- **SessionStart**: When a session begins or resumes
- **SessionEnd**: When a session terminates
- **PreCompact**: Before compacting conversation history

#### Matchers
For tool-based events (PreToolUse, PostToolUse):
```json
"matcher": "Write"              // Exact match for Write tool
"matcher": "Edit|Write"         // Regex pattern for multiple tools
"matcher": "Bash.*"            // Pattern matching with wildcards
"matcher": "*"                 // Match all tools
"matcher": ""                  // Also matches all tools
```

#### Hook Commands
```json
{
  "type": "command",                           // Currently only "command" supported
  "command": "/path/to/script.sh",            // Shell command to execute
  "timeout": 30                               // Optional timeout in seconds (default: 60)
}
```

## Hook Events Reference

### PreToolUse

**Purpose**: Validate or modify tool usage before execution
**Common Use Cases**: Permission control, input validation, security checks

**Input Data**:
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/conversation.jsonl",
  "cwd": "/current/working/directory",
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "file content"
  }
}
```

**Common Matchers**:
- `Bash` - Shell commands
- `Write` - File creation
- `Edit`, `MultiEdit` - File modifications
- `Read` - File reading
- `Task` - Subagent tasks
- `WebFetch`, `WebSearch` - Web operations

### PostToolUse

**Purpose**: React to completed tool operations, provide feedback, or trigger follow-up actions
**Common Use Cases**: Logging, validation, cleanup, triggering builds

**Input Data**:
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/conversation.jsonl",
  "cwd": "/current/working/directory",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "file content"
  },
  "tool_response": {
    "filePath": "/path/to/file.txt",
    "success": true
  }
}
```

### UserPromptSubmit

**Purpose**: Process or validate user prompts before Claude sees them
**Common Use Cases**: Adding context, blocking sensitive prompts, prompt transformation

**Input Data**:
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/conversation.jsonl",
  "cwd": "/current/working/directory",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Write a function to calculate factorial"
}
```

### SessionStart

**Purpose**: Initialize session context and load project-specific information
**Common Use Cases**: Loading project state, setting up environment, adding context

**Input Data**:
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/conversation.jsonl",
  "hook_event_name": "SessionStart",
  "source": "startup"  // "startup", "resume", or "clear"
}
```

**Matchers**:
- `startup` - Normal Claude Code startup
- `resume` - Resumed from `--resume`, `--continue`, or `/resume`
- `clear` - After `/clear` command

### Stop and SubagentStop

**Purpose**: Control whether Claude can finish responding or trigger additional actions
**Common Use Cases**: Automated testing, continuous workflows, quality checks

**Input Data**:
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/conversation.jsonl",
  "hook_event_name": "Stop",
  "stop_hook_active": false
}
```

### SessionEnd

**Purpose**: Cleanup tasks when a session terminates
**Common Use Cases**: Saving session data, cleanup, logging statistics

**Input Data**:
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/conversation.jsonl",
  "cwd": "/current/working/directory",
  "hook_event_name": "SessionEnd",
  "reason": "exit"  // "clear", "logout", "prompt_input_exit", "other"
}
```

## Hook Output and Control

### Simple Exit Code Control

**Exit Code 0**: Success
- For most hooks: stdout shown to user in transcript mode (Ctrl+R)
- For UserPromptSubmit and SessionStart: stdout added as context for Claude

**Exit Code 2**: Blocking error
- Blocks the operation and shows stderr to Claude for automated handling
- Behavior varies by hook type (see reference table below)

**Other Exit Codes**: Non-blocking error
- Shows stderr to user and continues execution

#### Exit Code 2 Behavior by Hook Type

| Hook Event | Behavior |
|------------|----------|
| `PreToolUse` | Blocks tool execution, shows stderr to Claude |
| `PostToolUse` | Shows stderr to Claude (tool already executed) |
| `UserPromptSubmit` | Blocks prompt, erases it, shows stderr to user only |
| `Stop`/`SubagentStop` | Blocks stopping, shows stderr to Claude |
| `Notification` | Shows stderr to user only |
| `SessionStart`/`SessionEnd`/`PreCompact` | Shows stderr to user only |

### Advanced JSON Output

For sophisticated control, hooks can return structured JSON:

#### Common JSON Fields
```json
{
  "continue": true,                    // Whether to continue execution (default: true)
  "stopReason": "string",             // Message when continue is false
  "suppressOutput": true,             // Hide stdout from transcript (default: false)
  "systemMessage": "string"           // Warning message for user
}
```

#### PreToolUse Permission Control
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",     // "allow", "deny", or "ask"
    "permissionDecisionReason": "Auto-approved safe operation"
  }
}
```

#### PostToolUse Feedback Control
```json
{
  "decision": "block",                // "block" or undefined
  "reason": "Code style violations detected",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Additional context for Claude"
  }
}
```

#### UserPromptSubmit Processing
```json
{
  "decision": "block",                // "block" or undefined  
  "reason": "Sensitive information detected",
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Current project status: Ready for deployment"
  }
}
```

#### SessionStart Context Loading
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart", 
    "additionalContext": "Recent issues: #123 (bug fix needed), #124 (feature ready)"
  }
}
```

## Complete Hook Examples

### 1. Code Style Enforcement

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/format-code.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**format-code.sh**:
```bash
#!/bin/bash
# Code formatting hook

set -e

# Read hook input
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name')
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Only process code files
if [[ ! "$file_path" =~ \.(js|ts|jsx|tsx|py|go|rs)$ ]]; then
    exit 0
fi

echo "🔧 Formatting $file_path..."

# Format based on file type
case "$file_path" in
    *.js|*.jsx|*.ts|*.tsx)
        if command -v prettier >/dev/null 2>&1; then
            prettier --write "$file_path" 2>/dev/null || echo "❌ Prettier formatting failed"
        fi
        ;;
    *.py)
        if command -v black >/dev/null 2>&1; then
            black "$file_path" 2>/dev/null || echo "❌ Black formatting failed"
        fi
        ;;
    *.go)
        if command -v gofmt >/dev/null 2>&1; then
            gofmt -w "$file_path" 2>/dev/null || echo "❌ Go formatting failed"
        fi
        ;;
    *.rs)
        if command -v rustfmt >/dev/null 2>&1; then
            rustfmt "$file_path" 2>/dev/null || echo "❌ Rust formatting failed"
        fi
        ;;
esac

echo "✅ Code formatting complete"
```

### 2. Security Validation

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command", 
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/validate-bash.py"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-sensitive.py"
          }
        ]
      }
    ]
  }
}
```

**validate-bash.py**:
```python
#!/usr/bin/env python3
import json
import sys
import re

# Dangerous command patterns
DANGEROUS_PATTERNS = [
    (r'\brm\s+-rf\s+/', 'Dangerous: rm -rf with absolute path'),
    (r'\bdd\s+if=', 'Dangerous: dd command detected'),
    (r'\bchmod\s+777', 'Security risk: chmod 777 detected'),
    (r'>\s*/dev/(sd[a-z]|hd[a-z])', 'Dangerous: writing to disk device'),
    (r'\bcurl.*\|\s*bash', 'Security risk: piping curl to bash'),
    (r'\bwget.*\|\s*bash', 'Security risk: piping wget to bash'),
]

try:
    input_data = json.load(sys.stdin)
    command = input_data.get('tool_input', {}).get('command', '')
    
    if not command:
        sys.exit(0)
    
    # Check for dangerous patterns
    for pattern, message in DANGEROUS_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            print(f"🚨 {message}", file=sys.stderr)
            print(f"Command: {command}", file=sys.stderr)
            print("Please review and confirm this command is safe.", file=sys.stderr)
            sys.exit(2)  # Block the command
    
    # Auto-approve safe commands
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "permissionDecisionReason": "Command passed security validation"
        }
    }
    print(json.dumps(output))
    
except Exception as e:
    print(f"Hook error: {e}", file=sys.stderr)
    sys.exit(1)
```

**check-sensitive.py**:
```python
#!/usr/bin/env python3
import json
import sys
import re

# Sensitive information patterns
SENSITIVE_PATTERNS = [
    (r'(?i)(password|pwd)\s*[:=]\s*[\'"]?[^\s\'"]+', 'Password detected'),
    (r'(?i)(api[_-]?key|apikey)\s*[:=]\s*[\'"]?[a-zA-Z0-9]+', 'API key detected'),
    (r'(?i)(secret|token)\s*[:=]\s*[\'"]?[^\s\'"]+', 'Secret/token detected'),
    (r'\b[A-Za-z0-9+/]{40,}={0,2}\b', 'Base64-encoded secret detected'),
    (r'-----BEGIN [A-Z ]+-----', 'Private key detected'),
]

try:
    input_data = json.load(sys.stdin)
    prompt = input_data.get('prompt', '')
    
    # Check for sensitive information
    for pattern, message in SENSITIVE_PATTERNS:
        if re.search(pattern, prompt):
            output = {
                "decision": "block",
                "reason": f"🚨 Security violation: {message}. Please remove sensitive information and try again."
            }
            print(json.dumps(output))
            sys.exit(0)
    
    # Add security reminder
    security_context = """
🔒 Security reminder: This session is being monitored for sensitive information.
Current security status: All prompts are scanned for passwords, API keys, and secrets.
"""
    
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": security_context
        }
    }
    print(json.dumps(output))
    
except Exception as e:
    print(f"Hook error: {e}", file=sys.stderr)
    sys.exit(1)
```

### 3. Project Context Loading

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/load-context.sh"
          }
        ]
      }
    ]
  }
}
```

**load-context.sh**:
```bash
#!/bin/bash
# Project context loading hook

set -e

# Read hook input
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id')
source=$(echo "$input" | jq -r '.source // "startup"')

echo "🚀 Loading project context for $source..."

# Load git status
echo "## Git Repository Status"
echo "**Current branch:** $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'not a git repo')"
echo "**Last commit:** $(git log -1 --pretty=format:'%h - %s (%cr)' 2>/dev/null || echo 'no commits')"

# Check for uncommitted changes
if git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "**Working tree:** clean"
else
    echo "**Working tree:** has uncommitted changes"
    echo "**Modified files:**"
    git diff --name-only HEAD 2>/dev/null | sed 's/^/  - /' || echo "  - (unable to detect)"
fi

# Load recent issues/todos
echo -e "\n## Recent Issues & TODOs"
if [[ -f "TODO.md" ]]; then
    echo "**From TODO.md:**"
    head -10 "TODO.md" | sed 's/^/  /'
elif command -v rg >/dev/null 2>&1; then
    echo "**TODOs in codebase:**"
    rg -i "todo|fixme|hack|bug" --type-add 'code:*.{js,ts,py,go,rs,java,c,cpp,h}' -t code -n | head -5 | sed 's/^/  /'
fi

# Load package info
echo -e "\n## Project Configuration"
if [[ -f "package.json" ]]; then
    name=$(jq -r '.name // "unknown"' package.json)
    version=$(jq -r '.version // "unknown"' package.json)
    echo "**Project:** $name v$version"
    echo "**Scripts available:** $(jq -r '.scripts | keys | join(", ")' package.json 2>/dev/null || echo 'none')"
elif [[ -f "Cargo.toml" ]]; then
    name=$(grep '^name' Cargo.toml | cut -d'"' -f2 2>/dev/null || echo 'unknown')
    version=$(grep '^version' Cargo.toml | cut -d'"' -f2 2>/dev/null || echo 'unknown')
    echo "**Rust project:** $name v$version"
elif [[ -f "go.mod" ]]; then
    module=$(head -1 go.mod | cut -d' ' -f2 2>/dev/null || echo 'unknown')
    echo "**Go module:** $module"
elif [[ -f "pyproject.toml" ]] || [[ -f "setup.py" ]]; then
    echo "**Python project detected**"
fi

# Load recent changes
echo -e "\n## Recent Activity"
echo "**Last 3 commits:**"
git log -3 --pretty=format:'  - %h %s (%cr)' 2>/dev/null || echo "  - No git history available"

echo -e "\n✅ Project context loaded successfully"
```

### 4. Automated Testing

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/auto-test.sh",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

**auto-test.sh**:
```bash
#!/bin/bash
# Automated testing hook

set -e

# Read hook input
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Only run tests for source files
if [[ ! "$file_path" =~ \.(js|ts|jsx|tsx|py|go|rs)$ ]]; then
    exit 0
fi

echo "🧪 Running automated tests for $file_path..."

# Determine test command based on project type
run_tests() {
    if [[ -f "package.json" ]] && jq -e '.scripts.test' package.json >/dev/null 2>&1; then
        echo "📦 Running npm tests..."
        npm test 2>&1 | tail -10
    elif [[ -f "Cargo.toml" ]]; then
        echo "🦀 Running Rust tests..."
        cargo test 2>&1 | tail -10
    elif [[ -f "go.mod" ]]; then
        echo "🐹 Running Go tests..."
        go test ./... 2>&1 | tail -10
    elif [[ -f "pytest.ini" ]] || [[ -f "pyproject.toml" ]]; then
        echo "🐍 Running Python tests..."
        python -m pytest -x --tb=short 2>&1 | tail -10
    else
        echo "ℹ️  No test configuration found, skipping tests"
        return 0
    fi
}

# Run tests and capture result
if test_output=$(run_tests); then
    echo "✅ Tests passed"
    echo "$test_output"
else
    echo "❌ Tests failed - informing Claude"
    echo "Test failures detected in modified code:" >&2
    echo "$test_output" >&2
    exit 2  # This will show the error to Claude
fi
```

### 5. File Protection

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/protect-files.py"
          }
        ]
      }
    ]
  }
}
```

**protect-files.py**:
```python
#!/usr/bin/env python3
import json
import sys
import os
from pathlib import Path

# Protected file patterns
PROTECTED_PATTERNS = [
    '.env*',
    '*.key',
    '*.pem', 
    'id_rsa*',
    'id_ed25519*',
    '.aws/credentials',
    '.ssh/config',
    'secrets.*',
    'private.*'
]

# Critical system files
CRITICAL_FILES = [
    '/etc/passwd',
    '/etc/shadow', 
    '/etc/hosts',
    '/etc/fstab',
    '~/.bashrc',
    '~/.zshrc',
    '~/.profile'
]

def is_protected_file(file_path):
    """Check if file matches protection patterns"""
    path = Path(file_path)
    
    # Check against patterns
    for pattern in PROTECTED_PATTERNS:
        if path.match(pattern) or any(part.match(pattern) for part in path.parts):
            return True, f"matches protected pattern: {pattern}"
    
    # Check critical system files
    resolved_path = str(path.resolve())
    for critical in CRITICAL_FILES:
        critical_resolved = str(Path(critical).expanduser().resolve())
        if resolved_path == critical_resolved:
            return True, f"is a critical system file"
    
    return False, None

try:
    input_data = json.load(sys.stdin)
    tool_input = input_data.get('tool_input', {})
    file_path = tool_input.get('file_path', '')
    
    if not file_path:
        sys.exit(0)
    
    # Check if file is protected
    is_protected, reason = is_protected_file(file_path)
    
    if is_protected:
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "ask",
                "permissionDecisionReason": f"⚠️ Protected file detected: {file_path} {reason}. Confirm this operation."
            }
        }
        print(json.dumps(output))
    else:
        # Auto-approve safe files
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse", 
                "permissionDecision": "allow",
                "permissionDecisionReason": "File passed protection checks"
            }
        }
        print(json.dumps(output))
        
except Exception as e:
    print(f"Hook error: {e}", file=sys.stderr)
    sys.exit(1)
```

## MCP Integration

### Understanding MCP Tools in Hooks

Claude Code hooks work seamlessly with [Model Context Protocol (MCP)](/en/docs/claude-code/mcp) tools. MCP tools follow the naming pattern `mcp__<server>__<tool>`:

- `mcp__github__create_issue` - GitHub MCP server's issue creation tool
- `mcp__database__execute_query` - Database MCP server's query tool
- `mcp__filesystem__write_file` - Filesystem MCP server's write tool

### MCP Hook Configuration

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__github__.*",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/log-github-operations.sh"
          }
        ]
      },
      {
        "matcher": "mcp__.*__write.*|mcp__.*__delete.*",
        "hooks": [
          {
            "type": "command", 
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/validate-destructive-mcp.py"
          }
        ]
      }
    ]
  }
}
```

## Advanced Hook Patterns

### 1. Conditional Hook Execution

```python
#!/usr/bin/env python3
# Conditional hook based on project type and environment

import json
import sys
import os

try:
    input_data = json.load(sys.stdin)
    
    # Only run in production-like environments
    env = os.environ.get('NODE_ENV', 'development')
    if env not in ['staging', 'production']:
        sys.exit(0)
    
    # Only for specific project types
    if not os.path.exists('package.json'):
        sys.exit(0)
    
    # Your hook logic here
    print("🚀 Production hook executed")
    
except Exception as e:
    print(f"Hook error: {e}", file=sys.stderr)
    sys.exit(1)
```

### 2. Multi-Tool Coordination

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/coordinate-tools.sh"
          }
        ]
      }
    ]
  }
}
```

**coordinate-tools.sh**:
```bash
#!/bin/bash
# Multi-tool coordination example

set -e

# Read hook input
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path')
tool_name=$(echo "$input" | jq -r '.tool_name')

# Create a coordination log
mkdir -p .claude/logs
echo "$(date): $tool_name - $file_path" >> .claude/logs/tool-coordination.log

# Trigger related actions based on file type
case "$file_path" in
    *.md)
        echo "📝 Documentation updated, checking for broken links..."
        # Link check could go here
        ;;
    *.js|*.ts)
        echo "📄 JavaScript updated, checking dependencies..."
        if [[ -f package.json ]]; then
            npm audit --audit-level=moderate || echo "⚠️ npm audit found issues"
        fi
        ;;
    Dockerfile)
        echo "🐳 Dockerfile updated, validating..."
        docker build --dry-run . || echo "⚠️ Docker build validation failed"
        ;;
    *.yml|*.yaml)
        echo "📋 YAML updated, validating syntax..."
        python -c "import yaml; yaml.safe_load(open('$file_path'))" 2>/dev/null || echo "⚠️ YAML syntax error"
        ;;
esac

echo "✅ Tool coordination complete"
```

### 3. Session Analytics

```python
#!/usr/bin/env python3
# Session analytics and usage tracking

import json
import sys
import sqlite3
from datetime import datetime
import os

DATABASE = os.path.expanduser('~/.claude/analytics.db')

def init_db():
    """Initialize analytics database"""
    conn = sqlite3.connect(DATABASE)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS tool_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            tool_name TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            file_path TEXT,
            success BOOLEAN
        )
    ''')
    conn.commit()
    return conn

try:
    input_data = json.load(sys.stdin)
    
    # Initialize database
    conn = init_db()
    
    # Log tool usage
    conn.execute('''
        INSERT INTO tool_usage (session_id, tool_name, file_path, success)
        VALUES (?, ?, ?, ?)
    ''', (
        input_data.get('session_id'),
        input_data.get('tool_name'),
        input_data.get('tool_input', {}).get('file_path', ''),
        input_data.get('tool_response', {}).get('success', True)
    ))
    
    conn.commit()
    
    # Generate usage summary periodically
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM tool_usage WHERE date(timestamp) = date("now")')
    daily_count = cursor.fetchone()[0]
    
    if daily_count % 10 == 0:  # Every 10th operation
        print(f"📊 Daily tool usage: {daily_count} operations")
        
        # Show top tools today
        cursor.execute('''
            SELECT tool_name, COUNT(*) as count
            FROM tool_usage 
            WHERE date(timestamp) = date("now")
            GROUP BY tool_name
            ORDER BY count DESC
            LIMIT 3
        ''')
        
        top_tools = cursor.fetchall()
        print("🏆 Most used tools today:")
        for tool, count in top_tools:
            print(f"  {tool}: {count} times")
    
    conn.close()
    
except Exception as e:
    print(f"Analytics error: {e}", file=sys.stderr)
    sys.exit(0)  # Don't fail the operation for analytics errors
```

## Best Practices

### 1. Hook Design Principles
- **Single Responsibility**: Each hook should have one clear purpose
- **Fail Gracefully**: Use exit code 0 for non-critical failures to avoid blocking operations
- **Be Fast**: Keep hook execution time minimal to avoid slowing down Claude
- **Idempotent**: Hooks should be safe to run multiple times with the same input

### 2. Error Handling
```python
#!/usr/bin/env python3
import json
import sys
import logging

# Set up logging
logging.basicConfig(
    filename=os.path.expanduser('~/.claude/hooks.log'),
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

try:
    input_data = json.load(sys.stdin)
    
    # Your hook logic here
    
except json.JSONDecodeError as e:
    logging.error(f"JSON decode error: {e}")
    print(f"Invalid JSON input: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    logging.error(f"Unexpected error: {e}")
    print(f"Hook error: {e}", file=sys.stderr)
    sys.exit(0)  # Don't block on unexpected errors
```

### 3. Input Validation
```python
def validate_input(input_data):
    """Validate hook input data"""
    required_fields = ['session_id', 'hook_event_name']
    
    for field in required_fields:
        if field not in input_data:
            raise ValueError(f"Missing required field: {field}")
    
    # Validate file paths for path traversal
    file_path = input_data.get('tool_input', {}).get('file_path')
    if file_path and '..' in file_path:
        raise ValueError(f"Invalid file path: {file_path}")
    
    return True
```

### 4. Configuration Management
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/configurable-hook.py --config=$CLAUDE_PROJECT_DIR/.claude/hook-config.json"
          }
        ]
      }
    ]
  }
}
```

## Security and Safety

### Security Best Practices

1. **Input Sanitization**: Always validate and sanitize inputs from Claude Code
2. **Path Security**: Check for directory traversal attacks (`../` patterns)
3. **Command Injection**: Never pass user input directly to shell commands
4. **File Permissions**: Use minimal required permissions for hook scripts
5. **Secrets Management**: Never log or expose sensitive information

### Security Example
```python
#!/usr/bin/env python3
import json
import sys
import os
import re
from pathlib import Path

def sanitize_path(file_path):
    """Sanitize file path to prevent directory traversal"""
    if not file_path:
        return None
    
    # Check for directory traversal
    if '..' in file_path or file_path.startswith('/'):
        raise ValueError(f"Unsafe path detected: {file_path}")
    
    # Resolve to absolute path within project
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')
    safe_path = Path(project_dir) / file_path
    
    # Ensure path stays within project directory
    try:
        safe_path.resolve().relative_to(Path(project_dir).resolve())
        return str(safe_path)
    except ValueError:
        raise ValueError(f"Path outside project directory: {file_path}")

try:
    input_data = json.load(sys.stdin)
    file_path = input_data.get('tool_input', {}).get('file_path')
    
    if file_path:
        safe_path = sanitize_path(file_path)
        print(f"✅ Safe path validated: {safe_path}")
    
except Exception as e:
    print(f"Security validation failed: {e}", file=sys.stderr)
    sys.exit(2)  # Block unsafe operations
```

### Hook Execution Safety

- **Timeout Limits**: Always set reasonable timeouts to prevent hanging
- **Resource Limits**: Be mindful of CPU and memory usage
- **Concurrent Execution**: Hooks run in parallel - design for thread safety
- **Environment Isolation**: Use containers or sandboxing for untrusted hooks

## Troubleshooting and Debugging

### Common Issues

1. **Hook Not Executing**
   - Check hook registration with `/hooks` command
   - Verify JSON syntax in settings files
   - Ensure script is executable (`chmod +x script.sh`)
   - Check matcher patterns are correct (case-sensitive)

2. **Permission Errors**
   - Verify script file permissions
   - Check `$CLAUDE_PROJECT_DIR` environment variable
   - Ensure scripts use absolute paths

3. **Timeout Issues**
   - Increase timeout values for long-running operations
   - Optimize hook performance
   - Run expensive operations asynchronously

### Debug Mode

Use `claude --debug` to see detailed hook execution:

```bash
claude --debug
```

Debug output includes:
- Hook discovery and matching
- Command execution details
- Execution time and exit codes
- stdout/stderr from hooks

### Testing Hooks

Test hooks independently:

```bash
# Test hook script directly
echo '{"session_id":"test","hook_event_name":"PreToolUse","tool_name":"Write","tool_input":{"file_path":"test.txt"}}' | ./.claude/hooks/your-hook.py

# Test JSON output
echo '{"session_id":"test"}' | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(json.dumps({'continue': True, 'systemMessage': 'Test successful'}))
"
```

### Hook Development Workflow

1. **Start Simple**: Begin with basic exit code hooks
2. **Add Logging**: Include debug output for troubleshooting
3. **Test Thoroughly**: Test all code paths and edge cases
4. **Add Error Handling**: Graceful degradation on failures
5. **Optimize Performance**: Minimize execution time
6. **Document Behavior**: Clear comments and documentation

## Hook Ecosystem

### Community Hooks

Share and discover hooks with the community:
- [Claude Code Hooks Repository](https://github.com/anthropic/claude-code-hooks) (example)
- Project-specific hook collections
- Team-shared hook libraries

### Hook Templates

Use these templates as starting points:

**Basic Hook Template**:
```python
#!/usr/bin/env python3
import json
import sys
import os

def main():
    try:
        # Read input
        input_data = json.load(sys.stdin)
        
        # Your hook logic here
        
        # Success
        print("Hook executed successfully")
        sys.exit(0)
        
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
```

**JSON Output Template**:
```python
#!/usr/bin/env python3
import json
import sys

def main():
    try:
        input_data = json.load(sys.stdin)
        
        # Your logic here
        
        output = {
            "continue": True,
            "hookSpecificOutput": {
                "hookEventName": input_data.get('hook_event_name'),
                # Event-specific output
            }
        }
        
        print(json.dumps(output))
        sys.exit(0)
        
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
```

## Conclusion

Claude Code hooks provide powerful automation capabilities that can significantly enhance your development workflow. With hooks, you can:

- **Automate repetitive tasks** like code formatting and testing
- **Enhance security** through validation and monitoring  
- **Customize Claude's behavior** to match your team's requirements
- **Integrate with external tools** and services
- **Monitor and analyze** your development patterns

Start with simple hooks and gradually build more sophisticated automation as you become comfortable with the system. Remember to prioritize security, test thoroughly, and document your hooks for team collaboration.

For more examples and community resources, see the [Claude Code documentation](/en/docs/claude-code) and join the community discussions.