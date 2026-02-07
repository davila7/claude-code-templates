# Security Controls and Asset Categories

Use this as a lightweight checklist to keep outputs consistent across teams. Prefer concrete, system-specific items over generic text.

## Asset categories (pick only what applies)
- User data (PII, content, uploads)
- Authentication artifacts (passwords, tokens, sessions, cookies)
- Authorization state (roles, policies, ACLs)
- Secrets and keys (API keys, signing keys, encryption keys)
- Configuration and feature flags
- Models and weights (if ML systems)
- Source code and build artifacts
- Audit logs and telemetry
- Availability-critical resources (queues, caches, rate limits, compute budgets)
- Tenant isolation boundaries and metadata

## Security control categories
- Identity and access: authN, authZ, session handling, mTLS, key rotation
- Input protection: schema validation, parsing hardening, upload scanning, sandboxing
- Network safeguards: TLS, network policies, WAF, rate limiting, DoS controls
- Data protection: encryption at rest/in transit, tokenization, redaction
- Isolation: process sandboxing, container boundaries, tenant isolation, seccomp
- Observability: audit logs, alerting, anomaly detection, tamper resistance
- Supply chain: dependency pinning, SBOMs, provenance, signing
- Change control: CI checks, deployment approvals, config guardrails

## Mitigation phrasing patterns
- "Enforce schema at <boundary> for <payload> before <component>."
- "Require authZ check for <action> on <resource> in <service>."
- "Isolate <parser/component> in a sandbox with <resource limits>."
- "Rate limit <endpoint> by <key> and apply burst caps."
- "Encrypt <data> at rest using <key management> and rotate <keys>."
