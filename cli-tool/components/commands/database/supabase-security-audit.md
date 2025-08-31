---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [audit-scope] | --rls | --permissions | --auth | --api-keys | --comprehensive
description: Conduct comprehensive Supabase security audit with RLS analysis and vulnerability assessment
model: sonnet
---

# Supabase Security Audit

Conduct comprehensive Supabase security audit with RLS policy analysis and vulnerability assessment: **$ARGUMENTS**

## Current Security Context

- Supabase access: MCP integration for security analysis and policy review
- RLS policies: Current Row Level Security implementation and policy effectiveness
- Auth configuration: !`find . -name "*auth*" -o -name "*supabase*" | grep -E "\\.(js|ts|json)$" | head -5` authentication setup
- API security: Current API key management and access control implementation

## Task

Execute comprehensive security audit with vulnerability assessment and policy optimization:

**Audit Scope**: Use $ARGUMENTS to focus on RLS policies, permission analysis, authentication security, API key management, or comprehensive security review

**Security Audit Framework**:
1. **RLS Policy Analysis** - Review Row Level Security policies, test policy effectiveness, identify policy gaps, optimize policy performance
2. **Permission Assessment** - Analyze table permissions, review role-based access, validate permission hierarchies, identify over-privileged access
3. **Authentication Security** - Review auth configuration, analyze JWT security, validate session management, assess multi-factor authentication
4. **API Key Management** - Audit API key usage, review key rotation policies, validate key scoping, assess exposure risks
5. **Data Protection** - Analyze sensitive data handling, review encryption implementation, validate data masking, assess backup security
6. **Vulnerability Scanning** - Identify security vulnerabilities, assess injection risks, review CORS configuration, validate rate limiting

**Advanced Features**: Automated security testing, policy simulation, vulnerability scoring, compliance checking, security monitoring setup.

**Compliance Integration**: GDPR compliance checking, SOC2 requirements validation, security best practices enforcement, audit trail analysis.

**Output**: Comprehensive security audit report with vulnerability assessments, policy recommendations, security improvements, and compliance validation.