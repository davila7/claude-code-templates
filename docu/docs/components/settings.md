---
sidebar_position: 4
---

# ⚙️ Settings

**Configuration options to customize Claude Code behavior**

Settings are JSON-based configuration components that customize how Claude Code operates. They allow you to configure environment variables, permissions, model preferences, and cleanup policies to match your development workflow.

## What are Settings?

Settings are individual configuration files that merge into your Claude Code settings hierarchy. Each setting focuses on a specific aspect of Claude Code configuration, making them modular and easy to manage.

**Key Features:**
- ⚙️ **Modular Configuration**: Each setting handles one specific aspect
- 🏗️ **Hierarchical**: Supports user, project, local, and enterprise configurations  
- 🔧 **Environment Variables**: Configure environment settings
- 🛡️ **Permissions**: Control what Claude Code can and cannot do
- 🤖 **Model Selection**: Choose between different Claude models
- 🧹 **Cleanup Policies**: Manage conversation retention and cleanup

## Available Settings Categories

### 🛡️ Permissions
Control what operations Claude Code is allowed to perform:

- **`allow-npm-commands`** - Enable npm-related commands
- **`deny-sensitive-files`** - Prevent modification of sensitive files

### 🤖 Model Configuration
Choose which Claude model to use:

- **`use-sonnet`** - Configure Claude 3.5 Sonnet (balanced)
- **`use-haiku`** - Configure Claude 3 Haiku (fast and efficient)

### 📊 Telemetry
Configure usage analytics and data collection:

- **`enable-telemetry`** - Enable Claude Code usage analytics
- **`disable-telemetry`** - Disable all telemetry collection
- **`custom-telemetry`** - Custom telemetry configuration

### 🧹 Cleanup
Manage conversation history and data retention:

- **`retention-7-days`** - Keep conversations for 7 days
- **`retention-90-days`** - Keep conversations for 90 days

## Installation Options

Settings can be installed at different levels of your Claude Code configuration hierarchy:

### 🏠 User Settings (`~/.claude/settings.json`)
- **Scope**: Global - applies to all projects
- **Use case**: Personal preferences and global configurations
- **Shared**: No, personal to your user account

### 📁 Project Settings (`.claude/settings.json`)
- **Scope**: Project-specific 
- **Use case**: Team-shared configurations, project requirements
- **Shared**: Yes, committed to version control

### ⚙️ Local Settings (`.claude/settings.local.json`)
- **Scope**: Project-specific, personal
- **Use case**: Personal overrides, experimentation, sensitive data
- **Shared**: No, automatically ignored by git

### 🏢 Enterprise Settings (Platform-specific)
- **Scope**: System-wide policy
- **Use case**: Organization-wide policies and restrictions
- **Requires**: Administrator privileges

**Platform Locations:**
- macOS: `/Library/Application Support/ClaudeCode/managed-settings.json`
- Linux/WSL: `/etc/claude-code/managed-settings.json`
- Windows: `C:\ProgramData\ClaudeCode\managed-settings.json`

## Installation Methods

### Using CLI (Recommended)
```bash
# Install with interactive location selection
npx claude-code-templates@latest --setting=permissions/allow-npm-commands

# Install multiple settings
npx claude-code-templates@latest --setting=model/use-sonnet,telemetry/enable-telemetry

# Skip location prompt with --yes (defaults to local settings)
npx claude-code-templates@latest --setting=cleanup/retention-7-days --yes
```

### Installation Flow
When you install a setting, you'll be prompted to choose the installation location:

1. **🏠 User settings** - Global configuration
2. **📁 Project settings** - Shared with team
3. **⚙️ Local settings** - Personal, not committed (default)
4. **🏢 Enterprise settings** - System-wide (requires admin)

## Usage Examples

### Basic Permission Setup
```bash
# Allow npm commands in this project
npx claude-code-templates@latest --setting=permissions/allow-npm-commands

# Prevent modification of sensitive files globally
npx claude-code-templates@latest --setting=permissions/deny-sensitive-files
```

### Model Configuration
```bash
# Use Claude 3.5 Sonnet for this project
npx claude-code-templates@latest --setting=model/use-sonnet

# Use Claude 3 Haiku for faster responses
npx claude-code-templates@latest --setting=model/use-haiku
```

### Telemetry Management
```bash
# Enable telemetry for usage analytics
npx claude-code-templates@latest --setting=telemetry/enable-telemetry

# Disable all telemetry collection
npx claude-code-templates@latest --setting=telemetry/disable-telemetry
```

### Cleanup Policies
```bash
# Set 7-day retention policy
npx claude-code-templates@latest --setting=cleanup/retention-7-days

# Set 90-day retention for long-term projects
npx claude-code-templates@latest --setting=cleanup/retention-90-days
```

## Setting Structure

Each setting is a JSON file that merges into your Claude Code configuration:

```json
{
  "description": "Human-readable description of what this setting does",
  "env": {
    "ENVIRONMENT_VARIABLE": "value"
  },
  "permissions": {
    "allow": ["operation1", "operation2"],
    "deny": ["restricted-operation"]
  },
  "model": {
    "name": "claude-3-5-sonnet-20241022"
  }
}
```

## Conflict Resolution

When installing settings, the CLI will:

1. **Detect Conflicts**: Check if settings would override existing configurations
2. **Prompt User**: Ask whether to proceed with conflicting changes
3. **Merge Intelligently**: Combine settings where possible
4. **Preserve Existing**: Keep current settings unless explicitly overridden

## Best Practices

### Setting Selection
- **Start Local**: Use local settings for experimentation
- **Graduate to Project**: Move stable configurations to project settings
- **Use Enterprise Sparingly**: Only for organization-wide policies
- **Document Choices**: Keep notes on why specific settings were chosen

### Configuration Management
- **Version Control**: Commit `.claude/settings.json` for team sharing
- **Ignore Sensitive**: Keep `.claude/settings.local.json` out of version control
- **Regular Review**: Periodically audit your settings for relevance
- **Backup Important**: Save working configurations before major changes

### Security Considerations
- **Sensitive Data**: Use local settings for API keys and personal tokens
- **Team Safety**: Be cautious with permission settings in shared projects
- **Regular Updates**: Keep settings up-to-date with security patches
- **Least Privilege**: Only enable permissions that are actually needed

## Troubleshooting

### Setting Not Applied?
- Check setting hierarchy (enterprise > user > project > local)
- Verify JSON syntax with a validator
- Restart Claude Code after major setting changes
- Check for typos in environment variable names

### Permission Denied?
- Verify the setting allows the operation you're trying to perform
- Check if enterprise settings override your local configuration
- Ensure you have necessary system permissions for the operation
- Review the `permissions.deny` array for blocked operations

### Environment Variables Not Working?
- Restart your terminal/IDE after setting environment variables
- Use `echo $VARIABLE_NAME` to verify environment variables are set
- Check if the setting is in the correct configuration file
- Verify environment variables are correctly formatted

## Contributing Settings

Want to add a new setting? Follow these guidelines:

1. **Focus on One Thing**: Each setting should configure one specific aspect
2. **Clear Description**: Include a detailed description of what the setting does
3. **Safe Defaults**: Use conservative defaults that won't break existing setups
4. **Documentation**: Include usage examples and potential conflicts
5. **Testing**: Test with different installation locations and conflict scenarios

---

**Next Steps:**
- [Explore Hooks →](./hooks) - Learn about automation and event-driven actions
- [Browse All Settings](https://aitmpl.com) - View available settings in the web interface
- [Contributing Guide →](../contributing) - Add your own settings to the collection