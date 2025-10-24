[![npm version](https://img.shields.io/npm/v/claude-code-templates.svg)](https://www.npmjs.com/package/claude-code-templates)
[![npm downloads](https://img.shields.io/npm/dt/claude-code-templates.svg)](https://www.npmjs.com/package/claude-code-templates)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open Source](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://opensource.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub stars](https://img.shields.io/github/stars/davila7/claude-code-templates.svg?style=social&label=Star)](https://github.com/davila7/claude-code-templates)
[![Mentioned in Awesome Claude Code](https://awesome.re/mentioned-badge-flat.svg)](https://github.com/hesreallyhim/awesome-claude-code)
[![Buy Me a Coffee](https://img.shields.io/badge/☕-Buy%20me%20a%20coffee-ffdd00?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/daniavila)



# Claude Code Templates (aitmpl.com)

**Ready-to-use configurations for Anthropic's Claude Code.** A comprehensive collection of AI agents, custom commands, settings, hooks, external integrations (MCPs), and project templates to enhance your development workflow.

## Browse & Install Components and Templates

**[Browse All Templates](https://aitmpl.com)** - Interactive web interface to explore and install 100+ agents, commands, settings, hooks, and MCPs.

<img width="1049" height="855" alt="Screenshot 2025-08-19 at 08 09 24" src="https://github.com/user-attachments/assets/e3617410-9b1c-4731-87b7-a3858800b737" />

## 🚀 Quick Installation

```bash
# Install a complete development stack
npx claude-code-templates@latest --agent development-team/frontend-developer --command testing/generate-tests --mcp development/github-integration

# Browse and install interactively
npx claude-code-templates@latest

# Install specific components
npx claude-code-templates@latest --agent business-marketing/security-auditor
npx claude-code-templates@latest --command performance/optimize-bundle
npx claude-code-templates@latest --setting performance/mcp-timeouts
npx claude-code-templates@latest --hook git/pre-commit-validation
npx claude-code-templates@latest --mcp database/postgresql-integration
```
| Component | Description | Examples |
|-----------|-------------|----------|
| **🤖 Agents** | AI specialists for specific domains | Security auditor, React performance optimizer, database architect |
| **⚡ Commands** | Custom slash commands | `/generate-tests`, `/optimize-bundle`, `/check-security` |
| **🔌 MCPs** | External service integrations | GitHub, PostgreSQL, Stripe, AWS, OpenAI |
| **⚙️ Settings** | Claude Code configurations | Timeouts, memory settings, output styles |
| **🪝 Hooks** | Automation triggers | Pre-commit validation, post-completion actions |
| **📦 Templates** | Complete project configurations with CLAUDE.md, .claude/* files and .mcp.json | Framework-specific setups, project best practices |

## 🛠️ Additional Tools

Beyond the template catalog, Claude Code Templates includes powerful development tools:

### 📊 Claude Code Analytics
Monitor your AI-powered development sessions in real-time with live state detection and performance metrics.

```bash
npx claude-code-templates@latest --analytics
```

### 💬 Conversation Monitor  
Mobile-optimized interface to view Claude responses in real-time with secure remote access.

```bash
# Local access
npx claude-code-templates@latest --chats

# Secure remote access via Cloudflare Tunnel
npx claude-code-templates@latest --chats --tunnel
```

### 🔍 Health Check
Comprehensive diagnostics to ensure your Claude Code installation is optimized.

```bash
npx claude-code-templates@latest --health-check
```

### 🔌 Plugin Dashboard
View marketplaces, installed plugins, and manage permissions from a unified interface.

```bash
npx claude-code-templates@latest --plugins
```

## 📖 Documentation

**[📚 docs.aitmpl.com](https://docs.aitmpl.com/)** - Complete guides, examples, and API reference for all components and tools.

## Contributing

We welcome contributions! **[Browse existing templates](https://aitmpl.com)** to see what's available, then check our [contributing guidelines](CONTRIBUTING.md) to add your own agents, commands, MCPs, settings, or hooks.

**Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.**

## Attribution

This collection includes components from multiple sources:

**Agents Collection:**
- **wshobson/agents Collection** by [wshobson](https://github.com/wshobson/agents) - Licensed under MIT License (48 agents)

**Commands Collection:**
- **awesome-claude-code Commands** by [hesreallyhim](https://github.com/hesreallyhim/awesome-claude-code) - Licensed under CC0 1.0 Universal (21 commands)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **🌐 Browse Templates**: [aitmpl.com](https://aitmpl.com)
- **📚 Documentation**: [docs.aitmpl.com](https://docs.aitmpl.com)
- **💬 Community**: [GitHub Discussions](https://github.com/davila7/claude-code-templates/discussions)
- **🐛 Issues**: [GitHub Issues](https://github.com/davila7/claude-code-templates/issues)

## ⭐ Star History

<a href="https://star-history.com/#davila7/claude-code-templates&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=davila7/claude-code-templates&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=davila7/claude-code-templates&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=davila7/claude-code-templates&type=Date" />
  </picture>
</a>

---

**⭐ Found this useful? Give us a star to support the project!**

[![Buy Me A Coffee](https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&slug=daniavila&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff)](https://buymeacoffee.com/daniavila)
