---
allowed-tools: Read, Write, Edit, Bash, Glob
argument-hint: [project-type] [framework] | --react | --vue | --api | --cli
description: Initialize new project with essential structure, configuration, and development environment setup
---

# Initialize New Project

Initialize new project with essential structure: **$ARGUMENTS**

## Instructions

1. **Project Analysis and Setup**
   - Parse the project type and framework from arguments: `$ARGUMENTS`
   - If no arguments provided, analyze current directory and ask user for project type and framework
   - Create project directory structure if needed
   - Validate that the chosen framework is appropriate for the project type

2. **Base Project Structure**
   - Create essential directories (src/, tests/, docs/, etc.)
   - Initialize git repository with proper .gitignore for the project type
   - Create README.md with project description and setup instructions
   - Set up proper file structure based on project type and framework

3. **Framework-Specific Configuration**
   - **Web/React**: Set up React with TypeScript, Vite/Next.js, ESLint, Prettier
   - **Web/Vue**: Configure Vue 3 with TypeScript, Vite, ESLint, Prettier
   - **Web/Angular**: Set up Angular CLI project with TypeScript and testing
   - **API/Express**: Create Express.js server with TypeScript, middleware, and routing
   - **API/FastAPI**: Set up FastAPI with Python, Pydantic models, and async support
   - **Mobile/React Native**: Configure React Native with navigation and development tools
   - **Desktop/Electron**: Set up Electron with renderer and main process structure
   - **CLI/Node**: Create Node.js CLI with commander.js and proper packaging
   - **Library/NPM**: Set up library with TypeScript, rollup/webpack, and publishing config

4. **Development Environment Setup**
   - Configure package manager (npm, yarn, pnpm) with proper package.json
   - Set up TypeScript configuration with strict mode and path mapping
   - Configure linting with ESLint and language-specific rules
   - Set up code formatting with Prettier and pre-commit hooks
   - Add EditorConfig for consistent coding standards

5. **Testing Infrastructure**
   - Install and configure testing framework (Jest, Vitest, Pytest, etc.)
   - Set up test directory structure and example tests
   - Configure code coverage reporting
   - Add testing scripts to package.json/makefile

6. **Build and Development Tools**
   - Configure build system (Vite, webpack, rollup, etc.)
   - Set up development server with hot reloading
   - Configure environment variable management
   - Add build optimization and bundling

7. **CI/CD Pipeline**
   - Create GitHub Actions workflow for testing and deployment
   - Set up automated testing on pull requests
   - Configure automated dependency updates with Dependabot
   - Add status badges to README

8. **Documentation and Quality**
   - Generate comprehensive README with installation and usage instructions
   - Create CONTRIBUTING.md with development guidelines
   - Set up API documentation generation (JSDoc, Sphinx, etc.)
   - Add code quality badges and shields

9. **Security and Best Practices**
   - Configure security scanning with npm audit or similar
   - Set up dependency vulnerability checking
   - Add security headers for web applications
   - Configure environment-specific security settings

10. **Project Validation**
    - Verify all dependencies install correctly
    - Run initial build to ensure configuration is working
    - Execute test suite to validate testing setup
    - Check linting and formatting rules are applied
    - Validate that development server starts successfully
    - Create initial commit with proper project structure