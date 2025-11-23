# 📘 Copilot CLI Arsenal - Complete Manual

<div align="center">

**Comprehensive Guide to the Multi-Agent System**

[🏠 Home](./README.md) • [⚡ Quick Start](./QUICKSTART.md) • [🤖 Agent Catalog](./.copilot/AGENTS_CATALOG.md)

</div>

---

## 📑 Table of Contents

- [Getting Started](#-getting-started)
- [Agent System Overview](#-agent-system-overview)
- [All 20 Agents Explained](#-all-20-agents-explained)
- [Workflows Deep Dive](#-workflows-deep-dive)
- [Trigger System](#-trigger-system)
- [Configuration Guide](#-configuration-guide)
- [Customization](#-customization)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)
- [FAQ](#-faq)
- [Advanced Usage](#-advanced-usage)

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

1. **Node.js** (version 14.0.0 or higher)
2. **GitHub Copilot** subscription
3. **GitHub Copilot CLI** installed
4. **Git** for cloning the repository

### Step-by-Step Setup

#### 1. Install GitHub Copilot CLI

```bash
# Install globally via npm
npm install -g @github/copilot-cli

# Verify installation
copilot --version
# Expected output: copilot version X.X.X
```

#### 2. Clone the Repository

```bash
# Clone via HTTPS
git clone https://github.com/RLuf/copilot-cli-arsenal.git

# Or via SSH
git clone git@github.com:RLuf/copilot-cli-arsenal.git

# Navigate to the directory
cd copilot-cli-arsenal
```

#### 3. Explore the Structure

```bash
# View the .copilot directory
ls -la .copilot/

# Output:
# agents/         - 20 agent JSON files
# config.json     - Main configuration
# triggers.json   - Activation rules
# workflows.json  - Multi-agent workflows
# README.md       - Technical documentation
```

#### 4. Test Agent Activation

```bash
# Test frontend agent
copilot "create a React component"

# Test backend agent
copilot "design a REST API"

# Test security agent
copilot "check for vulnerabilities"
```

#### 5. Verify Configuration

```bash
# Check if agents are properly configured
cat .copilot/config.json | grep "enabled"

# Should show: "enabled": true
```

### First Use Example

Let's build a complete feature to test the system:

```bash
copilot "create a user authentication system with JWT tokens"
```

**Expected Agents Activated:**
- `backend-architect` - API design
- `security-specialist` - Security review
- `database-architect` - User schema
- `test-engineer` - Test cases

**You should see**: Structured output covering all aspects of the feature.

---

## 🤖 Agent System Overview

### How Agents Work

Agents are specialized AI assistants that:

1. **Monitor Context**: File patterns, keywords, git status
2. **Activate Automatically**: Based on triggers
3. **Provide Expert Guidance**: Domain-specific assistance
4. **Collaborate**: Work together on complex tasks

### Agent Lifecycle

```
┌─────────────────┐
│  User Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Trigger System  │◄──── File patterns, keywords, context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agent Selection │◄──── Priority scores, activation threshold
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agent Execution │◄──── System prompts, tools, preferences
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Output Response │
└─────────────────┘
```

### Agent Priority System

Agents are prioritized based on:

| Priority Level | Score | Agents |
|:---------------|:------|:-------|
| **Critical** | 10 | security-specialist, frontend-developer, backend-architect |
| **High** | 9 | debugger, error-detective, devops-engineer |
| **Medium** | 8 | test-engineer, code-reviewer, ai-engineer |
| **Standard** | 7 | performance-optimizer, prompt-engineer, cli-ui-designer |
| **Low** | 6 | documentation-specialist |

---

## 📚 All 20 Agents Explained

### 🎨 Frontend Developer

**Specialty**: React, Vue, Angular, Modern Web Development

**System Prompts**:
- Expert in React, Vue, Angular, and modern JavaScript/TypeScript
- Focus on component architecture and state management
- Always consider responsive design and accessibility
- Use modern ES6+ syntax and functional programming

**Tools Available**:
- Code generation
- Component refactoring
- Performance profiling
- Accessibility testing

**Best Use Cases**:
```bash
# Building components
copilot "create a responsive navbar with dropdown menu"

# State management
copilot "implement Redux store for user authentication"

# Styling
copilot "add Tailwind CSS styles to dashboard"

# Performance
copilot "optimize React component re-renders"
```

**Example Output**:
```typescript
// Request: "create a reusable Button component"

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
        outline: 'border border-gray-300 bg-transparent hover:bg-gray-100'
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-lg'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant,
  size,
  isLoading,
  children,
  ...props
}) => {
  return (
    <button
      className={buttonVariants({ variant, size })}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
};
```

---

### 🏗️ Backend Architect

**Specialty**: API Design, Microservices, System Architecture

**System Prompts**:
- Expert in Node.js, Python, Go, and Java
- Design scalable, maintainable APIs
- Follow REST, GraphQL, and gRPC best practices
- Implement proper auth, caching, and security

**Tools Available**:
- Architecture design
- API documentation
- Database schema design
- Performance testing

**Best Use Cases**:
```bash
# API design
copilot "design RESTful API for e-commerce platform"

# Microservices
copilot "create microservice architecture for payments"

# Authentication
copilot "implement OAuth2 authentication flow"

# Database integration
copilot "design API with PostgreSQL integration"
```

**Example Output**:
```typescript
// Request: "design a RESTful API for user management"

// routes/users.ts
import express from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createUserSchema, updateUserSchema } from '../schemas/user';

const router = express.Router();
const userController = new UserController();

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Public
 */
router.post('/',
  validate(createUserSchema),
  userController.createUser
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id',
  authenticate,
  userController.getUserById
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private
 */
router.put('/:id',
  authenticate,
  validate(updateUserSchema),
  userController.updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (Admin only)
 */
router.delete('/:id',
  authenticate,
  userController.deleteUser
);

export default router;
```

---

### 🔒 Security Specialist

**Specialty**: OWASP Top 10, Vulnerability Assessment

**System Prompts**:
- Expert in application security
- Identify and fix OWASP Top 10 vulnerabilities
- Implement secure authentication patterns
- Follow security best practices

**Tools Available**:
- Vulnerability scanning
- Security audit
- Dependency checking
- Penetration testing

**Always Active**: Yes (High Priority)

**Best Use Cases**:
```bash
# Security audit
copilot "audit this code for security vulnerabilities"

# Fix vulnerabilities
copilot "fix SQL injection vulnerability in user query"

# Implement security
copilot "add rate limiting to API endpoints"

# Authentication
copilot "implement secure JWT authentication"
```

**Example Output**:
```javascript
// Request: "audit this login function for security issues"

// ❌ VULNERABLE CODE
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;
  db.query(query, (err, results) => {
    if (results.length > 0) {
      res.json({ success: true });
    }
  });
});

// SECURITY ISSUES FOUND:
// 1. SQL Injection vulnerability
// 2. Passwords stored in plain text
// 3. No rate limiting
// 4. No input validation
// 5. Sensitive data in logs

// ✅ SECURE VERSION
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // limit each IP to 5 requests per windowMs
});

app.post('/login',
  loginLimiter,
  [
    body('username').trim().isLength({ min: 3, max: 30 }).escape(),
    body('password').isLength({ min: 8 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
      // Parameterized query prevents SQL injection
      const [users] = await db.query(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );

      if (users.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = users[0];
      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({ token });
    } catch (error) {
      logger.error('Login error', { error: error.message }); // No sensitive data
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);
```

---

### 🐛 Debugger

**Specialty**: Bug Investigation, Problem Resolution

**System Prompts**:
- Expert debugger with systematic approach
- Reproduce, isolate, identify, fix, verify
- Use debugging tools effectively
- Consider race conditions and edge cases

**Tools Available**:
- Error analysis
- Stack trace parsing
- Log analysis
- Debugging setup

**Best Use Cases**:
```bash
# Fix bugs
copilot "users getting 500 error when uploading files"

# Analyze errors
copilot "debug why React component re-renders infinitely"

# Memory leaks
copilot "find memory leak in Node.js application"

# Performance issues
copilot "debug slow database queries"
```

---

### ⚡ Performance Optimizer

**Specialty**: Speed, Caching, Web Vitals

**System Prompts**:
- Expert in application optimization
- Optimize frontend: bundle size, lazy loading
- Optimize backend: caching, query optimization
- Focus on Core Web Vitals

**Tools Available**:
- Performance profiling
- Bundle analysis
- Lighthouse audits
- Query optimization

**Best Use Cases**:
```bash
# Frontend optimization
copilot "optimize bundle size for production"

# Backend optimization
copilot "add Redis caching to expensive queries"

# Database optimization
copilot "optimize slow SQL query"

# Web Vitals
copilot "improve Largest Contentful Paint score"
```

---

_(Continuing with remaining agents...)_

### Complete Agent Reference

For detailed documentation of all 20 agents, see [AGENTS_CATALOG.md](./.copilot/AGENTS_CATALOG.md).

---

## 🔄 Workflows Deep Dive

### What are Workflows?

Workflows orchestrate multiple agents to work together on complex tasks. Each workflow defines:

1. **Sequence of agents** to activate
2. **Tasks** for each agent
3. **Dependencies** between tasks
4. **Expected outputs**

### Available Workflows

#### 1. Full Feature Implementation

**Purpose**: End-to-end feature development from design to deployment

**Agents Involved** (in order):
1. **backend-architect** - Design API
2. **database-architect** - Create schema
3. **backend-architect** - Implement API
4. **frontend-developer** - Build UI
5. **test-engineer** - Write tests
6. **security-specialist** - Security audit
7. **code-reviewer** - Code review
8. **documentation-specialist** - Documentation
9. **deployment-engineer** - Deployment

**Usage**:
```bash
copilot --workflow=full-feature-implementation "user authentication system"
```

**Expected Duration**: 2-4 hours

**Output Example**:
```
Phase 1: Design (backend-architect)
✅ API endpoints defined
✅ Authentication flow designed
✅ Architecture documented

Phase 2: Database (database-architect)
✅ Users table schema created
✅ Indexes added for performance
✅ Migration files generated

Phase 3: Implementation (backend-architect)
✅ JWT authentication implemented
✅ Password hashing with bcrypt
✅ Refresh token mechanism

...
```

---

## 🎯 Trigger System

### How Triggers Work

Triggers automatically activate agents based on:

1. **File Patterns**: `*.jsx`, `Dockerfile`, `*.sql`
2. **Keywords**: "react", "security", "performance"
3. **Directory Patterns**: `src/components/**`, `api/**`
4. **Context**: Git status, error logs, recent changes

### Trigger Priority

```javascript
// High Priority Triggers (Score: 0.9+)
- security keywords → security-specialist
- error/bug keywords → debugger
- explicit agent mention

// Medium Priority (Score: 0.7-0.9)
- file pattern match
- directory pattern match
- keyword match

// Low Priority (Score: 0.6-0.7)
- context inference
- historical patterns
```

### File Pattern Examples

| Pattern | Activated Agent |
|:--------|:----------------|
| `**/*.tsx`, `**/*.jsx` | frontend-developer |
| `**/*.controller.js` | backend-architect |
| `Dockerfile`, `docker-compose.yml` | devops-engineer |
| `**/*.test.js`, `**/*.spec.js` | test-engineer |
| `**/*.sql`, `migrations/**` | database-architect |

### Keyword Triggers

| Keyword | Agent |
|:--------|:------|
| "security", "vulnerability", "owasp" | security-specialist |
| "performance", "optimize", "slow" | performance-optimizer |
| "test", "coverage", "e2e" | test-engineer |
| "deploy", "release", "rollout" | deployment-engineer |

---

## ⚙️ Configuration Guide

### Main Configuration File

Location: `.copilot/config.json`

```json
{
  "copilot": {
    "agents": {
      "enabled": true,
      "autoActivate": true,
      "defaultAgent": "fullstack-developer",
      "multiAgentMode": true
    }
  }
}
```

### Agent Preferences

Customize agent behavior:

```json
{
  "agentPreferences": {
    "frontend-developer": {
      "preferredFramework": "react",
      "stylePreference": "tailwind",
      "stateManagement": "zustand"
    },
    "backend-architect": {
      "preferredLanguage": "typescript",
      "apiStyle": "rest",
      "database": "postgresql"
    },
    "test-engineer": {
      "testFramework": "jest",
      "e2eFramework": "playwright",
      "coverageThreshold": 80
    }
  }
}
```

### Performance Settings

```json
{
  "performance": {
    "caching": true,
    "cacheTTL": 3600,
    "rateLimiting": {
      "enabled": true,
      "maxRequestsPerMinute": 60
    }
  }
}
```

---

## 🎨 Customization

### Adding Custom Triggers

Edit `.copilot/triggers.json`:

```json
{
  "triggerRules": {
    "frontend-developer": {
      "filePatterns": [
        "**/*.jsx",
        "**/*.custom.js"  // Add custom pattern
      ],
      "keywords": [
        "react",
        "my-custom-keyword"  // Add custom keyword
      ]
    }
  }
}
```

### Creating Custom Workflows

Edit `.copilot/workflows.json`:

```json
{
  "workflows": {
    "my-custom-workflow": {
      "name": "My Custom Workflow",
      "description": "Custom development flow",
      "agents": [
        {
          "agent": "backend-architect",
          "phase": "design",
          "tasks": ["Design API", "Plan architecture"],
          "outputs": ["api-spec"]
        },
        {
          "agent": "frontend-developer",
          "phase": "implementation",
          "tasks": ["Build UI"],
          "outputs": ["components"],
          "dependsOn": ["backend-architect"]
        }
      ]
    }
  }
}
```

### Disabling Specific Agents

```json
{
  "activeAgents": [
    {
      "name": "documentation-specialist",
      "enabled": false  // Disable this agent
    }
  ]
}
```

---

## ✅ Best Practices

### 1. Let Agents Activate Automatically

```bash
# ✅ Good - Let system choose
copilot "create a login form"

# ❌ Less optimal - Manual override
copilot --agent=frontend-developer "create a login form"
```

### 2. Use Workflows for Complex Tasks

```bash
# ✅ Good - Use workflow
copilot --workflow=full-feature-implementation "user dashboard"

# ❌ Less optimal - Single agent for complex task
copilot "build complete user dashboard with API and tests"
```

### 3. Be Specific in Requests

```bash
# ✅ Good - Specific
copilot "create a React component with TypeScript, props validation, and tests"

# ❌ Vague
copilot "make a component"
```

### 4. Leverage Security Agent

```bash
# Always audit before deployment
copilot "security audit for production deployment"
```

### 5. Use Context Effectively

```bash
# Work in relevant directory
cd src/components/
copilot "refactor Button component"  # frontend-developer auto-activates
```

---

## 🔧 Troubleshooting

### Agent Not Activating

**Problem**: Expected agent doesn't activate

**Solutions**:
1. Check trigger configuration
```bash
cat .copilot/triggers.json | grep "your-agent"
```

2. Verify agent is enabled
```bash
cat .copilot/config.json | grep "\"name\": \"your-agent\"" -A 2
```

3. Increase activation score
```json
{
  "activeAgents": [
    {
      "name": "your-agent",
      "activationScore": 0.9  // Increase from 0.6
    }
  ]
}
```

4. Use manual activation
```bash
copilot --agent=your-agent "your request"
```

---

### Wrong Agent Activating

**Problem**: Different agent than expected activates

**Solutions**:
1. Be more specific in request
2. Add file context
3. Adjust trigger priorities
4. Use manual agent selection

---

### Performance Issues

**Problem**: Slow response times

**Solutions**:
1. Enable caching
```json
{
  "performance": {
    "caching": true,
    "cacheTTL": 3600
  }
}
```

2. Reduce concurrent agents
```json
{
  "workflows": {
    "maxConcurrentAgents": 2
  }
}
```

3. Disable predictive activation
```json
{
  "experimental": {
    "predictiveActivation": false
  }
}
```

---

## ❓ FAQ

### Q: Can I use multiple agents simultaneously?

**A**: Yes! Enable multi-agent mode:

```json
{
  "copilot": {
    "agents": {
      "multiAgentMode": true
    }
  }
}
```

---

### Q: How do I create my own agent?

**A**:
1. Create JSON file in `.copilot/agents/`
2. Define triggers in `.copilot/triggers.json`
3. Add to active agents in `.copilot/config.json`

Example:
```json
{
  "name": "my-custom-agent",
  "version": "1.0.0",
  "description": "My custom specialist",
  "systemPrompts": ["You are an expert in..."],
  "tools": ["code-generation"],
  "useCases": ["Build X", "Create Y"]
}
```

---

### Q: Can I disable auto-activation?

**A**: Yes, set `autoActivate` to false:

```json
{
  "copilot": {
    "agents": {
      "autoActivate": false
    }
  }
}
```

Then use manual activation:
```bash
copilot --agent=backend-architect "design API"
```

---

### Q: How do I update agent preferences?

**A**: Edit `.copilot/config.json`:

```json
{
  "agentPreferences": {
    "frontend-developer": {
      "preferredFramework": "vue"  // Change from "react"
    }
  }
}
```

---

### Q: Can I export my configuration?

**A**: Yes, copy the `.copilot` directory:

```bash
# Export to another project
cp -r .copilot /path/to/other/project/

# Share with team (commit to git)
git add .copilot/
git commit -m "Add agent configuration"
```

---

## 🚀 Advanced Usage

### Combining Workflows

```bash
# Run security audit after feature implementation
copilot --workflow=full-feature-implementation "user auth" && \
copilot --workflow=security-audit
```

### Custom Agent Chains

```bash
# Design → Implement → Test → Deploy
copilot --agent=backend-architect "design API" && \
copilot --agent=backend-architect "implement API" && \
copilot --agent=test-engineer "write tests" && \
copilot --agent=deployment-engineer "deploy"
```

### Context-Aware Development

```bash
# Work in specific directory to activate agents
cd src/components/
copilot "refactor all components"  # frontend-developer

cd api/
copilot "optimize endpoints"  # backend-architect

cd terraform/
copilot "review infrastructure"  # infrastructure-architect
```

---

## 📞 Getting Help

If you need assistance:

1. **Documentation**: Start here and in [README.md](./README.md)
2. **Quick Start**: See [QUICKSTART.md](./QUICKSTART.md) for examples
3. **Agent Catalog**: Check [AGENTS_CATALOG.md](./.copilot/AGENTS_CATALOG.md)
4. **Issues**: [Report bugs](https://github.com/RLuf/copilot-cli-arsenal/issues)
5. **Discussions**: [Ask questions](https://github.com/RLuf/copilot-cli-arsenal/discussions)

---

<div align="center">

**[⬆ Back to Top](#-copilot-cli-arsenal---complete-manual)**

**Made with ❤️ for developers**

</div>
