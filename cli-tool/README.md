[![npm version](https://img.shields.io/npm/v/claude-code-templates.svg)](https://www.npmjs.com/package/claude-code-templates)
[![npm downloads](https://img.shields.io/npm/dt/claude-code-templates.svg)](https://www.npmjs.com/package/claude-code-templates)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open Source](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://opensource.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/davila7/claude-code-templates/blob/main/CONTRIBUTING.md)
[![GitHub stars](https://img.shields.io/github/stars/davila7/claude-code-templates.svg?style=social&label=Star)](https://github.com/davila7/claude-code-templates)

# Claude Code Templates

**CLI tool for configuring and monitoring Claude Code** - Quick setup for any project with framework-specific commands and real-time monitoring dashboard.

## 🚀 Quick Start

```bash
# Interactive setup (recommended)
npx claude-code-templates@latest

# Real-time analytics dashboard (http://localhost:3333)
npx claude-code-templates@latest --analytics

# Browse your conversations (http://localhost:9876)
npx claude-code-templates@latest --chats

# System health check
npx claude-code-templates@latest --health-check
```

Both dashboards listen on 127.0.0.1 only. The flags removed in 1.31.0 (`--plugins`, `--sandbox`, `--tunnel`, `--create-agent` and others) print what replaced them; see the [CHANGELOG](https://github.com/davila7/claude-code-templates/blob/main/CHANGELOG.md).

## ✨ Core Features

- **📋 Smart Project Setup** - Auto-detect and configure any project with framework-specific commands
- **📊 Real-time Analytics** - Monitor Claude Code sessions with live state detection and performance metrics
- **🔍 Health Check** - Comprehensive system validation with actionable recommendations
- **🧩 Individual Components** - Install agents, commands, MCPs, settings, hooks, skills, loops and mods individually

## 🎯 What You Get

| Component | Description | Example |
|-----------|-------------|---------|
| **CLAUDE.md** | Project-specific Claude Code configuration | Framework best practices, coding standards |
| **Commands** | Custom slash commands for development tasks | `/generate-tests`, `/check-file`, `/optimize-bundle` |
| **Agents** | AI specialists for specific domains | API security audit, React performance, database optimization |
| **MCPs** | External service integrations | GitHub, databases, development tools |
| **Skills** | Modular capabilities with progressive disclosure | PDF processing, algorithmic art, MCP builder |
| **Analytics** | Real-time monitoring dashboard | Live session tracking, usage statistics, exports |

## 🛠️ Supported Technologies

| Language | Frameworks | Status |
|----------|------------|---------|
| **JavaScript/TypeScript** | React, Vue, Angular, Node.js | ✅ Ready |
| **Python** | Django, Flask, FastAPI | ✅ Ready |
| **Common** | Universal configurations | ✅ Ready |
| **Go** | Gin, Echo, Fiber | 🚧 Coming Soon |
| **Rust** | Axum, Warp, Actix | 🚧 Coming Soon |

## 🎨 Skills (Anthropic Format)

Install modular capabilities that Claude loads dynamically using Anthropic's progressive disclosure pattern:

```bash
# Install individual skills
npx claude-code-templates@latest --skill document-processing/pdf-processing-pro
npx claude-code-templates@latest --skill creative-design/algorithmic-art
npx claude-code-templates@latest --skill development/mcp-builder

# Install multiple skills
npx claude-code-templates@latest --skill document-processing/pdf-anthropic,document-processing/docx,document-processing/xlsx,document-processing/pptx
```

### Featured Skills

#### 🎨 Creative & Design
- **algorithmic-art** - Create generative art using p5.js with seeded randomness
- **canvas-design** - Design beautiful visual art in .png and .pdf formats
- **slack-gif-creator** - Create animated GIFs optimized for Slack

#### 💻 Development & Technical
- **mcp-builder** - Guide for creating high-quality MCP servers
- **artifacts-builder** - Build complex HTML artifacts with React and Tailwind
- **webapp-testing** - Test local web applications using Playwright
- **skill-creator** - Guide for creating effective skills

#### 📄 Document Processing
- **pdf-processing-pro** - Production-ready PDF toolkit (forms, tables, OCR)
- **pdf-anthropic** - Anthropic's comprehensive PDF manipulation toolkit
- **docx** - Create, edit, and analyze Word documents
- **xlsx** - Create, edit, and analyze Excel spreadsheets
- **pptx** - Create, edit, and analyze PowerPoint presentations

#### 🏢 Enterprise & Communication
- **brand-guidelines** - Apply Anthropic's official brand guidelines
- **internal-comms** - Write internal communications (reports, newsletters, FAQs)
- **theme-factory** - Style artifacts with professional themes

### Skills Architecture

Skills follow Anthropic's progressive disclosure pattern:
- **Metadata** - Always loaded (name, description)
- **Instructions** - Loaded when skill is triggered
- **Resources** - Reference files loaded only when needed
- **Scripts** - Execute without loading code into context

### Attribution

Skills from [anthropics/skills](https://github.com/anthropics/skills):
- **Open Source** (Apache 2.0): algorithmic-art, mcp-builder, skill-creator, artifacts-builder, and more
- **Source-Available** (Reference): docx, pdf-anthropic, pptx, xlsx

See [ANTHROPIC_ATTRIBUTION.md](cli-tool/components/skills/ANTHROPIC_ATTRIBUTION.md) for complete license information.

## 📖 Documentation

**[📚 Complete Documentation](https://docs.aitmpl.com/)** - Comprehensive guides, examples, and API reference

Quick links:
- [Getting Started](https://docs.aitmpl.com/docs/intro) - Installation and first steps
- [Project Setup](https://docs.aitmpl.com/docs/project-setup/interactive-setup) - Configure your projects
- [Analytics Dashboard](https://docs.aitmpl.com/docs/analytics/overview) - Real-time monitoring
- [Individual Components](https://docs.aitmpl.com/docs/components/overview) - Agents, Commands, MCPs
- [CLI Options](https://docs.aitmpl.com/docs/cli-options) - All available commands

## 🤝 Contributing

We welcome contributions! Browse available templates and components at **[aitmpl.com](https://aitmpl.com)**, then check our [contributing guidelines](https://github.com/davila7/claude-code-templates/blob/main/CONTRIBUTING.md).

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **🌐 Browse Components**: [aitmpl.com](https://aitmpl.com)
- **📚 Documentation**: [docs.aitmpl.com](https://docs.aitmpl.com)
- **🐛 Issues**: [GitHub Issues](https://github.com/davila7/claude-code-templates/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/davila7/claude-code-templates/discussions)

---

**⭐ Found this useful? Give us a star to support the project!**