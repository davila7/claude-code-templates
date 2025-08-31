---
allowed-tools: Read, Bash, Grep
argument-hint: [scope] | --security | --licenses | --updates | --all
description: Audit dependencies for security vulnerabilities, license compliance, and update recommendations
model: sonnet
---

# Dependency Audit

Audit dependencies for security vulnerabilities and compliance: **$ARGUMENTS**

## Current Dependencies

- Package files: @package.json or @requirements.txt or @Cargo.toml or @pom.xml
- Lock files: @package-lock.json or @poetry.lock or @Cargo.lock
- Security scan: !`npm audit --audit-level=moderate 2>/dev/null || pip check 2>/dev/null || cargo audit 2>/dev/null || echo "No security scanner available"`
- Outdated packages: !`npm outdated 2>/dev/null || pip list --outdated 2>/dev/null || echo "Check manually"`

## Task

Perform comprehensive dependency security and compliance audit:

**Audit Scope**: Use $ARGUMENTS to focus on security, licenses, updates, or complete audit

**Analysis Areas**:
1. **Vulnerability Scanning** - Known CVEs, security advisories, exploit availability
2. **Version Analysis** - Outdated packages, breaking changes, update recommendations
3. **License Compliance** - License compatibility, restrictions, legal obligations
4. **Supply Chain Security** - Package authenticity, maintainer status, suspicious dependencies
5. **Performance Impact** - Bundle size, unused dependencies, optimization opportunities

**Output**: Prioritized security report with critical vulnerabilities, recommended actions, and compliance status.
