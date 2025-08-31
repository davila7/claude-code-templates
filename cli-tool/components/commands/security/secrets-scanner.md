---
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [scope] | --api-keys | --passwords | --certificates | --fix
description: Scan codebase for exposed secrets, credentials, and sensitive information
model: sonnet
---

# Secrets Scanner

Scan codebase for exposed secrets and sensitive information: **$ARGUMENTS**

## Current Repository State

- Git status: !`git status --porcelain | wc -l` uncommitted files
- File types: !`find . -name "*.js" -o -name "*.py" -o -name "*.env*" -o -name "*.yml" | wc -l` scannables
- Recent commits: !`git log --oneline --grep="password\|key\|secret\|token" -5`
- Environment files: @.env* or @config/* (if exists)

## Task

Perform comprehensive secrets detection and remediation across codebase:

**Scan Scope**: Use $ARGUMENTS to focus on API keys, passwords, certificates, or complete scan

**Detection Categories**:
1. **API Keys & Tokens** - GitHub, AWS, Google Cloud, Stripe, third-party services
2. **Database Credentials** - Connection strings, usernames, passwords
3. **Certificates & Keys** - Private keys, SSH keys, SSL certificates
4. **Authentication Secrets** - JWT secrets, session keys, OAuth credentials
5. **Configuration Leaks** - Hardcoded URLs, internal endpoints, debug settings

**Remediation Actions**:
- Identify exposed secrets with file locations and line numbers
- Provide secure alternatives (environment variables, secret management)
- Generate .gitignore entries for sensitive files
- Create secure configuration templates
- Implement secrets management best practices

**Output**: Detailed security report with risk levels, immediate actions, and long-term security improvements.