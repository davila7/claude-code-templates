---
sidebar_position: 5
---

# 🪝 Hooks

**Event-driven automation for Claude Code workflows**

Hooks are powerful automation components that execute shell commands in response to specific Claude Code events. They enable you to create automated workflows, notifications, and integrations that react to your development activities.

## What are Hooks?

Hooks are event-driven scripts that automatically execute when certain actions occur in Claude Code. They follow the official Claude Code hooks specification and support all hook events including tool usage, session management, and notifications.

**Key Features:**
- 🔄 **Event-Driven**: Automatically respond to Claude Code events
- 🛠️ **Shell Integration**: Execute any shell command or script
- 📊 **Environment Variables**: Access context about the triggering event
- 🎯 **Pattern Matching**: Target specific tools or file types
- 🔧 **Cross-Platform**: Works on macOS, Linux, and Windows
- 📱 **Notifications**: Integrate with external services like Telegram, Slack, etc.

## Hook Events

### PreToolUse
Executes **before** Claude Code processes a tool call:

```json
{
  "PreToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [
        {
          "type": "command",
          "command": "echo 'About to modify file: $CLAUDE_TOOL_FILE_PATH'"
        }
      ]
    }
  ]
}
```

### PostToolUse  
Executes **after** a tool completes successfully:

```json
{
  "PostToolUse": [
    {
      "matcher": "Edit",
      "hooks": [
        {
          "type": "command", 
          "command": "git add \"$CLAUDE_TOOL_FILE_PATH\""
        }
      ]
    }
  ]
}
```

### Other Events
- **Stop**: Main Claude Code agent finished responding
- **SubagentStop**: Subagent (Task tool) finished responding
- **Notification**: Claude Code sends notifications
- **UserPromptSubmit**: User submits a prompt
- **SessionStart**: New session or resume
- **PreCompact**: Before context compaction

## Available Hook Categories

### 🔧 Development Tools
Essential development workflow automation:

- **`command-logger`** - Log all Claude Code tool usage for audit trails
- **`file-backup`** - Automatically backup files before editing
- **`change-tracker`** - Track all file modifications with timestamps
- **`smart-formatting`** - Auto-format code using Prettier, Black, gofmt, etc.
- **`lint-on-save`** - Run linting tools after file modifications

### 🔄 Git Workflow
Git integration and version control automation:

- **`auto-git-add`** - Automatically stage modified files
- **`smart-commit`** - Generate intelligent commit messages based on changes

### 🧪 Testing
Automated testing integration:

- **`test-runner`** - Run relevant tests after code changes

### ⚡ Automation  
General purpose automation and notifications:

- **`build-on-change`** - Trigger build processes when files change
- **`simple-notifications`** - Desktop notifications for completed operations
- **`dependency-checker`** - Monitor and audit package dependencies
- **`telegram-notifications`** - Send Telegram messages when work completes
- **`telegram-detailed-notifications`** - Detailed session tracking via Telegram
- **`telegram-error-notifications`** - Monitor long operations and issues

### 🔒 Security
Security monitoring and file protection:

- **`file-protection`** - Prevent modification of critical system files
- **`security-scanner`** - Scan code for vulnerabilities and secrets

### 📊 Performance
Performance monitoring and optimization:

- **`performance-monitor`** - Track CPU, memory usage, and execution times

## Installation Options

Like settings, hooks support the full Claude Code configuration hierarchy:

### 🏠 User Hooks (`~/.claude/settings.json`)
- **Scope**: Global - applies to all projects
- **Use case**: Personal automation preferences

### 📁 Project Hooks (`.claude/settings.json`) 
- **Scope**: Project-specific
- **Use case**: Team-shared automation, project requirements

### ⚙️ Local Hooks (`.claude/settings.local.json`)
- **Scope**: Project-specific, personal  
- **Use case**: Personal automation, experimentation

### 🏢 Enterprise Hooks (Platform-specific)
- **Scope**: System-wide automation policies
- **Use case**: Organization-wide monitoring and compliance

## Installation Methods

### Using CLI (Recommended)
```bash
# Install with interactive location selection
npx claude-code-templates@latest --hook=git-workflow/auto-git-add

# Install multiple hooks
npx claude-code-templates@latest --hook=development-tools/file-backup,automation/simple-notifications

# Skip location prompt (defaults to local settings)
npx claude-code-templates@latest --hook=testing/test-runner --yes
```

### Installation Flow
When installing hooks, you'll choose the installation location:

1. **🏠 User settings** - Global automation
2. **📁 Project settings** - Shared team automation  
3. **⚙️ Local settings** - Personal automation (default)
4. **🏢 Enterprise settings** - System-wide automation (requires admin)

## Usage Examples

### Basic File Operations
```bash
# Backup files before editing
npx claude-code-templates@latest --hook=development-tools/file-backup

# Track all file changes
npx claude-code-templates@latest --hook=development-tools/change-tracker

# Auto-format code after editing
npx claude-code-templates@latest --hook=development-tools/smart-formatting
```

### Git Integration
```bash
# Automatically stage changes
npx claude-code-templates@latest --hook=git-workflow/auto-git-add

# Generate smart commits
npx claude-code-templates@latest --hook=git-workflow/smart-commit
```

### Automation & Notifications
```bash
# Get desktop notifications
npx claude-code-templates@latest --hook=automation/simple-notifications

# Telegram integration (requires bot setup)
npx claude-code-templates@latest --hook=automation/telegram-notifications
```

### Security & Performance
```bash
# Protect sensitive files
npx claude-code-templates@latest --hook=security/file-protection

# Monitor performance
npx claude-code-templates@latest --hook=performance/performance-monitor
```

## Environment Variables

Hooks have access to context about the triggering event:

- **`$CLAUDE_TOOL_NAME`** - Name of the tool being executed
- **`$CLAUDE_TOOL_FILE_PATH`** - File path for file operations  
- **`$CLAUDE_PROJECT_DIR`** - Project root directory

### Example Usage
```bash
# Log tool usage with context
echo "[$(date)] $CLAUDE_TOOL_NAME executed on $CLAUDE_TOOL_FILE_PATH"

# Conditional logic based on file type
if [[ "$CLAUDE_TOOL_FILE_PATH" == *.js ]]; then
  npx prettier --write "$CLAUDE_TOOL_FILE_PATH"
fi
```

## Tool Matchers

Control which tools trigger your hooks:

### Common Matchers
- **`*`** - Match all tools
- **`Edit`** - File editing operations
- **`Write`** - File creation operations
- **`Bash`** - Shell commands
- **`Read`** - File reading operations

### Pattern Matching
```json
{
  "matcher": "Edit|Write|MultiEdit",    // Multiple tools
  "matcher": "Notebook.*",              // Regex patterns
  "matcher": "*"                        // All tools
}
```

## Hook Structure

Hooks follow the official Claude Code specification:

```json
{
  "description": "What this hook does",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "your-shell-command-here"
          }
        ]
      }
    ]
  }
}
```

## Advanced Examples

### Telegram Notifications Setup

1. **Create Telegram Bot**:
   - Message [@BotFather](https://t.me/BotFather)
   - Create new bot with `/newbot`
   - Save the bot token

2. **Get Chat ID**:
   - Message your bot
   - Visit: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Copy your chat ID from the response

3. **Set Environment Variables**:
   ```bash
   export TELEGRAM_BOT_TOKEN="your-bot-token"
   export TELEGRAM_CHAT_ID="your-chat-id"
   ```

4. **Install Hook**:
   ```bash
   npx claude-code-templates@latest --hook=automation/telegram-notifications
   ```

### Custom File Processing
```json
{
  "description": "Process TypeScript files after editing",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$CLAUDE_TOOL_FILE_PATH\" == *.ts ]]; then npx tsc --noEmit \"$CLAUDE_TOOL_FILE_PATH\" && echo '✅ TypeScript check passed'; fi"
          }
        ]
      }
    ]
  }
}
```

## Best Practices

### Hook Design
- **Keep Commands Simple**: Use short, focused commands
- **Handle Errors Gracefully**: Include `2>/dev/null || true` for optional operations
- **Check Prerequisites**: Verify tools exist before using them
- **Use Absolute Paths**: Avoid relative path issues

### Performance Considerations
- **Minimize Hook Execution Time**: Hooks should complete quickly
- **Avoid Blocking Operations**: Don't use commands that wait for user input
- **Test Thoroughly**: Ensure hooks work across different scenarios
- **Monitor Resource Usage**: Watch for memory/CPU impact

### Security Guidelines
- **Validate Inputs**: Never execute unvalidated user input
- **Limit Scope**: Use specific matchers rather than `*` when possible
- **Protect Credentials**: Use environment variables for sensitive data
- **Review Commands**: Audit hook commands regularly

## Troubleshooting

### Hook Not Executing?
- Verify hook is installed in the correct settings file
- Check Claude Code version supports hooks
- Ensure environment variables are properly set
- Test with simple commands first

### Permission Errors?
- Check file permissions on script files
- Verify Claude Code has necessary permissions
- For enterprise hooks, ensure admin privileges
- Review system security policies

### Command Failures?
- Test commands manually in terminal
- Check command availability with `which command-name`
- Review error output (remove `2>/dev/null` temporarily)
- Verify file paths and environment variables

## Creating Custom Hooks

Want to create your own hook? Follow these guidelines:

1. **Define Clear Purpose**: Each hook should solve one specific problem
2. **Use Official Structure**: Follow Claude Code hooks specification
3. **Handle Edge Cases**: Account for missing files, permissions, etc.
4. **Include Error Handling**: Use `|| true` for non-critical operations
5. **Document Thoroughly**: Explain what the hook does and how to use it
6. **Test Extensively**: Verify across different platforms and scenarios

### Example Custom Hook
```json
{
  "description": "Automatically deploy to staging after successful tests",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command", 
            "command": "if [[ \"$CLAUDE_TOOL_FILE_PATH\" == *.js && -f package.json ]]; then npm test && npm run deploy:staging; fi"
          }
        ]
      }
    ]
  }
}
```

---

**Next Steps:**
- [Browse All Hooks](https://aitmpl.com) - View available hooks in the web interface
- [Automation Hooks Guide →](../project-setup/automation-hooks) - Deep dive into automation workflows
- [Contributing Guide →](../contributing) - Add your own hooks to the collection
- [Telegram Setup Guide →](https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/hooks/automation/TELEGRAM_SETUP.md) - Detailed Telegram integration guide