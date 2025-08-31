# Complete Guide to Creating Claude Code Commands

This guide teaches you how to create custom slash commands for Claude Code using `.md` files with optional YAML frontmatter configuration.

## What are Claude Code Commands?

Commands are reusable prompts that you can invoke with a simple slash syntax during your Claude Code sessions. Each command:

- **Has a specific purpose** and can be customized with arguments
- **Can execute bash commands** before running the prompt
- **Supports file references** using the `@` syntax
- **Can be scoped** to projects or personal use
- **Includes optional metadata** through YAML frontmatter

## Key Benefits

### 🚀 Rapid Execution
Execute complex, frequently-used prompts with a simple `/command` syntax.

### 🔧 Dynamic Arguments
Pass variables to commands using `$ARGUMENTS` placeholder for flexible reuse.

### 📁 Smart Organization
Organize commands in subdirectories with automatic namespacing and conflict resolution.

### 🔄 Context Enrichment
Automatically include bash command output and file contents in your prompts.

### ♻️ Team Collaboration
Share project commands with your team while keeping personal commands private.

## Command Locations

| Type | Location | Scope | Visibility | Priority |
|------|----------|-------|------------|----------|
| **Project Commands** | `.claude/commands/` | Current project only | Shared with team | Higher |
| **Personal Commands** | `~/.claude/commands/` | All projects | Private to user | Lower |

*When there are name conflicts, project commands take precedence over personal commands.*

## Basic Command Format

Each command is defined in a Markdown file with this structure:

```markdown
---
allowed-tools: Read, Edit, Bash
argument-hint: [optional-arg]
description: Brief description of the command
model: sonnet
---

Your command prompt goes here. This can include:

- Dynamic arguments using $ARGUMENTS
- File references using @filename.js
- Bash command output using !`command`
- Multiple paragraphs with detailed instructions

Include specific instructions and context that Claude should follow.
```

## Command Configuration

### Basic Syntax
```
/<command-name> [arguments]
```

### Filename to Command Mapping
- **File**: `optimize.md` → **Command**: `/optimize`
- **File**: `fix-issue.md` → **Command**: `/fix-issue`
- **File**: `security-review.md` → **Command**: `/security-review`

### Directory Organization
Commands can be organized in subdirectories for better organization:

```
.claude/commands/
├── frontend/
│   ├── component.md      # /component (project:frontend)
│   └── styling.md        # /styling (project:frontend)
├── backend/
│   ├── api-test.md       # /api-test (project:backend)
│   └── database.md       # /database (project:backend)
└── git/
    ├── commit.md         # /commit (project:git)
    └── review.md         # /review (project:git)
```

## Frontmatter Configuration

### `allowed-tools` (Optional)
Restricts which tools the command can use:
```yaml
allowed-tools: Read, Edit, Bash(git add:*), Bash(git status:*)
```

**Common tool combinations:**
- **Code Analysis**: `Read, Grep, Glob`
- **File Operations**: `Read, Edit, Write`
- **Git Operations**: `Bash(git add:*), Bash(git status:*), Bash(git commit:*)`
- **Web Research**: `Read, WebSearch, WebFetch`
- **Full Access**: Leave empty to inherit all tools

### `argument-hint` (Optional)
Provides autocomplete guidance for command arguments:
```yaml
argument-hint: add [tagId] | remove [tagId] | list
argument-hint: [issue-number]
argument-hint: [component-name] [directory]
```

### `description` (Optional)
Brief description shown in `/help`:
```yaml
description: Create a git commit with proper formatting
description: Analyze code performance and suggest optimizations
description: Generate React component with tests
```

### `model` (Optional)
Specify which Claude model to use:
```yaml
model: claude-3-5-sonnet-20241022    # Default, balanced performance
model: claude-3-5-haiku-20241022     # Faster, simpler tasks
model: claude-3-opus-20240229        # Most capable, complex tasks
```

## Advanced Features

### Dynamic Arguments
Use `$ARGUMENTS` to pass values to your commands:

```markdown
---
argument-hint: [issue-number]
description: Fix GitHub issue following coding standards
---

Fix issue #$ARGUMENTS following our team's coding standards:

1. Review the issue requirements
2. Implement the solution
3. Add appropriate tests
4. Update documentation if needed
```

**Usage**: `/fix-issue 123`

### Bash Command Integration
Execute commands before the prompt runs using `!` prefix:

```markdown
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create a comprehensive git commit
---

## Current Repository State

- Git status: !`git status --porcelain`
- Current branch: !`git branch --show-current`
- Staged changes: !`git diff --cached --stat`
- Unstaged changes: !`git diff --stat`
- Recent commits: !`git log --oneline -5`

## Task

Based on the above repository state, create a well-formatted commit message and commit the staged changes.
```

### File References
Include file contents using `@` syntax:

```markdown
---
description: Review code implementation
---

Please review the following implementation:

Main component: @src/components/UserProfile.js
Test file: @tests/components/UserProfile.test.js
Types: @types/user.ts

Analyze for:
- Code quality and best practices
- Test coverage completeness
- Type safety implementation
- Performance considerations
```

### Extended Thinking Mode
Trigger extended thinking by including specific keywords:

```markdown
---
description: Complex architectural decision analysis
---

<thinking>
I need to carefully analyze this architectural decision considering multiple factors.
</thinking>

Analyze the architectural implications of @src/config/architecture.md and provide:

1. Detailed analysis of current approach
2. Alternative solutions with trade-offs
3. Recommended implementation strategy
4. Migration path if changes are needed
```

## Complete Command Examples

### 1. Git Commit Command

```markdown
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git log:*)
argument-hint: [optional-commit-message]
description: Create a well-formatted git commit
model: claude-3-5-sonnet-20241022
---

## Repository Context

- Current status: !`git status --porcelain`
- Current branch: !`git branch --show-current`
- Staged files: !`git diff --cached --name-only`
- Unstaged changes: !`git diff --name-only`
- Last 3 commits: !`git log --oneline -3`

## Task

Create a git commit with proper formatting:

1. **If no message provided**: Generate a descriptive commit message based on the staged changes
2. **If message provided**: Use "$ARGUMENTS" as the commit message
3. **Follow conventional commits format**: `type(scope): description`
4. **Add co-authored-by**: Include Claude attribution

Commit message should be:
- Clear and descriptive
- Under 50 characters for the title
- Include detailed body if necessary
- Follow our team's commit standards
```

### 2. React Component Generator

```markdown
---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [component-name] [directory]
description: Generate React component with TypeScript and tests
model: claude-3-5-sonnet-20241022
---

## Component Generation Task

Generate a complete React component with the following specifications:

**Component Name**: $ARGUMENTS (first argument)
**Directory**: $ARGUMENTS (second argument, default: src/components)

## Requirements

### 1. Component Structure
- TypeScript functional component with proper typing
- Props interface with JSDoc comments
- Default export with named export for testing
- Proper file naming convention

### 2. Styling
- CSS Modules or styled-components (detect existing pattern: @src/components/)
- Responsive design considerations
- Accessibility attributes

### 3. Testing
- Jest + React Testing Library test file
- Test component rendering
- Test props handling
- Test user interactions
- Accessibility testing

### 4. Documentation
- JSDoc comments for component and props
- Usage examples in component file
- Storybook story (if Storybook detected: @.storybook/)

## File Structure to Create
```
[directory]/
├── ComponentName.tsx
├── ComponentName.module.css
├── ComponentName.test.tsx
├── ComponentName.stories.tsx (if Storybook exists)
└── index.ts
```

Follow the existing code patterns from: @src/components/
```

### 3. API Testing Command

```markdown
---
allowed-tools: Read, Edit, Bash, WebFetch
argument-hint: [endpoint-path]
description: Generate comprehensive API tests
model: claude-3-5-sonnet-20241022
---

## API Testing Generation

**Target Endpoint**: $ARGUMENTS

## Context Analysis

- API routes: @src/routes/ or @api/
- Existing tests: @tests/api/ or @__tests__/
- API documentation: @docs/api.md or @README.md
- Test configuration: @jest.config.js or @vitest.config.js

## Test Generation Requirements

### 1. Test Structure
- Comprehensive test suite for the endpoint
- Happy path testing
- Error case testing
- Edge case validation
- Authentication testing (if required)

### 2. HTTP Methods Testing
For each supported method (GET, POST, PUT, DELETE):
- Valid request/response testing
- Invalid input validation
- Status code verification
- Response body validation
- Headers verification

### 3. Test Data
- Mock data generation
- Fixtures for consistent testing
- Database seeding (if applicable)
- Cleanup procedures

### 4. Integration Testing
- Database interactions
- External service mocking
- Middleware testing
- Rate limiting testing

## Deliverables

1. Complete test file with all scenarios
2. Test data fixtures
3. Mock configurations
4. Documentation for running tests
```

### 4. Performance Analysis Command

```markdown
---
allowed-tools: Read, Bash, Grep, Glob
description: Analyze application performance and suggest optimizations
model: claude-3-5-sonnet-20241022
---

## Performance Analysis Report

## Current Metrics

- Bundle analysis: !`npm run build -- --analyze 2>/dev/null || echo "No build analyzer available"`
- Dependencies: !`npm list --depth=0 --prod`
- Package size: !`du -sh node_modules/ 2>/dev/null || echo "No node_modules found"`

## Code Analysis

### Frontend Performance
- React components: @src/components/
- Main application: @src/App.js or @src/App.tsx
- Build configuration: @webpack.config.js or @vite.config.js or @next.config.js

### Backend Performance  
- Server entry: @src/server.js or @src/index.js
- Database queries: @src/models/ or @src/db/
- API routes: @src/routes/ or @api/

## Analysis Areas

### 1. Bundle Optimization
- Identify large dependencies
- Code splitting opportunities
- Tree shaking effectiveness
- Dynamic imports usage

### 2. Runtime Performance
- Component re-render analysis
- Memory leak detection
- Event listener optimization
- Image optimization opportunities

### 3. Backend Optimization
- Database query efficiency
- Caching strategies
- API response times
- Resource utilization

### 4. Core Web Vitals
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

## Deliverables

1. Performance audit report
2. Specific optimization recommendations
3. Implementation priority ranking
4. Before/after metrics tracking plan
```

### 5. Security Audit Command

```markdown
---
allowed-tools: Read, Bash, Grep
description: Comprehensive security audit of the codebase
model: claude-3-5-sonnet-20241022
---

## Security Audit Report

## Dependency Security

- Security audit: !`npm audit --audit-level=moderate 2>/dev/null || echo "npm audit not available"`
- Outdated packages: !`npm outdated 2>/dev/null || echo "npm outdated not available"`

## Code Security Analysis

### Configuration Files
- Environment variables: @.env* (if exists)
- Security configurations: @src/config/
- Database configurations: @src/db/config/

### Authentication & Authorization
- Auth implementation: @src/auth/ or @src/middleware/auth.js
- JWT handling: Search for JWT-related code
- Password hashing: Search for bcrypt, scrypt, argon2

### Input Validation
- API routes: @src/routes/ or @api/
- Form validation: @src/components/forms/
- Database queries: @src/models/

## OWASP Top 10 Assessment

### 1. Injection Vulnerabilities
- SQL injection prevention
- NoSQL injection prevention  
- Command injection prevention
- XSS prevention

### 2. Broken Authentication
- Session management
- Multi-factor authentication
- Password policies
- Account lockout mechanisms

### 3. Sensitive Data Exposure
- Data encryption at rest
- Data encryption in transit
- API key management
- Logging security

### 4. Security Misconfiguration
- Server configuration
- CORS configuration
- Security headers
- Error handling

## Security Checklist

- [ ] Dependencies are up to date
- [ ] No hardcoded secrets
- [ ] Proper input validation
- [ ] Secure authentication
- [ ] HTTPS enforcement
- [ ] Security headers configured
- [ ] Error messages don't leak info
- [ ] Logging doesn't include sensitive data

## Deliverables

1. Security vulnerability report
2. Risk assessment (Critical/High/Medium/Low)
3. Remediation recommendations
4. Security best practices guide
```

### 6. Database Migration Command

```markdown
---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [migration-name]
description: Create database migration with rollback
model: claude-3-5-sonnet-20241022
---

## Database Migration Creation

**Migration Name**: $ARGUMENTS

## Current Database Context

- Migration files: @migrations/ or @db/migrations/
- Database schema: @schema.sql or @db/schema/
- ORM configuration: @knexfile.js or @src/db/config.js or @prisma/schema.prisma
- Existing models: @src/models/

## Migration Requirements

### 1. Migration Structure
- Timestamp-based filename
- Clear up/down migration functions  
- Proper error handling
- Transaction wrapping for safety

### 2. Schema Changes
Based on migration name, determine operation:
- **CREATE**: New table creation
- **ALTER**: Table modifications
- **DROP**: Table/column removal
- **INDEX**: Index management
- **DATA**: Data migrations

### 3. Rollback Strategy
- Complete rollback implementation
- Data preservation considerations
- Dependency handling
- Validation checks

### 4. Best Practices
- Atomic operations
- No destructive changes without confirmation
- Proper indexing
- Foreign key constraints
- Default values handling

## Deliverables

1. Migration file with up/down functions
2. Rollback testing instructions
3. Migration documentation
4. Data backup recommendations (if destructive)

## Template Structure

```sql
-- Up migration
CREATE TABLE example (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Down migration  
DROP TABLE IF EXISTS example;
```
```

## Built-in Commands Reference

### Essential Commands
- `/add-dir` - Add working directories to current session
- `/agents` - Manage and configure custom AI subagents
- `/clear` - Clear conversation history for fresh start
- `/compact [instructions]` - Compress conversation with optional focus
- `/config` - View and modify Claude Code configuration
- `/help` - Show all available commands and usage

### Development Commands
- `/init` - Initialize project with CLAUDE.md configuration guide
- `/memory` - Edit CLAUDE.md memory files for persistent context
- `/review` - Request comprehensive code review
- `/pr_comments` - View and manage pull request comments

### System Commands
- `/bug` - Report issues to Anthropic development team
- `/cost` - Display token usage and billing information
- `/doctor` - Health check for Claude Code installation
- `/model` - Select or change AI model (Sonnet/Haiku/Opus)
- `/status` - View account and system status information

### Authentication & Permissions
- `/login` - Switch between Anthropic accounts
- `/logout` - Sign out from current account
- `/permissions` - View and update access permissions

### Advanced Features
- `/mcp` - Manage MCP server connections and OAuth
- `/terminal-setup` - Configure Shift+Enter for newlines
- `/vim` - Toggle vim mode for modal editing

## MCP Commands

### Understanding MCP Commands
MCP (Model Context Protocol) servers can expose prompts as dynamic slash commands:

```
/mcp__<server-name>__<prompt-name> [arguments]
```

### Example MCP Commands
```bash
# GitHub integration
/mcp__github__list_prs
/mcp__github__pr_review 456

# Jira integration  
/mcp__jira__create_issue "Bug title" high
/mcp__jira__list_issues

# Database operations
/mcp__postgres__query "SELECT * FROM users LIMIT 10"
/mcp__postgres__migrate
```

### MCP Management
Use `/mcp` to:
- View configured MCP servers
- Check connection status
- Authenticate with OAuth-enabled servers
- Clear authentication tokens
- View available tools and prompts

## Best Practices for Creating Commands

### 1. Command Design Principles
- **Single Responsibility**: One clear purpose per command
- **Descriptive Names**: Use clear, action-oriented names
- **Consistent Patterns**: Follow established naming conventions
- **Atomic Operations**: Complete tasks that don't require follow-up

### 2. Effective Prompts
```markdown
## Structure Template

### Context Section
- Current state analysis
- Relevant file contents
- System information

### Requirements Section  
- Clear, numbered requirements
- Acceptance criteria
- Quality standards

### Deliverables Section
- Specific outputs expected
- Format requirements
- Documentation needs
```

### 3. Tool Selection Strategy
```yaml
# ✅ Focused tool selection
allowed-tools: Read, Edit, Bash(git add:*), Bash(git status:*)

# ❌ Too permissive
allowed-tools: Read, Write, Edit, Bash, WebFetch, WebSearch, Grep, Glob
```

### 4. Argument Design
```yaml
# ✅ Clear argument guidance
argument-hint: [component-name] [directory] [--typescript]

# ❌ Vague guidance  
argument-hint: [options]
```

### 5. Command Testing
- **Test with real scenarios** from your projects
- **Verify argument handling** works correctly
- **Check bash command execution** produces expected output
- **Validate file references** resolve properly
- **Test error conditions** and edge cases

## Common Use Cases

### Development Workflow
```bash
/init                    # Setup project configuration
/component Button        # Generate React component
/test Button            # Generate component tests
/commit                 # Create formatted git commit
/review                 # Request code review
```

### Debugging & Analysis
```bash
/performance            # Analyze performance issues
/security               # Security audit
/dependencies           # Analyze and update dependencies
/logs                   # Analyze log files
/errors                 # Debug error patterns
```

### Database Operations
```bash
/migrate create_users   # Create database migration
/seed                   # Generate test data
/backup                 # Backup database
/optimize               # Optimize database performance
```

### DevOps & Deployment
```bash
/deploy staging         # Deploy to staging environment  
/rollback               # Rollback deployment
/monitor                # Check system health
/scale                  # Scale application resources
```

## Command Organization Strategies

### By Project Phase
```
.claude/commands/
├── setup/              # Project initialization
├── development/        # Daily development tasks  
├── testing/           # Testing and QA
├── deployment/        # Deployment and DevOps
└── maintenance/       # Ongoing maintenance
```

### By Technology Stack
```
.claude/commands/
├── frontend/          # React, Vue, Angular commands
├── backend/           # Node.js, Python, API commands
├── database/          # SQL, migrations, seeding
├── infrastructure/    # Docker, K8s, cloud commands
└── tools/            # Build tools, linting, formatting
```

### By Team Role
```
~/.claude/commands/
├── developer/         # General development commands
├── devops/           # Infrastructure and deployment
├── qa/               # Testing and quality assurance
└── lead/             # Architecture and code review
```

## Troubleshooting Common Issues

### Command Not Found
**Symptoms**: `/command` shows "Command not found"
**Solutions**:
- Verify file exists in `.claude/commands/` or `~/.claude/commands/`
- Check filename matches command name (without `.md`)
- Ensure markdown file has proper content
- Restart Claude Code session

### Arguments Not Working
**Symptoms**: `$ARGUMENTS` appears literally in output
**Solutions**:
- Ensure arguments are provided when calling command
- Check `argument-hint` frontmatter is correctly formatted
- Verify `$ARGUMENTS` placement in command content

### Bash Commands Failing
**Symptoms**: `!command` output shows errors
**Solutions**:
- Verify `allowed-tools` includes `Bash` or specific commands
- Test bash commands work in terminal first
- Check file paths and permissions
- Ensure commands are available in system PATH

### File References Not Working
**Symptoms**: `@filename` shows "File not found"
**Solutions**:
- Verify file paths are correct relative to working directory
- Check file permissions are readable
- Use `/add-dir` to add additional working directories
- Test file references with absolute paths

### Permission Issues
**Symptoms**: Commands fail with permission errors
**Solutions**:
- Use `/permissions` to check current access levels
- Ensure `allowed-tools` includes necessary tools
- Check file system permissions
- Verify MCP server authentication if using MCP commands

## Advanced Command Patterns

### Conditional Logic
```markdown
---
description: Smart deployment based on environment
---

Analyze the current environment and deploy accordingly:

**Current branch**: !`git branch --show-current`
**Environment config**: @.env
**Package.json**: @package.json

If production branch:
1. Run full test suite
2. Build production assets  
3. Deploy with zero downtime
4. Run smoke tests

If staging branch:
1. Run quick tests
2. Deploy to staging
3. Send notification to team

If development branch:
1. Deploy to development environment
2. Skip extensive testing
```

### Multi-Step Workflows
```markdown
---
allowed-tools: Read, Write, Edit, Bash
description: Complete feature implementation workflow
---

Implement feature: $ARGUMENTS

## Step 1: Planning
1. Analyze requirements
2. Check existing code: @src/
3. Plan implementation approach

## Step 2: Implementation  
1. Create necessary files
2. Implement core functionality
3. Add error handling

## Step 3: Testing
1. Create unit tests
2. Create integration tests  
3. Run test suite: !`npm test`

## Step 4: Documentation
1. Update README if needed
2. Add JSDoc comments
3. Update API documentation

## Step 5: Quality Assurance
1. Run linting: !`npm run lint`
2. Format code: !`npm run format`
3. Check build: !`npm run build`

Complete each step before proceeding to the next.
```

### Environment-Aware Commands
```markdown
---
description: Environment-specific database operations
---

**Current environment**: !`echo $NODE_ENV`
**Database config**: @config/database.js

## Environment-Specific Actions

### Production Environment
- Use read-only operations only
- Require explicit confirmation for changes
- Enable audit logging
- Use connection pooling

### Staging Environment  
- Allow controlled data modifications
- Enable detailed logging
- Use production-like configuration
- Reset data daily

### Development Environment
- Allow all operations
- Use local database
- Enable debug logging
- Seed with test data

Execute database operation: $ARGUMENTS
```

## Conclusion

Claude Code commands are a powerful automation tool that can significantly improve your development workflow. With this guide, you can create effective commands that:

- **Automate repetitive tasks** with simple slash syntax
- **Standardize team workflows** through shared project commands  
- **Integrate with external tools** via bash commands and MCP
- **Provide context-aware assistance** through file references and dynamic arguments

Start with simple, focused commands and gradually build more sophisticated workflows as you become comfortable with the system. Remember to test your commands thoroughly and document them well for team collaboration.