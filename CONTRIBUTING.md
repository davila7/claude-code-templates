# Contributing to Claude Code Templates

We welcome contributions! Help us make Claude Code even better for everyone.

**📋 Before contributing, please read our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a respectful and inclusive environment for all community members.**

## 🚀 Development Setup

### Prerequisites
- Node.js 14+ (for the installer)
- npm or yarn
- Git

### Project Setup
```bash
# Clone the repository
git clone https://github.com/davila7/claude-code-templates.git
cd claude-code-templates
```

### CLI Development
```bash
# Navigate to the CLI tool directory
cd cli-tool

# Install dependencies
npm install

# Link for local testing
npm link

# Run test suite
npm test

# Test locally with dry run
npm start -- --dry-run
```

## 🔧 Analytics Dashboard Troubleshooting

### Clear Cache and Refresh Data
When developing the analytics dashboard, you may encounter caching issues where changes don't appear immediately. Use these commands to force refresh:

```bash
# Method 1: Simple refresh
curl http://localhost:3333/api/refresh

# Method 2: Clear cache and refresh
curl -X POST http://localhost:3333/api/cache/clear -H "Content-Type: application/json" -d '{"type":"all"}'
curl http://localhost:3333/api/refresh

# Method 3: Force complete restart (when cache persists)
pkill -f analytics
sleep 3
npm run analytics:start
```

### Common Cache Issues

#### Problem: Changes to conversation analysis don't appear
**Solution:** Clear conversation cache specifically
```bash
curl -X POST http://localhost:3333/api/cache/clear -H "Content-Type: application/json" -d '{"type":"conversations"}'
curl http://localhost:3333/api/refresh
```

#### Problem: Agent detection changes not reflected
**Solution:** Restart the server completely
```bash
# Stop any running analytics processes
pkill -f analytics
sleep 3

# Start fresh
npm run analytics:start
```

#### Problem: WebSocket not updating in browser
**Solution:** Hard refresh browser and reconnect
```bash
# In browser: Ctrl+F5 or Cmd+Shift+R
# Or close and reopen browser tab
```

### Development Workflow Tips

1. **After modifying backend code:** Always restart the server
2. **After changing conversation analysis:** Clear cache and refresh
3. **After updating agent detection:** Full server restart required
4. **After frontend changes:** Hard refresh browser

### Cache API Endpoints

- `GET /api/refresh` - Refresh data without clearing cache
- `POST /api/cache/clear` - Clear specific or all caches
  - `{"type": "all"}` - Clear all caches
  - `{"type": "conversations"}` - Clear only conversation caches

## 🏗️ CLI Architecture

The CLI tool is built with a modular architecture:

```
cli-tool/src/
├── index.js              # Main entry point & CLI setup
├── prompts.js            # Interactive prompts & navigation
├── command-scanner.js    # Scans and loads command templates
├── hook-scanner.js       # Manages automation hooks
├── file-operations.js    # File copying and template processing
├── templates.js          # Template configuration & metadata
├── command-stats.js      # Command analysis functionality
└── utils.js              # Project detection utilities
```

## 🧪 Testing

### Running Tests
```bash
# Run comprehensive test suite
npm test

# Test specific scenarios
npm start -- --language python --framework django --dry-run
npm start -- --language javascript-typescript --framework react --dry-run

# Test interactive mode
npm start

# Test command analysis
npm start -- --command-stats
```

### Testing Checklist
- [ ] Interactive setup works correctly
- [ ] Framework detection is accurate
- [ ] Command installation succeeds
- [ ] Hook configuration is valid
- [ ] MCP servers are properly configured
- [ ] Dry run mode shows expected output
- [ ] Command analysis displays accurate statistics

## 🔄 Template Development

### Adding New Languages

1. **Create Template Directory**
   ```bash
   mkdir cli-tool/templates/language-name
   ```

2. **Add Base Files**
   - `CLAUDE.md` - Language-specific configuration and best practices
   - `.claude/settings.json` - Automation hooks configuration
   - `.claude/commands/` - Directory for language-specific commands
   - `.mcp.json` - Model Context Protocol server configuration

3. **Create Framework Examples**
   ```bash
   mkdir cli-tool/templates/language-name/examples/framework-name
   ```

4. **Update Configuration**
   - Add language configuration in `src/templates.js`
   - Update project detection logic in `src/utils.js` if needed

5. **Add Documentation**
   - Update main README.md with language support
   - Add language-specific README if needed

### Adding New Frameworks

1. **Create Framework Directory**
   ```bash
   mkdir cli-tool/templates/language/examples/framework-name
   ```

2. **Add Framework-Specific Files**
   - Framework-specific `CLAUDE.md` with tailored instructions
   - Custom commands in `.claude/commands/`
   - Framework-specific automation hooks
   - MCP server configurations for framework needs

3. **Test Framework Integration**
   - Test with various project configurations
   - Verify framework detection works correctly
   - Ensure commands work with framework structure

4. **Update Detection Logic**
   - Modify `src/utils.js` to detect framework
   - Add framework-specific package.json patterns
   - Update template selection logic

## 📝 Template Guidelines

### File Structure
Follow the established folder structure:
```
language-name/
├── CLAUDE.md                    # Language configuration
├── .claude/
│   ├── settings.json           # Automation hooks
│   └── commands/               # Base commands
├── .mcp.json                   # MCP server configuration
├── examples/
│   ├── framework-1/
│   │   ├── CLAUDE.md           # Framework-specific config
│   │   └── .claude/commands/   # Framework commands
│   └── framework-2/
│       ├── CLAUDE.md
│       └── .claude/commands/
└── README.md                   # Language documentation
```

### Quality Standards

#### CLAUDE.md Files
- Include comprehensive language-specific configuration
- Add development commands and workflows
- Document best practices and conventions
- Include security guidelines
- Provide testing standards

#### Command Files
- Use clear, descriptive names
- Include comprehensive documentation
- Add practical examples
- Follow language conventions
- Test with real projects

#### Automation Hooks
- Focus on developer productivity
- Include security checks
- Add code quality enforcement
- Test hook reliability
- Document hook behavior

### Content Guidelines
- Write clear, concise documentation
- Use practical, real-world examples
- Include error handling guidance
- Add security considerations
- Test all examples before submitting

## 🤝 How to Contribute

### 1. Fork the Repository
```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/your-username/claude-code-templates.git
cd claude-code-templates
```

### 2. Create a Feature Branch
```bash
git checkout -b feature/amazing-template
```

### 3. Make Your Changes
- Follow the template guidelines above
- Add comprehensive documentation
- Test your changes thoroughly
- Include relevant examples

### 4. Test Your Changes
```bash
# Test the CLI tool
cd cli-tool
npm test
npm start -- --dry-run

# Test specific scenarios
npm start -- --language your-language --framework your-framework --dry-run
```

### 5. Submit a Pull Request
- Write a clear PR description
- Include screenshots if relevant
- Reference related issues
- Add testing instructions

## 🎯 What We're Looking For

### High Priority
- **New Language Support** - Rust, Go, Java, C#, PHP, etc.
- **Framework Templates** - Svelte, Next.js, Nuxt.js, NestJS, Laravel, Spring Boot, etc.
- **Improved Commands** - Better testing, deployment, debugging workflows
- **Security Enhancements** - Better security checks and practices
- **Performance Improvements** - Faster installation and better UX

### Medium Priority
- **Documentation** - Clearer guides and examples
- **Bug Fixes** - Improvements to existing templates
- **Feature Enhancements** - New CLI features and options
- **Testing** - Better test coverage and scenarios

### Low Priority
- **Code Cleanup** - Refactoring and code organization
- **Minor Improvements** - Small UX enhancements
- **Optimization** - Performance tweaks

## 📋 Contribution Process

### Code Review Process
1. **Automated Checks** - CI/CD pipeline runs tests
2. **Manual Review** - Maintainers review code and templates
3. **Testing** - Contributors test with real projects
4. **Documentation Review** - Ensure docs are clear and complete
5. **Merge** - Approved changes are merged

### Review Criteria
- **Functionality** - Does it work as expected?
- **Quality** - Is the code well-written and maintainable?
- **Documentation** - Are changes well-documented?
- **Testing** - Are there adequate tests?
- **Security** - Are security best practices followed?
- **Consistency** - Does it follow project conventions?

## 🛠️ Development Tools

### Required Tools
- **Node.js 14+** - For CLI development
- **npm/yarn** - Package management
- **Git** - Version control

### Recommended Tools
- **VS Code** - IDE with good JavaScript/TypeScript support
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Testing framework

### Useful Commands
```bash
# Format code
npm run format

# Lint code
npm run lint

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Publish to npm (maintainers only)
npm publish
```

## 📞 Getting Help

### Community Support
- **GitHub Issues** - [Report bugs or request features](https://github.com/davila7/claude-code-templates/issues)
- **GitHub Discussions** - [Join community discussions](https://github.com/davila7/claude-code-templates/discussions)
- **Documentation** - [Claude Code Official Docs](https://docs.anthropic.com/en/docs/claude-code)

### Maintainer Contact
- **GitHub** - [@davila7](https://github.com/davila7)
- **Issues** - Use GitHub issues for bug reports and feature requests
- **Discussions** - Use GitHub discussions for questions and ideas

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

All contributors are recognized in our:
- **GitHub Contributors** page
- **Release Notes** for significant contributions
- **Community Discussions** for helpful contributions

Thank you for helping make Claude Code Templates better for everyone! 🚀