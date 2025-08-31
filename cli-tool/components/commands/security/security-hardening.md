---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [focus-area] | --headers | --auth | --encryption | --infrastructure
description: Harden application security configuration with comprehensive security controls
model: sonnet
---

# Security Hardening

Harden application security configuration and controls: **$ARGUMENTS**

## Current Security Posture

- Framework: @package.json or @requirements.txt or @Cargo.toml (detect framework)
- Security headers: !`curl -I http://localhost:3000 2>/dev/null | grep -i 'x-\|content-security\|strict-transport' || echo "No server running"`
- Environment config: @.env* (check for security-related variables)
- Dependencies: !`npm audit --audit-level=moderate 2>/dev/null || echo "Run dependency audit first"`

## Task

Implement comprehensive security hardening based on security best practices:

**Hardening Focus**: Use $ARGUMENTS to target specific areas or apply comprehensive hardening

**Security Controls**:
1. **Authentication & Authorization** - MFA, RBAC, session security, password policies
2. **Input Validation** - XSS prevention, SQL injection protection, CSRF tokens
3. **Secure Communication** - HTTPS/TLS, HSTS, certificate management
4. **Data Protection** - Encryption at rest/transit, key management, secure storage
5. **Security Headers** - CSP, CORS, security response headers
6. **Infrastructure Security** - Container hardening, network segmentation, monitoring

**Output**: Hardened application with comprehensive security controls, proper configuration, and monitoring capabilities.
