---
sidebar_position: 3
---

# Settings

Claude Code configurations that customize behavior and performance. Browse and install from **[aitmpl.com](https://aitmpl.com)**.

## ⚙️ What are Settings?

Settings modify how Claude Code behaves in your project. They control performance, security, interface, and workflow preferences.

## Installation

### 📦 Basic Installation
Install this component locally in your project. Works with your existing Claude Code setup.

```bash
npx claude-code-templates@latest --setting performance/performance-optimization --yes
```

### Multiple Settings
```bash
npx claude-code-templates@latest --setting security/read-only-mode,performance/bash-timeouts --yes
```

## 🔧 Special: Statusline Settings

Statuslines include Python scripts for real-time monitoring:

### Git Branch Monitor
```bash
npx claude-code-templates@latest --setting statusline/git-branch-statusline --yes
```
Shows current Git branch and status in Claude Code interface.

### Context Monitor
```bash
npx claude-code-templates@latest --setting statusline/context-monitor --yes
```
Displays project context and active files.

## ⚠️ Important Notes

### File Locations
Settings are installed to:
- **`.claude/settings/`** - JSON configuration files
- **`.claude/scripts/`** - Python scripts (for statuslines)

### Environment Impact
- **Performance settings** affect Claude Code speed
- **Security settings** may restrict functionality
- **Git settings** change version control behavior

## 📁 Setting Categories

Browse settings by functional area to customize Claude Code behavior:

### Performance
Optimize Claude Code speed and resource usage. Examples: `performance-optimization` for faster execution, `bash-timeouts` for command limits, `memory-optimization` for resource management.

### Security
Control access and protect sensitive operations. Examples: `read-only-mode` for restricted file access, `deny-sensitive-files` for blocking confidential data, `sandbox-mode` for isolated execution.

### Git Integration
Version control and Git workflow configurations. Examples: `allow-git-operations` for Git access, `auto-commit-settings` for automated commits, `commit-message-templates` for consistent messaging.

### Interface
Customize Claude Code appearance and interaction. Examples: `dark-mode` for visual preference, `compact-mode` for space efficiency, `keyboard-shortcuts` for productivity.

### Statuslines
Real-time monitoring with Python scripts. Examples: `git-branch-statusline` for Git status display, `context-monitor` for project awareness, `performance-monitor` for system metrics.

### Workflow
Development process optimizations. Examples: `auto-save` for automatic saving, `smart-suggestions` for intelligent recommendations, `code-formatting` for consistent styling.

## 🎯 How to Choose Settings

Select settings based on your project requirements and preferences:

### By Project Security Level
- **High security projects**: Use `read-only-mode` and `deny-sensitive-files` for maximum protection
- **Medium security**: Apply `restrict-file-access` for controlled access
- **Development environment**: Enable `allow-git-operations` for full Git functionality

### By Performance Needs
- **Large projects**: Choose `performance-optimization` and `memory-optimization` for better handling
- **Slow command execution**: Use `bash-timeouts` to prevent hanging processes
- **MCP connection issues**: Apply `mcp-timeouts` for reliable integrations

### By Workflow Type
- **Git-heavy workflows**: Enable `allow-git-operations` with `git-branch-statusline` for Git awareness
- **Team collaboration**: Use `commit-message-templates` and `code-formatting` for consistency
- **Solo development**: Focus on `auto-save` and `custom-theme` for personal productivity

## 💡 Pro Tips

- **Start with performance settings** for better experience
- **Add security settings** for production projects
- **Use statuslines** for real-time project monitoring
- **Browse [aitmpl.com](https://aitmpl.com)** for specialized configurations

---

**Find more settings:** [Browse all settings on aitmpl.com](https://aitmpl.com) → Filter by "Settings"