---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [monorepo-tool] | --nx | --lerna | --rush | --turborepo | --yarn-workspaces
description: Configure monorepo project structure with comprehensive workspace management and build orchestration
model: sonnet
---

# Setup Monorepo

Configure comprehensive monorepo structure with advanced workspace management: **$ARGUMENTS**

## Current Project State

- Repository structure: !`find . -maxdepth 2 -type d | head -10`
- Package manager: @package.json or existing workspace configuration
- Existing monorepo: @nx.json or @lerna.json or @rush.json or @turbo.json
- Project count: !`find . -name "package.json" -not -path "./node_modules/*" | wc -l`

## Task

Implement production-ready monorepo with advanced workspace management and build orchestration:

**Monorepo Tool**: Use $ARGUMENTS to configure Nx, Lerna, Rush, Turborepo, or Yarn Workspaces

**Monorepo Architecture**:
1. **Workspace Structure** - Directory organization, package architecture, shared libraries, application separation
2. **Dependency Management** - Workspace dependencies, version management, package hoisting, conflict resolution
3. **Build Orchestration** - Task dependencies, parallel builds, incremental compilation, affected package detection
4. **Development Workflow** - Hot reloading, debugging, testing strategies, development server coordination
5. **CI/CD Integration** - Build pipelines, affected project detection, deployment orchestration, artifact management
6. **Tooling Configuration** - Shared configurations, code quality tools, testing frameworks, documentation

**Advanced Features**: Task caching, distributed execution, performance optimization, plugin ecosystem integration.

**Team Productivity**: Developer experience optimization, onboarding automation, maintenance procedures.

**Output**: Complete monorepo setup with optimized build system, comprehensive tooling, and team productivity enhancements.