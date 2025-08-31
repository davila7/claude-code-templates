---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [environment-type] | --local | --docker | --cloud | --full-stack
description: Setup comprehensive development environment with tools, configurations, and workflows
model: sonnet
---

# Setup Development Environment

Setup comprehensive development environment with modern tooling: **$ARGUMENTS**

## Current Environment State

- Operating system: !`uname -s` and architecture detection
- Development tools: !`node --version 2>/dev/null || python --version 2>/dev/null || echo "No runtime detected"`
- Package managers: !`which npm yarn pnpm pip poetry cargo 2>/dev/null | wc -l` managers available
- IDE/Editor: Check for VS Code, IntelliJ, or other development environments

## Task

Configure complete development environment with modern tools and best practices:

**Environment Type**: Use $ARGUMENTS to specify local setup, Docker-based, cloud environment, or full-stack development

**Environment Setup**:
1. **Runtime Installation** - Programming languages, package managers, version managers (nvm, pyenv, rustup)
2. **Development Tools** - IDE configuration, extensions, debuggers, profilers, database clients
3. **Build System** - Compilers, bundlers, task runners, CI/CD tools, testing frameworks
4. **Code Quality** - Linting, formatting, pre-commit hooks, code analysis tools
5. **Environment Configuration** - Environment variables, secrets management, configuration files
6. **Team Synchronization** - Shared configurations, documentation, onboarding guides

**Advanced Features**: Hot reloading, debugging configuration, performance monitoring, container orchestration.

**Automation**: Automated setup scripts, configuration management, team environment synchronization.

**Output**: Complete development environment with documented setup process, team configurations, and troubleshooting guides.