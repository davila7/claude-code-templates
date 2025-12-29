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

### ⛔ CRITICAL: NEVER Hardcode Secrets

**NEVER write API keys, tokens, passwords, or any secrets directly in code. This is a non-negotiable rule.**

```python
# ❌ WRONG - NEVER DO THIS
API_KEY = "AIzaSy..."
SECRET_TOKEN = "ghp_..."
PASSWORD = "mypassword123"

# ✅ CORRECT - Always use environment variables
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.environ.get("GOOGLE_API_KEY")
```

```javascript
// ❌ WRONG - NEVER DO THIS
const API_KEY = "AIzaSy...";

// ✅ CORRECT - Always use environment variables
const API_KEY = process.env.GOOGLE_API_KEY;
```

**When creating scripts that need API keys:**
1. Use `os.environ.get()` (Python) or `process.env` (Node.js)
2. Load from `.env` file using `dotenv` library
3. Add the variable name to `.env.example` with placeholder value
4. Verify `.env` is in `.gitignore`

**If you accidentally commit a secret:**
1. Revoke the key IMMEDIATELY
2. Generate a new key
3. Update `.env` with new key
4. The old key is compromised forever (git history)

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

The `scripts/generate_components_json.py` script creates the component catalog:
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
5. **Generation**: Run `python scripts/generate_components_json.py` to update catalog

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
2. Component catalog updated (`python scripts/generate_components_json.py`)
3. No hardcoded paths or sensitive information
4. Version bumped appropriately
5. Git commits include all relevant files

### Component Security
- Never include hardcoded credentials or API keys in components
- Validate all user inputs in components
- Use relative paths (`.claude/scripts/`) instead of absolute paths
- Review components for potential security vulnerabilities before publishing

## API Architecture & Deployment

### Overview

The `/api` directory contains Vercel Serverless Functions that power critical infrastructure:
- Component download tracking (Supabase)
- Discord bot interactions
- Claude Code changelog monitoring (Neon Database)

**⚠️ CRITICAL**: API endpoints are essential for component download metrics. Breaking these endpoints affects analytics for all `--agent`, `--command`, `--mcp`, `--hook`, `--skill`, and `--setting` installations.

### API Endpoints

#### 1. `/api/track-download-supabase` (CRITICAL)

**Purpose**: Tracks component downloads for analytics

**Method**: `POST`

**Request Body**:
```json
{
  "type": "agent|command|mcp|hook|setting|skill|template",
  "name": "component-name",
  "path": "components/path",
  "category": "category-name",
  "cliVersion": "1.0.0"
}
```

**Response**: `200 OK` or `400 Bad Request`

**Used By**: CLI tool (`cli-tool/bin/create-claude-config.js`) on every component installation

**Database**: Supabase (component_downloads, download_stats tables)

#### 2. `/api/discord/interactions`

**Purpose**: Discord bot slash commands handler

**Method**: `POST`

**Features**:
- `/search` - Search components
- `/info` - Component details
- `/install` - Installation commands
- `/popular` - Most downloaded components
- `/random` - Random component discovery

**Authentication**: Discord signature verification

#### 3. `/api/claude-code-check`

**Purpose**: Monitors Claude Code releases and sends Discord notifications

**Method**: `GET` (triggered by Vercel Cron every 4 hours)

**Features**:
- Fetches latest version from NPM
- Parses CHANGELOG.md from GitHub
- Classifies changes (features, fixes, improvements, breaking)
- Sends formatted Discord embeds
- Stores in Neon Database

**Database**: Neon (claude_code_versions, claude_code_changes, discord_notifications_log)

### Deployment Workflow

#### Pre-Deployment Checklist

**ALWAYS run tests before deploying**:

```bash
# 1. Run API tests
cd api
npm test

# 2. Verify critical endpoints
npm run test:api

# 3. If tests pass, deploy
cd ..
vercel --prod
```

#### Vercel Configuration

The `vercel.json` file in project root configures:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "docs",
  "crons": [
    {
      "path": "/api/claude-code-check",
      "schedule": "0 */4 * * *"
    }
  ],
  "rewrites": [
    // Frontend routing...
  ]
}
```

**Important Notes**:
- Serverless functions MUST be in `/api` root or use proper naming (`/api/folder/file.js`)
- ES modules (`type: "module"`) are supported
- Environment variables configured in Vercel Dashboard
- Cron jobs run in production only

#### Environment Variables

Required environment variables in Vercel:

```bash
# Supabase (download tracking)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Neon Database (changelog monitoring)
NEON_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Discord
DISCORD_APP_ID=xxx
DISCORD_BOT_TOKEN=xxx
DISCORD_PUBLIC_KEY=xxx
DISCORD_WEBHOOK_URL_CHANGELOG=https://discord.com/api/webhooks/xxx
```

### Testing API Endpoints

#### Local Testing

```bash
# Install dependencies
cd api
npm install

# Run all tests
npm test

# Run only critical endpoint tests
npm run test:api

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

#### Test Structure

```
api/
├── __tests__/
│   └── endpoints.test.js    # Critical endpoint tests
├── jest.config.cjs           # Jest configuration
└── package.json              # Test scripts
```

#### Critical Tests

The test suite validates:
1. ✅ All endpoints respond (< 500 status)
2. ✅ Download tracking accepts valid component types
3. ✅ Invalid data returns 400 errors
4. ✅ CORS headers are present
5. ✅ Response times are acceptable
6. ✅ Correct HTTP method validation

**Test Against Production**:
```bash
# Test production endpoints
API_BASE_URL=https://aitmpl.com npm run test:api

# Test staging
API_BASE_URL=https://staging.aitmpl.com npm run test:api
```

### Common Issues & Solutions

#### Issue: Endpoint Returns 401/404 After Deploy

**Cause**: Vercel Deployment Protection is enabled

**Solution**:
- Use production domain (`aitmpl.com`) instead of preview URLs
- Or disable deployment protection for API routes

#### Issue: API Tests Fail Locally

**Cause**: Testing against local server that isn't running

**Solution**:
```bash
# Always test against production
API_BASE_URL=https://aitmpl.com npm run test:api
```

#### Issue: Download Tracking Not Working

**Symptoms**: No data in Supabase after component installations

**Debug Steps**:
1. Check Vercel function logs: `vercel logs aitmpl.com --follow`
2. Verify environment variables are set
3. Test endpoint manually:
   ```bash
   curl -X POST https://aitmpl.com/api/track-download-supabase \
     -H "Content-Type: application/json" \
     -d '{"type":"agent","name":"test","path":"test/path"}'
   ```
4. Check Supabase table: `select * from component_downloads order by created_at desc limit 10;`

#### Issue: Functions Not Detected by Vercel

**Cause**: Incorrect file structure or naming

**Solution**:
- Functions must be directly in `/api` (e.g., `/api/my-function.js`)
- OR in named folders (e.g., `/api/my-folder/index.js` becomes `/api/my-folder`)
- Use `export default async function handler(req, res) {}` for ES modules

### Monitoring & Debugging

#### Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select project `aitmpl`
3. Navigate to "Functions" tab
4. View real-time logs and metrics

#### Viewing Function Logs

```bash
# Real-time logs
vercel logs aitmpl.com --follow

# Filter by function
vercel logs aitmpl.com --follow | grep track-download

# Recent errors
vercel logs aitmpl.com --since 1h
```

#### Database Queries

**Supabase (Download Stats)**:
```sql
-- Recent downloads
SELECT type, name, COUNT(*) as downloads
FROM component_downloads
WHERE download_timestamp > NOW() - INTERVAL '7 days'
GROUP BY type, name
ORDER BY downloads DESC
LIMIT 20;
```

**Neon (Claude Code Versions)**:
```sql
-- Latest Claude Code versions
SELECT version, published_at, discord_notified
FROM claude_code_versions
ORDER BY published_at DESC
LIMIT 10;
```

### API Best Practices

1. **Always Test Before Deploy**: Run `npm run test:api` before `vercel --prod`
2. **Monitor Logs**: Check Vercel logs after deployment
3. **Validate Environment Variables**: Ensure all required vars are set
4. **Use Relative Paths**: Never hardcode absolute paths
5. **Handle Errors Gracefully**: Return proper HTTP status codes
6. **Enable CORS**: All endpoints should have CORS headers
7. **Timeout Handling**: Set appropriate timeouts for external API calls
8. **Rate Limiting**: Be mindful of third-party API rate limits

### Emergency Rollback

If a deployment breaks critical endpoints:

```bash
# 1. Check recent deployments
vercel ls

# 2. Find last working deployment
vercel inspect <deployment-url>

# 3. Promote previous deployment to production
vercel promote <previous-deployment-url>

# 4. Or rollback via dashboard
# Go to Vercel Dashboard → Deployments → Click "..." → Promote to Production
```

This codebase represents a comprehensive Claude Code component ecosystem with real-time analytics, modular architecture, extensive automation capabilities, and production-ready API infrastructure. The system is designed for scalability, maintainability, and ease of use while providing powerful development workflow enhancements.