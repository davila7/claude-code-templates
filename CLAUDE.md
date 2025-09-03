# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js CLI tool for setting up Claude Code configurations and providing real-time analytics. The project uses modern JavaScript/Node.js development practices and includes a comprehensive analytics dashboard with modular architecture.

## Development Commands

### Package Management
- `npm install` - Install all dependencies
- `npm install --save <package>` - Install a production dependency
- `npm install --save-dev <package>` - Install a development dependency
- `npm update` - Update all dependencies
- `npm audit` - Check for security vulnerabilities
- `npm audit fix` - Fix security vulnerabilities

### Application Commands
- `npm start` - Run the CLI tool
- `npm run analytics:start` - Start the analytics dashboard server
- `npm run analytics:test` - Run analytics-specific tests
- `node src/analytics.js` - Direct analytics server startup

### Testing Commands
- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:analytics` - Run analytics module tests
- `npm run test:all` - Run comprehensive test suite

### Code Quality Commands
- `npm run lint` - Run ESLint (if configured)
- `npm run format` - Format code (if configured)
- `node --check src/analytics.js` - Check syntax

### Development Tools
- `npm run dev:link` - Link package for local development
- `npm run dev:unlink` - Unlink package
- `npm version patch|minor|major` - Bump version
- `npm publish` - Publish to npm registry

## Analytics Dashboard

### Quick Start
```bash
# Start the analytics dashboard
npm run analytics:start

# Open browser to http://localhost:3333
# The dashboard provides real-time monitoring of Claude Code sessions
```

### Key Features
- **Real-time Session Monitoring** - Live tracking of active Claude Code conversations
- **Conversation State Detection** - "Claude working...", "User typing...", "Awaiting input..."
- **Performance Analytics** - System health, memory usage, and performance metrics
- **WebSocket Integration** - Real-time updates without polling
- **Export Capabilities** - CSV/JSON export of conversation data
- **Browser Notifications** - Desktop alerts for state changes

### Architecture
The analytics dashboard follows a modular architecture with:
- **Backend Modules**: StateCalculator, ProcessDetector, ConversationAnalyzer, FileWatcher, DataCache
- **Frontend Components**: Dashboard, ConversationTable, Charts, Services
- **Real-time Communication**: WebSocket server with notification management
- **Performance Monitoring**: Comprehensive metrics and health monitoring
- **Testing Framework**: Unit, integration, and performance tests

## Technology Stack

### Core Technologies
- **Node.js** - Runtime environment (v14.0.0+)
- **Express.js** - Web server framework
- **WebSocket** - Real-time communication (ws library)
- **Chokidar** - File system watching
- **Jest** - Testing framework

### Frontend Technologies
- **Vanilla JavaScript** - No framework dependencies for maximum compatibility
- **Chart.js** - Data visualization
- **WebSocket Client** - Real-time updates
- **CSS3** - Modern styling with responsive design

### Development Tools
- **fs-extra** - Enhanced file system operations
- **chalk** - Terminal string styling
- **boxen** - Terminal boxes
- **commander** - CLI argument parsing
- **inquirer** - Interactive command line prompts

### CLI Dependencies
- **commander** - Command-line interface framework
- **inquirer** - Interactive command line prompts
- **ora** - Terminal spinners
- **boxen** - Terminal boxes for notifications
- **open** - Cross-platform file opener

### Analytics Dependencies
- **express** - Web server framework
- **ws** - WebSocket library for real-time communication
- **chokidar** - File system watcher
- **fs-extra** - Enhanced file system operations
- **chalk** - Terminal string styling

### Testing Framework
- **Jest** - JavaScript testing framework
- **jest-watch-typeahead** - Interactive test watching
- Comprehensive test coverage with unit, integration, and performance tests

### Code Quality Tools
- **ESLint** - JavaScript linting (if configured)
- **Prettier** - Code formatting (if configured)
- **Node.js built-in** - Syntax checking with `node --check`

## Project Structure Guidelines

### File Organization
```
src/
├── index.js             # CLI entry point
├── analytics.js         # Analytics dashboard server
├── analytics/           # Analytics modules
│   ├── core/           # Core business logic
│   │   ├── StateCalculator.js
│   │   ├── ProcessDetector.js
│   │   ├── ConversationAnalyzer.js
│   │   └── FileWatcher.js
│   ├── data/           # Data management
│   │   └── DataCache.js
│   ├── notifications/   # Real-time communication
│   │   ├── WebSocketServer.js
│   │   └── NotificationManager.js
│   └── utils/          # Utilities
│       └── PerformanceMonitor.js
├── analytics-web/       # Frontend components
│   ├── index.html      # Main dashboard page
│   ├── components/     # UI components
│   ├── services/       # Frontend services
│   └── assets/         # Static assets
├── templates/           # Configuration templates
└── utils/              # CLI utilities
tests/
├── unit/               # Unit tests
├── integration/        # Integration tests
├── e2e/               # End-to-end tests
└── fixtures/          # Test data
```

### Naming Conventions
- **Files/Modules**: Use PascalCase for classes (`StateCalculator.js`), camelCase for utilities
- **Classes**: Use PascalCase (`StateCalculator`)
- **Functions/Variables**: Use camelCase (`getUserData`)
- **Constants**: Use UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Private methods**: Prefix with underscore (`_privateMethod`)

## Node.js Guidelines

### Module Organization
- Use CommonJS modules (`module.exports`, `require()`)
- Organize related functionality into classes
- Keep modules focused and single-purpose
- Use dependency injection for testability
- Document public APIs with JSDoc comments

### Code Style
- Use meaningful variable and function names
- Keep functions focused and single-purpose
- Use async/await for asynchronous operations
- Handle errors appropriately with try/catch blocks
- Use console logging with appropriate levels (chalk for styling)

### Best Practices
- Use `fs-extra` for enhanced file operations
- Prefer `path.join()` for cross-platform path handling
- Use async/await instead of callbacks where possible
- Handle process signals for graceful shutdown
- Use environment variables for configuration

## Testing Standards

### Test Structure
- Organize tests to mirror source code structure
- Use descriptive test names that explain the behavior
- Follow AAA pattern (Arrange, Act, Assert)
- Use Jest fixtures and mocks for test data
- Group related tests in `describe` blocks

### Test Categories
- **Unit Tests** - Test individual modules and functions in isolation
- **Integration Tests** - Test module interactions and complete workflows
- **Performance Tests** - Test system performance and memory usage
- **E2E Tests** - Test complete user scenarios end-to-end

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### Coverage Goals
- Aim for 70%+ overall test coverage (80%+ for core modules)
- Write unit tests for business logic
- Use integration tests for module interactions
- Mock external dependencies and services
- Test error conditions and edge cases

### Test Examples
```javascript
// Unit test example
describe('StateCalculator', () => {
  let stateCalculator;
  
  beforeEach(() => {
    stateCalculator = new StateCalculator();
  });
  
  it('should detect active state for recent messages', () => {
    const messages = [/* test data */];
    const lastModified = new Date();
    
    const state = stateCalculator.determineConversationState(messages, lastModified);
    
    expect(state).toBe('active');
  });
});
```

## Dependency Management

### Node.js Environment Setup
```bash
# Ensure Node.js 14+ is installed
node --version

# Install dependencies
npm install

# Install development dependencies
npm install --save-dev jest

# Link for local development
npm link
```

### Package Management Best Practices
- Use `package.json` for dependency management
- Pin major versions to avoid breaking changes
- Use `npm audit` to check for security vulnerabilities
- Keep dependencies up to date with `npm update`

## Analytics Modular Architecture

### Implementation Details
The analytics dashboard has been refactored into a modular architecture in 4 phases:

#### Phase 1: Backend Modularization
- **StateCalculator** - Conversation state detection logic
- **ProcessDetector** - Running process detection and correlation
- **ConversationAnalyzer** - Message parsing and analysis
- **FileWatcher** - Real-time file system monitoring
- **DataCache** - Multi-level caching system

#### Phase 2: Frontend Modularization  
- **Dashboard** - Main component orchestration
- **ConversationTable** - Interactive conversation display
- **Charts** - Data visualization components
- **StateService** - Reactive state management
- **DataService** - API communication with caching
- **WebSocketService** - Real-time communication

#### Phase 3: Real-time Communication
- **WebSocketServer** - Server-side WebSocket management
- **NotificationManager** - Event-driven notifications
- **Real-time Updates** - Live conversation state changes
- **Fallback Mechanisms** - Polling when WebSocket unavailable

#### Phase 4: Testing & Performance
- **Comprehensive Test Suite** - Unit, integration, and performance tests
- **PerformanceMonitor** - System health and metrics tracking
- **Memory Management** - Automatic cleanup and optimization
- **Production Readiness** - Performance monitoring and error tracking

## Security Guidelines

### Dependencies
- Regularly update dependencies with `npm audit` and `npm update`
- Use `npm audit` to check for known vulnerabilities
- Pin major versions in package.json to avoid breaking changes
- Use environment variables for sensitive configuration

### Code Security
- Validate input data appropriately
- Use environment variables for API keys and configuration
- Implement proper error handling without exposing sensitive information
- Sanitize file paths and user inputs
- Use HTTPS for production deployments

## Development Workflow

### Before Starting
1. Check Node.js version compatibility (14.0.0+)
2. Run `npm install` to install dependencies
3. Check syntax with `node --check src/analytics.js`
4. Run initial tests with `npm test`

### During Development
1. Use meaningful variable and function names
2. Run tests frequently to catch issues early: `npm run test:watch`
3. For frontend changes, let user handle analytics server startup - don't run `npm run analytics:start` automatically
4. Use meaningful commit messages

### Before Committing
1. Run full test suite: `npm test`
2. Check syntax: `node --check src/analytics.js`
3. Test analytics functionality: `npm run analytics:test`
4. Ensure no console errors in browser (if testing frontend)
5. Run performance tests if available

## Component System Architecture

### Core Component Types

This CLI tool manages a comprehensive component system for Claude Code configurations:

#### 🤖 Agents (600+ specialists)
AI specialists organized by domain expertise:
- **Development**: `frontend-developer`, `fullstack-developer`, `devops-engineer`
- **Security**: `security-auditor`, `penetration-tester`, `compliance-specialist`
- **Data/AI**: `data-scientist`, `ml-engineer`, `nlp-engineer`
- **Business**: `product-strategist`, `business-analyst`, `legal-advisor`

#### ⚡ Commands (200+ automations)
Custom slash commands for development workflows:
- **Setup**: `/setup-ci-cd-pipeline`, `/setup-testing`, `/migrate-to-typescript`
- **Performance**: `/optimize-bundle`, `/performance-audit`, `/add-caching`
- **Testing**: `/generate-tests`, `/setup-e2e`, `/test-coverage`
- **Documentation**: `/update-docs`, `/generate-api-docs`, `/create-guide`

#### 🔌 MCPs (Model Context Protocol Integrations)
External service connections:
- **Databases**: `postgresql-integration`, `supabase`, `mysql-integration`
- **Development**: `github-integration`, `context7`, `filesystem-access`
- **Browser**: `playwright-mcp`, `browsermcp`, `browser-use-mcp-server`

#### ⚙️ Settings
Claude Code configuration files:
- **Performance**: `performance-optimization`, `bash-timeouts`, `mcp-timeouts`
- **Security**: `read-only-mode`, `deny-sensitive-files`, `allow-git-operations`
- **Statuslines**: `context-monitor`, `git-branch-statusline`, `time-statusline`

#### 🪝 Hooks
Automation triggers for development workflows:
- **Git**: `auto-git-add`, `smart-commit`, `pre-commit-validation`
- **Notifications**: `discord-notifications`, `slack-notifications`, `telegram-notifications`
- **Performance**: `performance-monitor`, `lint-on-save`, `test-runner`

### Component Installation System

#### CLI Installation Patterns
```bash
# Install specific components
npx claude-code-templates@latest --agent <name>
npx claude-code-templates@latest --command <name>
npx claude-code-templates@latest --mcp <name>
npx claude-code-templates@latest --setting <name>
npx claude-code-templates@latest --hook <name>

# Batch installation
npx claude-code-templates@latest --agent security-auditor --command security-audit --setting read-only-mode

# Interactive mode
npx claude-code-templates@latest
```

#### Special Component Features

**Statusline System with Python Scripts**
- Statuslines can reference external Python scripts
- Files are downloaded automatically to `.claude/scripts/` relative to project
- Example: `statusline/context-monitor` installs both JSON config and Python script
- Implementation in `src/index.js:installIndividualSetting()`:

```javascript
if (settingName.includes('statusline/')) {
  const pythonFileName = settingName.split('/')[1] + '.py';
  const pythonUrl = githubUrl.replace('.json', '.py');
  additionalFiles['.claude/scripts/' + pythonFileName] = {
    content: pythonContent,
    executable: true
  };
}
```

### Component Generation System

The `generate_components_json.py` script creates the component catalog:
- Scans all component directories recursively
- Excludes `.py` files from public listings (they remain as background dependencies)
- Generates `docs/components.json` for the web interface at aitmpl.com
- Handles file content embedding and metadata extraction

## Important Implementation Notes

### Path Handling
- **Relative Paths**: Always use relative paths like `.claude/scripts/` for project-local files
- **Cross-platform**: Use `path.join()` for cross-platform compatibility
- **No Hardcoding**: Never hardcode user home directories or absolute paths

### Context Monitor Implementation
The statusline context monitor system demonstrates key architectural patterns:
- **Component Download**: Automatic download of related files (Python scripts)
- **Relative Installation**: Files installed relative to project, not globally
- **Background Dependencies**: Python files excluded from public component listings
- **Dynamic Loading**: Components loaded and executed dynamically by Claude Code

### Error Handling Patterns
- Use try/catch blocks for async operations
- Log errors with appropriate context using chalk for styling
- Provide helpful error messages to users
- Handle missing files or directories gracefully
- Implement fallback mechanisms for network operations

### Component Development Guidelines

#### Adding New Components
1. **Structure**: Follow existing directory patterns in `cli-tool/components/`
2. **Naming**: Use descriptive, hyphenated names (`security-auditor.md`)
3. **Documentation**: Include clear descriptions and usage examples
4. **Testing**: Add tests for complex logic components
5. **Generation**: Run `python generate_components_json.py` to update catalog

#### Modifying Existing Components
1. **Backward Compatibility**: Ensure changes don't break existing installations
2. **Version Management**: Consider version bumping for breaking changes
3. **Testing**: Test component installation with `--setting`, `--agent`, etc.
4. **Documentation**: Update component descriptions if functionality changes

### Publishing Workflow

#### Version Management
```bash
# Bump version (automatically updates package.json)
npm version patch   # 1.20.2 -> 1.20.3
npm version minor   # 1.20.3 -> 1.21.0  
npm version major   # 1.21.0 -> 2.0.0

# Publish to npm
npm publish
```

#### Pre-publish Checklist
1. All tests passing (`npm test`)
2. Component catalog updated (`python generate_components_json.py`)
3. No hardcoded paths or sensitive information
4. Version bumped appropriately
5. Git commits include all relevant files

### Component Security
- Never include hardcoded credentials or API keys in components
- Validate all user inputs in components
- Use relative paths (`.claude/scripts/`) instead of absolute paths
- Review components for potential security vulnerabilities before publishing

This codebase represents a comprehensive Claude Code component ecosystem with real-time analytics, modular architecture, and extensive automation capabilities. The system is designed for scalability, maintainability, and ease of use while providing powerful development workflow enhancements.