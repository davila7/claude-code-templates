---
sidebar_position: 3
---

# Health Check

System validation and optimization for your Claude Code setup.

## Launch Command

```bash
npx claude-code-templates@latest --health-check
```

## What Gets Checked

- **System requirements** - Node.js, npm, Git, memory, network
- **Claude Code setup** - Installation, authentication, permissions
- **Project configuration** - CLAUDE.md, components, settings, hooks
- **Component integrity** - Validates installed agents, commands, MCPs
- **Performance optimization** - Identifies bottlenecks and improvements

## Output

- ✅ **Pass/Fail status** for each check
- 🔧 **Actionable recommendations** for issues found
- 📊 **Performance scores** and optimization tips
- 🚨 **Critical issues** that need immediate attention
- **Agent validation** - Verifies agent configurations and dependencies
- **Command availability** - Tests custom slash command functionality
- **MCP connections** - Validates external service integrations
- **Setting effectiveness** - Checks configuration impact
- **Hook execution** - Tests automation trigger functionality

### Performance Assessment
- **Response times** - Measures Claude Code performance
- **Memory usage** - Analyzes resource consumption
- **File access speed** - Tests file system performance
- **Network latency** - Measures API communication speed
- **Component load times** - Checks startup performance

## 📊 Health Score System

### Overall Health Percentage
The health check provides an overall score (0-100%) based on:
- **Critical issues** (major impact on functionality)
- **Warnings** (performance or configuration concerns)
- **Recommendations** (optimization opportunities)
- **Best practices** (adherence to recommended setup)

### Score Categories
- **90-100%**: Excellent - Optimal configuration
- **75-89%**: Good - Minor improvements possible
- **60-74%**: Fair - Some issues need attention
- **40-59%**: Poor - Multiple problems requiring fixes
- **0-39%**: Critical - Major issues preventing proper function

---

**Next:** Try the [Chats Interface](./chats) for mobile-optimized Claude Code conversations.