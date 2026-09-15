# Contributing to Claude Code Templates

We welcome contributions! Help us make Claude Code even better for everyone.

**📋 Before contributing, please read our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a respectful and inclusive environment for all community members.**

## 🧩 Contributing Components

The easiest way to contribute is by adding individual components like agents, commands, MCPs, settings, or hooks.

### 🤖 Adding Agents

Agents are AI specialists for specific domains (security, performance, frameworks, etc.).

1. **Create Agent File**
   ```bash
   # Navigate to appropriate category
   cd cli-tool/components/agents/[category]/
   
   # Create your agent file
   touch your-agent-name.md
   ```

2. **Agent File Structure**

   Every agent must start with YAML frontmatter. Claude Code reads `name` and `description` from this block; without it, the component can appear in the catalog but fail to load.

   ```markdown
   ---
   name: your-agent-name
   description: "Use this agent when you need focused help with a specific domain or workflow."
   ---

   # Agent Name
   
   Agent description and purpose.
   
   ## Expertise
   - Specific domain knowledge
   - Key capabilities
   - Use cases
   
   ## Instructions
   Detailed instructions for Claude on how to act as this agent.
   
   ## Examples
   Practical examples of agent usage.
   ```

3. **Available Categories**
   - `accessibility/` - Accessibility auditing and WCAG compliance
   - `ai-specialists/` - LLM and AI tooling specialists
   - `api-graphql/` - API design and GraphQL specialists
   - `business-marketing/` - Business analysis, marketing, sales
   - `data-ai/` - Data engineering, ML, and prompt engineering
   - `database/` - Database specialists
   - `development-team/` - Full-stack developers, architects
   - `development-tools/` - Tool specialists, testing, observability
   - `devops-infrastructure/` - Cloud, IaC, and deployment specialists
   - `documentation/` - Documentation and technical writing
   - `expert-advisors/` - Architecture review and advisory agents
   - `git/` - Git workflow and commit hygiene
   - `performance-testing/` - Profiling and load testing
   - `security/` - Application and infrastructure security
   - `ui-analysis/` - UI review and design analysis
   - `web-tools/` - SEO and web optimization

4. **Creating New Categories**
   If your agent doesn't fit existing categories, create a new one:
   ```bash
   # Create new category folder
   cd cli-tool/components/agents/
   mkdir your-new-category
   
   # Add your agent file to the new category
   cd your-new-category/
   touch your-agent-name.md
   ```

### ⚡ Adding Commands

Commands are custom slash commands that extend Claude Code functionality.

1. **Create Command File**
   ```bash
   cd cli-tool/components/commands/[category]/
   touch your-command-name.md
   ```

2. **Command File Structure**

   Every command must start with YAML frontmatter. `description` appears in the slash-command menu. Quote `argument-hint`, or YAML can parse values like `[file]` as a list.

   ```markdown
   ---
   description: "Brief command description shown in the slash-command menu"
   argument-hint: "[file-path]"
   ---

   # /command-name
   
   Brief command description.
   
   ## Purpose
   What this command accomplishes.
   
   ## Usage
   How to use the command with examples.
   
   ## Implementation
   Technical details of what the command does.
   ```

3. **Command Categories**
   - `analysis/` - Code analysis, optimization, debugging
   - `automation/` - CI/CD pipelines and workflow automation
   - `database/` - Database management and migrations
   - `deployment/` - Build, deploy, CI/CD operations
   - `documentation/` - Documentation generation and maintenance
   - `git/` - Git operations
   - `git-workflow/` - Branch, PR, and review workflows
   - `orchestration/` - Multi-agent task orchestration
   - `performance/` - Profiling and optimization
   - `project-management/` - File operations, project structure
   - `security/` - Security auditing workflows
   - `setup/` - Project and environment setup
   - `svelte/` - Svelte and SvelteKit development
   - `testing/` - Test generation, validation, coverage
   - `utilities/` - General-purpose helpers

4. **Creating New Categories**
   If your command doesn't fit existing categories, create a new one:
   ```bash
   # Create new category folder
   cd cli-tool/components/commands/
   mkdir your-new-category
   
   # Add your command file to the new category
   cd your-new-category/
   touch your-command-name.md
   ```

### 🔌 Adding MCPs (Model Context Protocol)

MCPs provide external service integrations for Claude Code.

1. **Create MCP File**
   ```bash
   cd cli-tool/components/mcps/[category]/
   touch your-service-mcp.json
   ```

2. **MCP File Structure**
   ```json
   {
     "mcpServers": {
       "service-name": {
         "command": "npx",
         "args": ["-y", "@your-org/mcp-server"],
         "env": {
           "API_KEY": "<YOUR_API_KEY>",
           "BASE_URL": "https://api.service.com"
         }
       }
     }
   }
   ```

3. **MCP Categories**
   - `audio/` - Audio processing, text-to-speech, transcription services
   - `integration/` - GitHub, GitLab, Jira
   - `database/` - PostgreSQL, MySQL, MongoDB
   - `cloud/` - AWS, Azure, GCP services
   - `devtools/` - Build tools, testing frameworks
   - `ai-services/` - OpenAI, Anthropic, other AI APIs

4. **Creating New Categories**
   If your MCP doesn't fit existing categories, create a new one:
   ```bash
   # Create new category folder
   cd cli-tool/components/mcps/
   mkdir your-new-category
   
   # Add your MCP file to the new category
   cd your-new-category/
   touch your-service-mcp.json
   ```

### ⚙️ Adding Settings

Settings configure Claude Code behavior and performance.

1. **Create Settings File**
   ```bash
   cd cli-tool/components/settings/[category]/
   touch your-setting-name.json
   ```

2. **Settings File Structure**
   ```json
   {
     "setting-category": {
       "parameter": "value",
       "description": "What this setting controls"
     }
   }
   ```

3. **Settings Categories**
   - `performance/` - Memory, timeout, cache settings
   - `ui/` - Interface customization, themes
   - `mcp/` - MCP server configurations
   - `security/` - Access control, permissions

4. **Creating New Categories**
   If your setting doesn't fit existing categories, create a new one:
   ```bash
   # Create new category folder
   cd cli-tool/components/settings/
   mkdir your-new-category
   
   # Add your setting file to the new category
   cd your-new-category/
   touch your-setting-name.json
   ```

### 🪝 Adding Hooks

Hooks provide automation triggers for different development events.

1. **Create Hook File**
   ```bash
   cd cli-tool/components/hooks/[category]/
   touch your-hook-name.json
   ```

2. **Hook File Structure**
   ```json
   {
     "hooks": {
       "hook-name": {
         "event": "trigger-event",
         "command": "action-to-perform",
         "description": "What this hook does"
       }
     }
   }
   ```

3. **Hook Categories**
   - `git/` - Pre-commit, post-commit, pre-push
   - `development/` - File changes, build events
   - `testing/` - Test execution, coverage checks

4. **Creating New Categories**
   If your hook doesn't fit existing categories, create a new one:
   ```bash
   # Create new category folder
   cd cli-tool/components/hooks/
   mkdir your-new-category
   
   # Add your hook file to the new category
   cd your-new-category/
   touch your-hook-name.json
   ```

## 📦 Contributing Templates

Templates are complete project configurations that include CLAUDE.md, .claude/* files, and .mcp.json.

### Creating New Templates

1. **Create Template Directory**
   ```bash
   cd cli-tool/templates/
   mkdir your-template-name
   cd your-template-name
   ```

2. **Template Structure**
   ```
   your-template-name/
   ├── CLAUDE.md                    # Main configuration
   ├── .claude/
   │   ├── settings.json           # Automation hooks
   │   └── commands/               # Template-specific commands
   ├── .mcp.json                   # MCP server configuration
   └── README.md                   # Template documentation
   ```

3. **CLAUDE.md Guidelines**
   - Include project-specific configuration
   - Add development commands and workflows
   - Document best practices and conventions
   - Include security guidelines
   - Provide testing standards

4. **Template Categories**
   - Framework-specific (React, Vue, Angular, etc.)
   - Language-specific (Python, TypeScript, Go, etc.)
   - Domain-specific (API development, machine learning, etc.)
   - Industry-specific (e-commerce, fintech, etc.)

### Template Quality Standards

- **Comprehensive Configuration** - Include all necessary Claude Code setup
- **Clear Documentation** - Well-documented CLAUDE.md with examples
- **Practical Commands** - Useful slash commands for the domain
- **Proper MCPs** - Relevant external integrations
- **Testing** - Test template with real projects

## 🛠️ Contributing to Additional Tools

For advanced contributors who want to improve the CLI tools like analytics, health check, and chat monitoring.

### 🚀 Development Setup

#### Prerequisites
- Node.js 14+ (for the installer)
- npm or yarn
- Git

#### Project Setup
```bash
# Clone the repository
git clone https://github.com/davila7/claude-code-templates.git
cd claude-code-templates

# Navigate to the CLI tool directory
cd cli-tool

# Install dependencies
npm install

# Link for local testing
npm link

# Run test suite
npm test
```

### 📊 Analytics Dashboard Development

The analytics dashboard provides real-time monitoring of Claude Code sessions.

#### Development Workflow
```bash
# Start analytics dashboard
npm run analytics:start

# Clear cache during development
curl -X POST http://localhost:3333/api/cache/clear -H "Content-Type: application/json" -d '{"type":"all"}'

# Refresh data
curl http://localhost:3333/api/refresh

# Restart server completely
pkill -f analytics && sleep 3 && npm run analytics:start
```

#### Architecture
```
src/analytics/
├── core/                     # Business logic
│   ├── StateCalculator.js   # Conversation state detection
│   ├── ProcessDetector.js   # Running process detection
│   ├── ConversationAnalyzer.js # Message parsing
│   └── FileWatcher.js       # Real-time file monitoring
├── data/                    # Data management
│   └── DataCache.js        # Multi-level caching
├── notifications/           # Real-time communication
│   ├── WebSocketServer.js  # Server-side WebSocket
│   └── NotificationManager.js # Event-driven notifications
└── utils/                   # Utilities
    └── PerformanceMonitor.js # System health monitoring
```

#### Common Development Issues

**Problem:** Changes don't appear in dashboard
```bash
# Solution: Clear cache and refresh
curl -X POST http://localhost:3333/api/cache/clear -H "Content-Type: application/json" -d '{"type":"conversations"}'
curl http://localhost:3333/api/refresh
```

**Problem:** WebSocket not updating
```bash
# Solution: Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)
```

### 💬 Chat Monitor Development

Mobile-optimized interface for viewing Claude conversations in real-time.

#### Architecture
```
src/chats/
├── components/              # UI components
├── services/               # API communication
├── websocket/              # Real-time updates
└── styles/                 # Mobile-first CSS
```

#### Development Commands
```bash
# Start chat monitor
npm run chats:start

# Start with tunnel (requires cloudflared)
npm run chats:start -- --tunnel

# Test mobile interface
npm run chats:test
```

### 🔍 Health Check Development

Comprehensive diagnostics tool for Claude Code installations.

#### Health Check Categories
- **Installation Validation** - Claude Code setup verification
- **Configuration Check** - Settings and file validation
- **Performance Analysis** - Memory, disk, network diagnostics
- **Security Audit** - Permission and access checks

#### Development
```bash
# Run health check
npm run health-check

# Add new health check
# 1. Create check in src/health-checks/
# 2. Add to health check registry
# 3. Test with various scenarios
```

## 🧪 Testing

### Component Testing
```bash
# Test component installation
npx claude-code-templates@latest --agent your-agent --dry-run
npx claude-code-templates@latest --command your-command --dry-run
npx claude-code-templates@latest --mcp your-mcp --dry-run
```

### Template Testing
```bash
# Test template installation
npx claude-code-templates@latest --template your-template --dry-run

# Test with specific scenarios
npm start -- --language python --framework django --dry-run
npm start -- --language javascript --framework react --dry-run
```

### Tool Testing
```bash
# Test analytics
npm run analytics:test

# Test chat monitor
npm run chats:test

# Test health check
npm run health-check:test
```

## 🤝 Contribution Process

### 1. Fork and Clone
```bash
git clone https://github.com/your-username/claude-code-templates.git
cd claude-code-templates
```

### 2. Create Feature Branch
```bash
git checkout -b feature/your-contribution
```

### 3. Make Changes
- Follow the guidelines above for your contribution type
- Test thoroughly with real scenarios
- Include comprehensive documentation

### 4. Test Changes
```bash
cd cli-tool
npm run frontmatter:check # when available
npm test
npm start -- --dry-run
```

### 5. Submit Pull Request
- Clear description of changes
- Screenshots for UI changes
- Testing instructions
- Reference related issues

## 🎯 What We're Looking For

### High Priority Components
- **Security Agents** - Security auditing, vulnerability scanning
- **Performance Commands** - Optimization, profiling, monitoring
- **Cloud MCPs** - AWS, Azure, GCP integrations
- **Framework Agents** - React, Vue, Angular, Next.js specialists

### High Priority Templates  
- **Modern Frameworks** - Svelte, SvelteKit, Astro, Qwik
- **Backend Frameworks** - NestJS, Fastify, Hono, tRPC
- **Full-Stack** - T3 Stack, create-remix-app, SvelteKit
- **Mobile** - React Native, Expo, Flutter

### Medium Priority Tools
- **Analytics Enhancements** - Better visualizations, export options
- **Chat Monitor Features** - Search, filtering, conversation history
- **Health Check Improvements** - More diagnostic categories, fix suggestions

## 📞 Getting Help

### Community Support
- **GitHub Issues** - [Report bugs or request features](https://github.com/davila7/claude-code-templates/issues)
- **GitHub Discussions** - [Join community discussions](https://github.com/davila7/claude-code-templates/discussions)
- **Documentation** - [Complete guides at docs.aitmpl.com](https://docs.aitmpl.com/)

### Quick Start Guides
- **Browse Components** - [aitmpl.com](https://aitmpl.com) to see existing components
- **Component Examples** - Check existing components for structure reference
- **Template Examples** - Review successful templates for best practices

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

All contributors are recognized in our:
- **GitHub Contributors** page
- **Release Notes** for significant contributions  
- **Community Discussions** for helpful contributions

Thank you for helping make Claude Code Templates better for everyone! 🚀