---
sidebar_position: 2
---

# Agents 🤖

**Agents** are specialized Claude Code assistants designed to excel in particular areas of development. Each agent comes with domain-specific knowledge, optimized prompts, and focused expertise to help you tackle specific development challenges more effectively.

## What Are Agents?

Agents extend Claude Code's capabilities by providing:

- **Specialized Knowledge**: Deep expertise in specific domains (React optimization, security auditing, database design, etc.)
- **Optimized Prompts**: Pre-configured instructions that guide Claude Code's responses for better results
- **Context Awareness**: Understanding of specific frameworks, tools, and best practices
- **Focused Assistance**: Targeted help for particular development tasks rather than general coding support

## Available Agents

### Frontend Development Agents

#### React Performance Optimization
- **Purpose**: Specializes in React application performance analysis and optimization
- **Expertise**: Component re-rendering, memory leaks, bundle size optimization, lazy loading
- **Best For**: Teams experiencing React performance issues or building large-scale applications

```bash
# Install specific agent using new CLI parameter (recommended)
npx claude-code-templates@latest --agent=react-performance --yes

# Or install via complete template
npx claude-code-templates@latest --template=react --yes

# Legacy syntax (still supported)
npx claude-code-templates@latest --language=javascript-typescript --framework=react
```

#### Vue.js Development Assistant  
- **Purpose**: Expert in Vue.js best practices and modern development patterns
- **Expertise**: Composition API, Pinia state management, Vue 3 optimization, SSR/SSG
- **Best For**: Vue.js projects requiring architectural guidance and optimization

#### Angular Architecture Guide
- **Purpose**: Focuses on Angular application architecture and scalability
- **Expertise**: NgRx state management, dependency injection, lazy loading, micro-frontends
- **Best For**: Enterprise Angular applications with complex requirements

### Backend Development Agents

#### API Security Audit
- **Purpose**: Specializes in API security analysis and vulnerability detection
- **Expertise**: Authentication, authorization, input validation, OWASP compliance
- **Best For**: Projects requiring security reviews or API hardening

#### Database Optimization Specialist
- **Purpose**: Expert in database query optimization and schema design
- **Expertise**: SQL optimization, indexing strategies, query performance, schema normalization
- **Best For**: Applications with performance bottlenecks or complex data requirements

#### Microservices Architecture
- **Purpose**: Guides microservices design patterns and implementation
- **Expertise**: Service decomposition, API design, data consistency, monitoring
- **Best For**: Teams transitioning to or optimizing microservices architectures

### DevOps & Infrastructure Agents

#### Docker & Containerization Expert
- **Purpose**: Specializes in containerization strategies and Docker optimization
- **Expertise**: Multi-stage builds, security scanning, orchestration, CI/CD integration
- **Best For**: Projects adopting containerization or optimizing existing Docker setups

#### Kubernetes Operations Guide
- **Purpose**: Expert in Kubernetes deployment and operations
- **Expertise**: Pod optimization, service mesh, monitoring, scaling strategies
- **Best For**: Teams deploying to or managing Kubernetes clusters

#### CI/CD Pipeline Optimizer
- **Purpose**: Focuses on continuous integration and deployment optimization
- **Expertise**: GitHub Actions, pipeline efficiency, testing strategies, deployment automation
- **Best For**: Teams looking to improve their development workflow and deployment processes

## How Agents Work

### Integration with Claude Code
Agents integrate seamlessly with Claude Code by:

1. **Enhanced Context**: Providing specialized context about specific domains
2. **Guided Responses**: Steering Claude Code's responses toward domain-specific best practices
3. **Tool Recommendations**: Suggesting appropriate tools and libraries for specific tasks
4. **Code Review Focus**: Offering targeted code review suggestions based on specialization

### Agent Activation
When you install templates or configure your project, relevant agents are automatically activated based on:

- **Project Type**: Framework and language detection
- **Explicit Selection**: Manual agent selection during setup
- **Configuration Files**: Presence of specific configuration files (package.json, requirements.txt, etc.)

## Installation & Configuration

### Individual Agent Installation (Recommended)
Install specific agents using the `--agent` parameter:

```bash
# Install specific agents directly
npx claude-code-templates@latest --agent=react-performance --yes
npx claude-code-templates@latest --agent=api-security-audit --yes
npx claude-code-templates@latest --agent=database-optimization --yes
npx claude-code-templates@latest --agent=vue-development --yes
npx claude-code-templates@latest --agent=docker-expert --yes
```

### Via Template Installation
Agents are also included in complete template installations:

```bash
# React template includes performance optimization agent
npx claude-code-templates@latest --template=react --yes

# Python template includes API security agent
npx claude-code-templates@latest --template=python --yes

# Node.js template includes database optimization agent  
npx claude-code-templates@latest --template=nodejs --yes

# Legacy syntax (still supported but deprecated)
npx claude-code-templates@latest --language=javascript-typescript --framework=react
```

### Manual Agent Configuration
You can also configure agents manually by modifying your `CLAUDE.md` file:

```markdown
# In your CLAUDE.md file

## Active Agents

### React Performance Optimization Agent
This project uses a specialized React performance optimization agent that focuses on:
- Component re-rendering analysis
- Memory leak detection
- Bundle size optimization
- Lazy loading implementation

When working on performance issues, this agent will:
1. Analyze component render patterns
2. Suggest memoization strategies
3. Recommend code splitting approaches
4. Identify performance bottlenecks
```

### Agent-Specific Commands
Many agents come with specialized slash commands:

```bash
# Performance analysis command (React agent)
/analyze-performance

# Security audit command (API security agent)  
/security-audit

# Query optimization command (Database agent)
/optimize-queries
```

## Working with Agents

### Best Practices

#### Agent Selection
- **Choose Relevant Agents**: Select agents that match your project's primary challenges
- **Avoid Over-Configuration**: Too many agents can create conflicting advice
- **Update Regularly**: Keep agent configurations updated as your project evolves

#### Effective Agent Usage
- **Be Specific**: Provide clear context about what you're trying to optimize or solve
- **Follow Recommendations**: Agents provide tested, domain-specific advice
- **Iterate**: Use agent feedback to improve code incrementally
- **Document Decisions**: Keep track of agent recommendations you implement

### Common Use Cases

#### Performance Optimization
```bash
# Example interaction with React Performance Agent
User: "My React app is slow when rendering large lists"

Agent Response: 
"Based on the React Performance Optimization agent, here are specific strategies:

1. Implement virtualization using react-window or react-virtualized
2. Use React.memo() for list item components
3. Optimize key props to prevent unnecessary re-renders
4. Consider pagination or infinite scrolling

Let me analyze your current list component and provide specific optimizations..."
```

#### Security Review
```bash
# Example interaction with API Security Agent
User: "Review this authentication endpoint for security issues"

Agent Response:
"The API Security agent has identified several concerns:

1. Missing rate limiting on login attempts
2. Password complexity not enforced server-side
3. JWT tokens lack proper expiration handling
4. CORS configuration too permissive

Here's how to address each issue with specific code examples..."
```

## Agent Development

### Creating Custom Agents
You can contribute custom agents to the community:

#### Agent Structure
```markdown
# Agent Template Structure

## Agent Name
Brief description of the agent's purpose and expertise.

### Specialized Knowledge
- Domain expertise area 1
- Domain expertise area 2
- Domain expertise area 3

### Key Responsibilities
- Primary responsibility 1
- Primary responsibility 2
- Primary responsibility 3

### Activation Triggers
- When to automatically activate this agent
- Project characteristics that indicate need
- File patterns or configurations that suggest relevance

### Custom Commands
- /command-1: Description of what this command does
- /command-2: Description of what this command does

### Integration Guidelines
How this agent works with existing Claude Code functionality.
```

#### Contribution Process
1. **Identify Expertise Gap**: Find an area where specialized knowledge would help developers
2. **Research Best Practices**: Gather domain-specific knowledge and patterns
3. **Create Agent Definition**: Follow the agent template structure
4. **Test Thoroughly**: Validate the agent with real-world scenarios
5. **Submit for Review**: Create a pull request with documentation and examples

### Agent Quality Guidelines

#### Expertise Requirements
- **Deep Knowledge**: Agents should have genuine expertise, not generic advice
- **Practical Focus**: Emphasize actionable recommendations over theory
- **Current Practices**: Stay updated with latest tools and best practices
- **Clear Scope**: Define clear boundaries of what the agent covers

#### Documentation Standards
- **Clear Purpose**: Explain what problems the agent solves
- **Usage Examples**: Provide realistic scenarios and interactions
- **Integration Guide**: Show how the agent works with existing workflows
- **Troubleshooting**: Include common issues and solutions

## Troubleshooting

### Common Issues

#### Agent Not Responding Appropriately
- **Check Configuration**: Verify agent is properly defined in CLAUDE.md
- **Review Context**: Ensure you're providing relevant domain-specific context
- **Update Agent**: Check for newer versions of the agent configuration

#### Conflicting Agent Advice
- **Review Agent Overlap**: Check if multiple agents cover similar areas
- **Prioritize by Relevance**: Focus on the most relevant agent for your current task
- **Customize Configuration**: Adjust agent configurations to reduce conflicts

#### Performance Impact
- **Monitor Response Time**: Too many agents can slow Claude Code responses
- **Selective Activation**: Only activate agents relevant to current work
- **Regular Cleanup**: Remove unused or outdated agent configurations

---

**Related Documentation:**
- [Components Overview](./overview) - Understanding the component system
- [Commands](./commands) - Custom slash commands for Claude Code
- [MCPs](./mcps) - External service integrations
- [Contributing](../contributing) - How to contribute new agents