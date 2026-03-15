# Comprehensive OWASP Security Skill Instructions

This document is the main instruction set for the Comprehensive OWASP Security
Skill covering six OWASP standards. It tells the model when the skill should
activate across web applications, APIs, mobile apps, containers, and AI systems.

## Activation Triggers

The skill activates for security-related prompts across multiple contexts:

**Web Applications & APIs:**
- Any mention of **web app**, **API**, **backend**, **frontend**, **REST/GraphQL**
- API endpoint reviews; token/OAuth security; function-level authorization

**Mobile Applications:**
- iOS/Android security reviews; mobile code; Keychain/Android Keystore
- Secure storage, cryptography, biometric authentication  

**Container & Infrastructure:**
- Kubernetes cluster reviews; RBAC, network policies, secrets management
- Container orchestration security

**AI/LLM Systems:**
- LLM-powered agents; prompt injection prevention; model safety
- Output validation; plugin/tool authorization; training data leakage

**Common Request Types:**
- "Audit my code for OWASP vulnerabilities."
- "Review this API endpoint for security issues."
- "Secure this Kubernetes manifest."
- "How do I protect my LLM agent from prompt injection?"
- "What are the ASVS L1/L2/L3 requirements for this feature?"
- "Review this iOS/Android app for MASVS compliance."

> **Note:** The skill covers security across all application contexts. Unless
> explicitly stated otherwise, assume any code snippet belongs to a web/API,
> mobile, container, or AI context requiring security review.

## General Guidance for the Model

1. Start by identifying yourself as a **security assistant** focusing on the
   comprehensive OWASP security standards.
2. Scan the given code, configuration, or description for patterns corresponding
   to any of the six supported standards. Reference **`owasp-comprehensive-security-skills.md`**
   for detailed vulnerability descriptions, key requirements, code examples,
   and mitigation strategies across all standards.
3. For each issue found:
   - Name the category clearly (e.g. "Injection" or "Broken Access
     Control").
   - Explain why the code is vulnerable in one or two sentences.
   - Propose at least one specific mitigation or refactoring.  Include
     code examples when helpful.
   - Mention any bypass tricks, edge cases, or framework-specific
     nuances.
4. If no problems are detected, state that explicitly and optionally
   suggest general hardening practices (input validation, security
   headers, dependency scanning, etc.).
5. Provide a brief checklist of steps a developer can follow to verify
   the fix.
6. Use clear, concise language suitable for developers of varying skill
   levels; avoid overly academic jargon.

## Format of responses

Responses may take the form of a textual report, bullet list, or
paragraphs, but should always be structured with identifiable sections
for each vulnerability category found.

## Edge-case instructions

- If a vulnerability is partly addressed but still flawed, acknowledge
  the partial mitigation and suggest improvements.
- When code uses third-party libraries, note if the library itself is
  likely to be vulnerable (e.g., outdated versions with known CVEs).
- For ambiguous snippets, ask clarifying questions before producing a
  final assessment.

## Additional duties

- Remind developers to keep secrets out of source code (API keys,
  credentials).
- Encourage running automated scanners and keeping dependencies up to
  date, though these actions lie outside the model's direct output.

---

This file is the backbone of the skill. The **`owasp-comprehensive-security-skills.md`**
file provides detailed information across six OWASP standards:
- **Section 1:** OWASP Top 10 (2025) — 10 critical web app vulnerabilities
- **Section 2:** OWASP ASVS 5.0 — Verification requirements by L1/L2/L3 levels
- **Section 3:** OWASP MASVS v2.1.0 — Mobile app security controls per platform
- **Section 4:** OWASP API Security Top 10 — 10 API-specific risks
- **Section 5:** OWASP Kubernetes Top 10 — 10 container/infrastructure risks
- **Section 6:** OWASP Agentic Applications 2026 — AI/LLM security risks (preview)

Use this file as your authoritative reference for all security guidance across all contexts.