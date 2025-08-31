---
sidebar_position: 1
---

# Individual Components

In addition to complete project templates, **Claude Code Templates** now offers **Individual Components** that can be browsed and installed separately. This gives you granular control over which specific tools and integrations you want to add to your Claude Code setup.

## Component Types

The system provides five distinct types of components:

### 🤖 Agents
**AI specialists for specific development tasks**

Agents are specialized Claude Code assistants designed to excel in particular areas of development. Each agent comes with domain-specific knowledge and optimized prompts for focused tasks.

**Examples:**
- `react-performance-optimization` - Specializes in React performance analysis and optimization
- `api-security-audit` - Focuses on API security best practices and vulnerability detection  
- `database-optimization` - Expert in database query optimization and schema design

[Learn more about Agents →](./agents)

### ⚡ Commands
**Custom slash commands for Claude Code**

Commands are pre-built slash commands that extend Claude Code's functionality with project-specific actions. They provide quick access to common development tasks and workflows.

**Examples:**
- `check-file` - Quickly analyze file structure and potential issues
- `generate-tests` - Auto-generate test files based on existing code
- `optimize-imports` - Clean up and optimize import statements

[Learn more about Commands →](./commands)

### 🔌 MCPs (Model Context Protocol)
**External service integrations**

MCPs enable Claude Code to interact with external services and tools, expanding its capabilities beyond the local development environment.

**Examples:**
- `github-integration` - Direct GitHub repository interactions
- `database-integration` - Connect to and query databases directly
- `deepgraph-react` - Advanced React component analysis and visualization

[Learn more about MCPs →](./mcps)

### ⚙️ Settings
**Configuration options to customize Claude Code behavior**

Settings are JSON-based configuration components that customize how Claude Code operates. They allow you to configure environment variables, permissions, model preferences, and cleanup policies to match your development workflow.

**Examples:**
- `allow-npm-commands` - Enable npm-related operations
- `use-sonnet` - Configure Claude 3.5 Sonnet model
- `enable-telemetry` - Enable usage analytics and improvements

[Learn more about Settings →](./settings)

### 🪝 Hooks
**Event-driven automation for Claude Code workflows**

Hooks are powerful automation components that execute shell commands in response to specific Claude Code events. They enable automated workflows, notifications, and integrations that react to your development activities.

**Examples:**
- `auto-git-add` - Automatically stage modified files with git
- `telegram-notifications` - Send Telegram messages when work completes
- `smart-formatting` - Auto-format code using appropriate tools

[Learn more about Hooks →](./hooks)

## Web Interface

The **unified web interface** provides an intuitive way to browse and install individual components:

To access the web interface, simply go to https://aitmpl.com

**Interface Features:**
- **Unified Filter System**: Browse all component types (Templates, Agents, Commands, MCPs, Settings, Hooks) in a single view
- **Category Filtering**: Filter by specific component types using the navigation bar
- **Card Flip Functionality**: Hover over component cards to reveal installation commands
- **Individual Browsing**: Each component shows detailed information and usage examples
- **"Add New" Cards**: Easy contribution workflow for adding new components

## Installation Methods

### Complete Templates vs Individual Components

| Method | Use Case | Installation |
|--------|----------|-------------|
| **Complete Templates** | Full project setup with multiple components | `npx claude-code-templates@latest --template=react --yes` |
| **Individual Components** | Selective component installation | `npx claude-code-templates@latest --agent=name --yes` |

### Installation Commands by Type

#### Installing Agents
Agents can now be installed individually using the `--agent` parameter:

```bash
# Install specific agents directly
npx claude-code-templates@latest --agent=react-performance --yes
npx claude-code-templates@latest --agent=api-security-audit --yes
npx claude-code-templates@latest --agent=database-optimization --yes

# Install complete template with all agents
npx claude-code-templates@latest --template=react --yes

# Or browse available agents in the web interface
npx claude-code-templates@latest
```

#### Installing Commands
Commands can now be installed using the `--command` parameter or manually:

```bash
# Install specific commands using CLI parameter (recommended)
npx claude-code-templates@latest --command=check-file --yes
npx claude-code-templates@latest --command=generate-tests --yes
npx claude-code-templates@latest --command=optimize-imports --yes

# Manual installation (alternative method)
# Create commands directory first
mkdir -p .claude/commands

# Download specific commands
curl -o .claude/commands/check-file.md \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/commands/check-file.md

curl -o .claude/commands/generate-tests.md \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/commands/generate-tests.md
```

#### Installing MCPs
MCPs can now be installed using the `--mcp` parameter or manually:

```bash
# Install specific MCPs using CLI parameter (recommended)
npx claude-code-templates@latest --mcp=github-integration --yes
npx claude-code-templates@latest --mcp=database-integration --yes
npx claude-code-templates@latest --mcp=deepgraph-react --yes

# Manual installation (alternative method)
# Download specific MCPs
curl -o ./github-integration.json \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/mcps/github-integration.json

curl -o ./database-integration.json \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/mcps/database-integration.json
```

#### Installing Settings
Settings can be installed using the `--setting` parameter with interactive location selection:

```bash
# Install specific settings with location prompt
npx claude-code-templates@latest --setting=permissions/allow-npm-commands
npx claude-code-templates@latest --setting=model/use-sonnet
npx claude-code-templates@latest --setting=telemetry/enable-telemetry

# Install to default location (local settings)
npx claude-code-templates@latest --setting=cleanup/retention-7-days --yes

# Install multiple settings
npx claude-code-templates@latest --setting=model/use-sonnet,telemetry/enable-telemetry --yes
```

**Installation Location Options:**
- **🏠 User settings** (`~/.claude/settings.json`) - Global for all projects
- **📁 Project settings** (`.claude/settings.json`) - Shared with team  
- **⚙️ Local settings** (`.claude/settings.local.json`) - Personal, not committed
- **🏢 Enterprise settings** - System-wide policy (requires admin)

#### Installing Hooks
Hooks can be installed using the `--hook` parameter with location selection:

```bash
# Install specific hooks with location prompt
npx claude-code-templates@latest --hook=git-workflow/auto-git-add
npx claude-code-templates@latest --hook=automation/telegram-notifications
npx claude-code-templates@latest --hook=development-tools/smart-formatting

# Install to default location (local settings)
npx claude-code-templates@latest --hook=testing/test-runner --yes

# Install multiple hooks
npx claude-code-templates@latest --hook=development-tools/file-backup,security/file-protection --yes
```

**Hook Categories:**
- **🔧 development-tools** - Essential development workflow automation
- **🔄 git-workflow** - Git integration and version control
- **🧪 testing** - Automated testing integration
- **⚡ automation** - General purpose automation and notifications
- **🔒 security** - Security monitoring and file protection
- **📊 performance** - Performance monitoring and optimization

## When to Use Templates vs Components

### Use Complete Templates When:
- ✅ Setting up a new project from scratch
- ✅ You want a comprehensive, tested configuration
- ✅ You're new to Claude Code and want everything configured properly
- ✅ You prefer opinionated setups with best practices included

### Use Individual Components When:
- ✅ You have an existing Claude Code setup to enhance
- ✅ You only need specific functionality (e.g., just GitHub integration)
- ✅ You want to gradually add capabilities to your workflow
- ✅ You're experimenting with new tools and integrations
- ✅ You have custom requirements that don't match standard templates

## Component Discovery

### Via Web Interface
The primary way to discover components is through the unified web interface:

1. Run `npx claude-code-templates@latest`
2. Select "⚙️ Project Setup"
3. Browse components with the unified filter system
4. Use category filters to focus on specific types
5. Hover over cards to see installation commands

### Via CLI Parameters
The quickest way to install components is using dedicated CLI parameters:

```bash
# Direct component installation
npx claude-code-templates@latest --agent=react-performance --yes
npx claude-code-templates@latest --command=check-file --yes
npx claude-code-templates@latest --mcp=github-integration --yes
npx claude-code-templates@latest --setting=model/use-sonnet --yes
npx claude-code-templates@latest --hook=git-workflow/auto-git-add --yes
```

### Via GitHub Repository
You can also browse components directly in the repository:

- **Templates**: `/templates/` directory
- **Agents**: `/components/agents/` directory  
- **Commands**: `/components/commands/` directory
- **MCPs**: `/components/mcps/` directory
- **Settings**: `/components/settings/` directory
- **Hooks**: `/components/hooks/` directory

## Contributing Components

The system welcomes community contributions! Each component type has "Add New" cards in the web interface that guide you through the contribution process.

**General Contribution Workflow:**
1. Fork the repository
2. Add your component to the appropriate directory
3. Follow the component-specific guidelines
4. Test your component thoroughly
5. Submit a pull request with documentation

[Learn more about contributing →](../contributing)

## Best Practices

### Component Selection
- **Start Small**: Begin with individual components to understand their impact
- **Test Thoroughly**: Always test components in a development environment first
- **Read Documentation**: Each component includes specific usage instructions
- **Check Dependencies**: Ensure your environment supports the component's requirements

### Installation Management
- **Use Version Control**: Commit your `.claude/` directory to track changes
- **Document Choices**: Keep notes on why you selected specific components
- **Regular Updates**: Periodically check for component updates
- **Backup Configurations**: Save working configurations before adding new components

### Integration Strategy
- **Gradual Integration**: Add components one at a time to identify issues
- **Compatibility Testing**: Ensure new components work with existing setup
- **Performance Monitoring**: Watch for performance impacts after adding components
- **Workflow Optimization**: Regularly review and optimize your component setup

---

**Next Steps:**
- [Explore Agents →](./agents) - Learn about AI specialists for development tasks
- [Discover Commands →](./commands) - Find slash commands to enhance your workflow  
- [Understand MCPs →](./mcps) - Integrate external services with Claude Code
- [Configure Settings →](./settings) - Customize Claude Code behavior and preferences
- [Automate with Hooks →](./hooks) - Set up event-driven automation workflows
- [Browse All Components](https://aitmpl.com) - Visit the web interface