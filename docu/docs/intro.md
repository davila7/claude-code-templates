---
sidebar_position: 1
---

# Claude Code Templates

**Claude Code Templates** is a powerful Command Line Interface (CLI) tool designed to streamline the setup, configuration, and monitoring of your Claude Code projects. It provides both complete project templates and individual components (Agents, Commands, MCPs) to ensure the correct and efficient utilization of Claude Code within your development workflow.

## Key Functionalities

The core functionality of `claude-code-templates` revolves around these key areas:

```bash
npx claude-code-templates@latest
# Or use the new template-specific syntax:
npx claude-code-templates@latest --template=react --yes
```

### 🚀 Project Setup & Configuration
Automated project configuration and optimization with **real-time GitHub downloads**:
- **Framework Detection**: Automatically identifies your project type (e.g., React, Vue, Angular, Django, FastAPI) and suggests optimal configurations.
- **CLAUDE.md Generation**: Creates a customized `CLAUDE.md` file with project-specific instructions and best practices.
- **Command Configuration**: Sets up pre-configured development, build, and test commands tailored to your stack.
- **Agent Installation**: Installs specialized Claude Code agents for framework-specific assistance.
- **GitHub Integration**: All templates and components are downloaded directly from GitHub, ensuring latest versions.
- **Workflow Optimization**: Implements Claude Code-specific enhancements and best practices for an optimized development workflow.

### 🧩 Individual Components
Granular control over Claude Code functionality with **dedicated CLI parameters**:
- **🤖 Agents**: AI specialists for specific development tasks (`--agent=react-performance`, `--agent=api-security-audit`)
- **⚡ Commands**: Custom slash commands for Claude Code (`--command=check-file`, `--command=generate-tests`)
- **🔌 MCPs**: Model Context Protocol integrations (`--mcp=github-integration`, `--mcp=database-integration`)
- **Direct Installation**: Install components individually using specific CLI parameters
- **GitHub Downloads**: All components download directly from GitHub's `components/` directory
- **Flexible Installation**: Choose between complete templates (`--template`) or selective component installation

### 📊 Real-time Analytics Dashboard & Agent Chats Manager
Complementary monitoring and analysis tools:
- **Live Session Tracking**: Monitor active Claude Code conversations and their status in real-time.
- **Usage Statistics**: Gain insights into total sessions, token usage, and project activity trends.
- **Conversation History**: Access complete session logs with export capabilities (CSV/JSON).
- **Performance Metrics**: Track Claude Code agent performance and identify optimization opportunities.
- **Web Interface**: Access a clean, terminal-style dashboard at `http://localhost:3333` for real-time monitoring.

### 🔍 Comprehensive Health Check
Environment and configuration validation:
- **System Requirements Verification**: Validates your operating system, Node.js version, memory, and network connectivity.
- **Claude Code Setup Validation**: Checks Claude Code installation, authentication, and permissions.
- **Project Configuration Analysis**: Analyzes your project structure and configuration files for potential issues.
- **Custom Commands & Hooks Validation**: Verifies the integrity and availability of your custom slash commands and automation hooks.
- **Overall Health Score**: Provides an overall system health percentage with actionable recommendations for improvements.

## Quick Start

### 1. Modern Template Installation (Recommended)
```bash
# Quick template installation with new syntax
npx claude-code-templates@latest --template=react --yes
npx claude-code-templates@latest --template=python --yes
npx claude-code-templates@latest --template=nodejs --yes

# Or use interactive setup for guidance
cd your-project-directory
npx claude-code-templates@latest
```

### 2. Individual Component Installation
```bash
# Install specific components using new CLI parameters
npx claude-code-templates@latest --agent=react-performance --yes
npx claude-code-templates@latest --command=check-file --yes
npx claude-code-templates@latest --mcp=github-integration --yes
```

### 3. Launch Real-time Analytics Dashboard
```bash
npx claude-code-templates --analytics
# This will launch the real-time monitoring dashboard, accessible at http://localhost:3333.
```

### 4. Run Comprehensive Health Check
```bash
npx claude-code-templates --health-check
# This command performs a comprehensive system validation and provides optimization recommendations.
```

## Technical Architecture

Built with modern Node.js technologies and **GitHub-first approach**:
- **CLI Framework**: Commander.js for robust command-line interface management.
- **GitHub Integration**: Direct downloads from GitHub repository ensuring latest versions.
- **File Operations**: `fs-extra` for enhanced file system operations.
- **Template Engine**: Custom template processing and generation for dynamic project setups.
- **Download Caching**: Intelligent caching system for improved performance.
- **Analytics Server**: Express.js with WebSocket support for real-time data streaming (optional).
- **Monitoring**: Chokidar for efficient file system watching (primarily for analytics).

## Documentation

- **[Project Setup & Configuration](./project-setup/interactive-setup)** - Detailed guide on setting up your projects.
- **[Individual Components](./components/overview)** - Browse and install Agents, Commands, and MCPs individually.
- **[Analytics Dashboard](./analytics/overview)** - Explore real-time monitoring and analysis tools.
- **[Health Check](./health-check/overview)** - Understand system validation and optimization.
-   **[Core Concepts](/docs/project-setup/what-gets-installed)** - Dive into the underlying structure and components.
- **[Usage Examples](./usage-examples/interactive-setup)** - Practical examples of how to use the CLI.
- **[CLI Options](./cli-options)** - A complete reference of all available command-line options.
- **[Safety Features](./safety-features)** - Learn about the built-in safeguards.
- **[Contributing](./contributing)** - Guidelines for contributing to the project.
- **[Support](./support)** - Where to find help and report issues.
