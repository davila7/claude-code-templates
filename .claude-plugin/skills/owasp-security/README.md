# Comprehensive OWASP Security Skill

A unified security reference skill covering six OWASP standards for developers building secure web applications, APIs, mobile apps, containers, and AI/LLM systems.

Drop this folder into your model's skill directory, and any security-related prompt—code reviews, architecture decisions, auth implementation, or deployment configuration—will trigger deep security analysis focused on the OWASP standards most relevant to your context.

---

## 🔍 What It Does

This skill doesn't just flag problems; it teaches and guides across multiple security domains:

- **Reads your code, configuration, or description** and identifies security risks across all supported contexts.
- **References the appropriate OWASP standard** for your specific use case (web app, API, mobile, K8s, AI).
- **Recommends concrete remedies** with code examples, configuration patterns, and step-by-step fixes.
- **Warns about clever bypasses** and edge cases attackers exploit.
- **Adapts to your context** — automatically selects relevant guidance for web apps, APIs, containerized systems, mobile apps, or AI agents.


## 📥 Installation

Getting started is fast:

1. Clone the repo:
   ```bash
   git clone https://github.com/mfkocalar/OWASP-Security-Skills.git
   cd OWASP-Security-Skills
   ```
2. Link or copy it into your assistant's skill folder:
   - **Claude:** `~/.claude/skills/owasp-security`
   - **GitHub Copilot:** `~/.copilot/skills/owasp-security` or `.github/skills`
   - **Other agents:** similar directories under `~/.agents`

   ```bash
   ln -s "$PWD" ~/.claude/skills/owasp-security
   ```

3. Reload or restart the assistant if needed.

Now the skill is live for any security-related prompt.


## 🎯 Coverage: Six OWASP Standards

### **OWASP Top 10 (2025)** — Web Application Security
Critical risks: Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Security Misconfiguration, Vulnerable Components, Authentication Failures, Software Integrity, Logging Failures, SSRF.

### **OWASP ASVS 5.0** — Application Security Verification
Detailed requirements across L1 (Basic), L2 (Standard), L3 (Advanced) for: Authentication, Access Control, Cryptography, Input Validation, Session Management, and more.

### **OWASP MASVS v2.1.0** — Mobile App Security
8 control groups (Storage, Crypto, Auth, Network, Platform, Code, Resilience, Privacy) with iOS/Android-specific implementation guidance.

### **OWASP API Security Top 10 (2023)** — API-Specific Risks
10 risks: BOLA, Broken Auth, Property-Level Auth, Resource Consumption, Function Auth, Sensitive Flow Abuse, SSRF, Misconfiguration, Inventory Management, Unsafe Third-Party APIs.

### **OWASP Kubernetes Top 10 (2025)** — Container & Infrastructure Security
10 risks in containerized environments: Insecure Workload Config, RBAC, Secrets Management, Policy Enforcement, Network Segmentation, Exposed Components, Vulnerable Components, Cluster Lateral Movement, Authentication, Logging.

### **OWASP Agentic Applications 2026 (Preview)** — AI/LLM Security
10 emerging risks: Prompt Injection, Insufficient Input Validation, Insecure Output Handling, Model Poisoning, Denial of Service, Unauthorized Tool Access, Training Data Leakage, Excessive Autonomy, Inadequate Logging, Supply Chain Risks.


## 🚀 Quick Start

Just ask. For example:

```
I'm reviewing a REST API endpoint. Please audit this code for OWASP API security issues.

[insert code here]
```

The skill responds with a clear analysis—"BOLA vulnerability here…", "Missing rate limiting on that endpoint…"—and shows how to patch each issue.

You can also call it directly for multi-standard reviews:

```
Review my Kubernetes manifests against the OWASP Top 10 for K8s and provide hardening steps.
```

or

```
I'm integrating an LLM agent. What are the key security risks I should worry about?
```

The skill returns targeted guidance from the relevant OWASP standard.

## 🎯 Example Prompts by Domain

These example prompts automatically trigger the relevant security standard:

### Web Application & API Security (OWASP Top 10 + API Security)
```
Review this code for SQL injection vulnerabilities
Audit this REST API endpoint for BOLA and broken authentication
Check this authentication endpoint for weaknesses
Is this login form secure against credential stuffing?
```

### Mobile Security (MASVS)
```
Is this iOS Keychain implementation secure?
Review this Android storage for MASVS compliance
Audit biometric authentication in this mobile app
Check for certificate pinning in this API client
```

### Container & Kubernetes (K8s Top 10)
```
Harden this Kubernetes RBAC configuration
Review this pod for security misconfigurations
Audit etcd encryption and secrets management
Check network policies for segmentation
```

### AI/LLM Security (Agentic Applications)
```
How do I prevent prompt injection in my chatbot?
Audit this LLM agent for unauthorized tool access
Review output filtering for sensitive data leakage
Check for training data exposure vulnerabilities
```

### Compliance & Standards (ASVS)
```
What ASVS L2 requirements apply to this application?
Is this mobile app MASVS compliant?
List the top API Security risks for my endpoint
Show me ASVS L1/L2/L3 requirements for authentication
```

## 🧪 Examples

**9 intentionally vulnerable code samples** in `examples/` let you test the skill across all domains.  
Each example shows **VULNERABLE patterns** alongside **SECURE implementations** with detailed explanations.

### OWASP Top 10 Examples:

- **[examples/broken-access-control.py](examples/broken-access-control.py)** — Permission bypasses & missing authorization checks (A01)
- **[examples/cryptographic-failures.js](examples/cryptographic-failures.js)** — Weak hashing, plaintext storage, hardcoded keys, missing TLS (A02)  
- **[examples/injection.js](examples/injection.js)** – SQL injection via string concatenation (A03)
- **[examples/security-misconfiguration.py](examples/security-misconfiguration.py)** — Debug mode, default credentials, missing security headers (A05)
- **[examples/xss.html](examples/xss.html)** – Reflected XSS with `innerHTML` (A07)
- **[examples/logging-monitoring-failures.py](examples/logging-monitoring-failures.py)** — Missing security logs, secrets in logs, no alerting (A09)

### Multi-Standard Examples:

- **[examples/api-auth-bypass.js](examples/api-auth-bypass.js)** — JWT validation flaws & CORS misconfiguration (OWASP API Security Top 10)
- **[examples/k8s-rbac.yaml](examples/k8s-rbac.yaml)** — Overly permissive RBAC & unencrypted secrets (OWASP Kubernetes Top 10)
- **[examples/prompt-injection.txt](examples/prompt-injection.txt)** — Direct/indirect LLM prompt injection patterns (OWASP Agentic Applications 2026)

### How to Use Examples:

Paste code into prompts to trigger skill analysis:
```
Please review this code for security vulnerabilities according to the OWASP Top 10.

[paste example code here]
```

The skill identifies vulnerabilities, explains risks, and shows how to apply the SECURE patterns from each example.

---

## 📖 Comprehensive Reference

The core reference is **`owasp-comprehensive-security-skills.md`** — a unified guide combining all six OWASP standards with:
- Key vulnerability descriptions
- Detection clues
- Mitigation strategies & code examples
- Prevention checklists
- Cross-standard references for unified security architecture

Use this for deep dives into specific standards or cross-referencing security requirements across contexts.

---

## 🛠️ Use Cases

- **Code Review:** "Audit this component against OWASP guidelines."
- **API Design:** "Review this endpoint design for OWASP API security risks."
- **Mobile Development:** "Is this iOS implementation compliant with MASVS?"
- **Infrastructure:** "Harden this Kubernetes cluster using OWASP K8s Top 10 guidance."
- **AI/LLM Integration:** "How do I secure this AI agent against prompt injection?"
- **Compliance:** "What ASVS L2 requirements apply to authentication in this flow?"

---

## 📝 Contributing

Found an issue or have an improvement? Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

**Status:** Actively maintained. Covers OWASP standards as of March 2026. Agentic Applications section based on preview materials; will be updated when fully released.
