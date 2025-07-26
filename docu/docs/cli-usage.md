---
sidebar_position: 2
---

# CLI Usage Guide

The Claude Code Templates CLI provides several powerful commands to help you manage and set up your development environment.

## Installation

```bash
npm install -g claude-code-templates
```

## Basic Commands

### Interactive Template Selection

Run the CLI without any arguments to get an interactive template selector:

```bash
claude-code-templates
```

This will show you:
- Available templates organized by language/framework
- Template descriptions and features
- Installation options for each template

### Analytics Dashboard

Launch the real-time analytics dashboard to monitor your Claude Code usage:

```bash
claude-code-templates --analytics
# or
npx claude-code-templates@latest --analytics
```

Features include:
- **Real-time Session Monitoring**: Track active Claude Code conversations
- **Performance Metrics**: Memory usage, token consumption, tool usage
- **State Detection**: See when Claude is working, user is typing, etc.
- **Export Capabilities**: Download conversation data as CSV/JSON
- **WebSocket Updates**: Live updates without page refresh

### Health Check

Run comprehensive diagnostics on your Claude Code setup:

```bash
claude-code-templates --health-check
# or
npx claude-code-templates@latest --health-check
```

The health check analyzes:
- ✅ Claude Code installation and version
- ✅ Project configurations and CLAUDE.md files
- ✅ System dependencies and environment
- ✅ Performance optimization recommendations

### Version Information

```bash
claude-code-templates --version
```

### Help

```bash
claude-code-templates --help
```

## Template Installation

When you select a template, you'll have several installation options:

### Option 1: Copy to Current Directory
Copies the template files to your current working directory.

### Option 2: Create New Project
Creates a new directory with the template files.

### Option 3: View Template Details
Shows detailed information about the template including:
- File structure
- Configuration options
- Usage instructions

## Advanced Usage

### Programmatic Usage

You can also use the CLI programmatically in your scripts:

```javascript
const { installTemplate } = require('claude-code-templates');

await installTemplate('react-app', './my-project');
```

### Custom Templates

To contribute your own templates:

1. Fork the repository
2. Add your template to the appropriate language folder
3. Include proper `CLAUDE.md` configuration
4. Submit a pull request

## Analytics Dashboard Features

The analytics dashboard provides comprehensive insights:

### Real-time Monitoring
- Live conversation status updates
- Active project tracking
- Session duration monitoring

### Performance Analysis
- Token usage statistics
- Tool usage patterns
- Memory and CPU monitoring

### Data Export
- Export conversation history as CSV
- Generate usage reports
- Backup conversation data

### Browser Notifications
- Desktop alerts for state changes
- Configurable notification preferences
- Integration with system notifications

## Troubleshooting

### Common Issues

**Command not found**: Make sure the package is installed globally:
```bash
npm list -g claude-code-templates
```

**Permission errors**: On macOS/Linux, you might need to use sudo:
```bash
sudo npm install -g claude-code-templates
```

**Analytics not loading**: Check that no other service is using port 3333:
```bash
lsof -i :3333
```

### Getting Support

- Check the [GitHub Issues](https://github.com/davila7/claude-code-templates/issues)
- Review the troubleshooting guide
- Join community discussions