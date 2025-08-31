---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [auth-method] | --oauth | --jwt | --mfa | --passwordless
description: Implement secure user authentication system with chosen method and security best practices
model: sonnet
---

# Add Authentication System

Implement secure user authentication system: **$ARGUMENTS**

## Current Application State

- Framework detection: @package.json or @requirements.txt or @Cargo.toml
- Existing auth: !`grep -r "auth\|login\|jwt\|session" src/ --include="*.js" --include="*.py" --include="*.rs" | wc -l`
- Security config: @.env* (check for auth-related variables)
- Database setup: Check for user models or auth tables

## Task

Implement comprehensive authentication system with security best practices:

**Authentication Methods**: Choose from username/password, OAuth 2.0, JWT, SAML, MFA, or passwordless based on $ARGUMENTS

**Implementation Areas**:
1. **User Management** - Registration, profiles, password policies, account verification
2. **Authentication Flow** - Login/logout, session management, token handling, middleware
3. **Authorization System** - RBAC, permissions, route protection, API security
4. **Security Hardening** - Password hashing, rate limiting, CSRF protection, secure cookies
5. **Integration** - Frontend components, API endpoints, database models, middleware

**Security Standards**: Implement OWASP authentication guidelines, secure session management, and proper error handling.

**Output**: Production-ready authentication system with comprehensive security controls and user-friendly interface.
