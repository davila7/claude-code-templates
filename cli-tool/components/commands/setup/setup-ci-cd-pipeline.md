---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [platform] | --github-actions | --gitlab-ci | --azure-pipelines | --jenkins
description: Setup comprehensive CI/CD pipeline with automated testing, deployment, and monitoring
model: sonnet
---

# Setup CI/CD Pipeline

Setup comprehensive CI/CD pipeline with automated workflows and deployments: **$ARGUMENTS**

## Current Repository State

- Version control: !`git remote -v | head -1` (GitHub, GitLab, etc.)
- Existing CI: !`find . -name ".github" -o -name ".gitlab-ci.yml" -o -name "azure-pipelines.yml" | wc -l`
- Test framework: @package.json or testing files detection
- Deployment config: @Dockerfile or deployment manifests

## Task

Implement production-ready CI/CD pipeline with comprehensive automation and best practices:

**Platform Choice**: Use $ARGUMENTS to specify GitHub Actions, GitLab CI, Azure Pipelines, or Jenkins

**Pipeline Architecture**:
1. **Build Automation** - Code compilation, dependency installation, artifact creation
2. **Testing Strategy** - Unit tests, integration tests, e2e tests, code coverage reporting
3. **Quality Gates** - Linting, security scanning, vulnerability assessment, code quality metrics
4. **Deployment Automation** - Staging deployment, production deployment, rollback mechanisms
5. **Environment Management** - Infrastructure provisioning, configuration management, secrets handling
6. **Monitoring Integration** - Performance monitoring, error tracking, deployment notifications

**Advanced Features**: Parallel job execution, matrix builds, deployment strategies (blue-green, canary), and multi-environment support.

**Security & Compliance**: Secure credential management, compliance checks, audit trails, and approval workflows.

**Output**: Complete CI/CD pipeline with automated testing, secure deployments, monitoring integration, and comprehensive documentation.