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