# Security Audit System Architecture

## Overview
This document outlines the security validation system for Claude Code Templates components (agents, commands, MCPs, settings, hooks).

## Industry Standards Reference

### Implemented Standards
- **NPM 2025**: SHA256 hashing, provenance metadata, trusted publishing principles
- **SLSA Framework**: Level 2 compliance (build integrity, tamper resistance)
- **PyPI Security**: Content validation, typo-squatting detection
- **GitHub Security**: Secret scanning patterns, malicious pattern detection

## System Architecture

```
cli-tool/src/validation/
├── validators/
│   ├── StructuralValidator.js      # Frontmatter, size, encoding
│   ├── SemanticValidator.js        # Prompt injection, jailbreaks
│   ├── ReferenceValidator.js       # URLs, HTML, Safe Browsing
│   ├── IntegrityValidator.js       # SHA256, version tracking
│   └── ProvenanceValidator.js      # Author, repo, commit metadata
├── ValidationOrchestrator.js       # Coordinates all validators
├── security-audit.js               # CLI command implementation
└── ARCHITECTURE.md                 # This file

.github/workflows/
└── component-validation.yml        # PR validation workflow
```

## Validation Tiers

### Tier 1: Structural Validation (CRITICAL)
**Validators**: `StructuralValidator.js`
- ✅ YAML frontmatter validation (name, description, tools, model)
- ✅ File size limits (max 100KB for agents/commands)
- ✅ UTF-8 encoding validation
- ✅ Section count limits (prevent context overflow)
- ✅ Required fields presence check

**Error Codes**: `STRUCT_*`

### Tier 2: Semantic Validation (HIGH PRIORITY)
**Validators**: `SemanticValidator.js`
- ✅ Prompt injection detection
- ✅ Jailbreak pattern detection
- ✅ Instruction override attempts
- ✅ Self-modification requests
- ✅ Credential harvesting patterns

**Patterns to Detect**:
```javascript
const DANGEROUS_PATTERNS = [
  /ignore\s+(previous|all)\s+instructions?/i,
  /system\s+prompt|developer\s+instructions?/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /execute\s+the\s+following\s+(code|command)/i,
  /fetch.*?(token|key|password|credential)/i,
  /open\s+a?\s?shell/i,
  /<script|<iframe|javascript:/i
];
```

**Error Codes**: `SEM_*`

### Tier 3: Reference Validation (MEDIUM PRIORITY)
**Validators**: `ReferenceValidator.js`
- ✅ URL validation (HTTPS only)
- ✅ Private IP blocking (127.0.0.1, 10.0.0.0/8, 192.168.0.0/16)
- ✅ file:// protocol blocking
- ✅ HTML tag sanitization
- ✅ Google Safe Browsing API integration (optional)

**Error Codes**: `REF_*`

### Tier 4: Integrity (HIGH PRIORITY)
**Validators**: `IntegrityValidator.js`
- ✅ SHA256 hash generation
- ✅ Hash verification on install
- ✅ Version tracking
- ✅ Signature validation (future)

**Error Codes**: `INT_*`

### Tier 5: Provenance (MEDIUM PRIORITY)
**Validators**: `ProvenanceValidator.js`
- ✅ Author metadata extraction
- ✅ Source repository tracking
- ✅ Git commit SHA tracking
- ✅ Timestamp tracking
- ⏳ Digital signatures (future)

**Error Codes**: `PROV_*`

## CLI Usage

### Command: `--security-audit`

```bash
# Validate all components in the repository
npx create-claude-config --security-audit

# Validate specific component type
npx create-claude-config --security-audit --agent frontend-developer

# Validate specific file
npx create-claude-config --security-audit --file ./components/agents/frontend-developer.md

# Validate with verbose output
npx create-claude-config --security-audit --verbose

# Generate security report (JSON)
npx create-claude-config --security-audit --output report.json

# Validate in CI/CD mode (exit 1 on errors)
npx create-claude-config --security-audit --ci
```

### Output Format

```
🔒 Security Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Scanning: cli-tool/components/agents/

✅ frontend-developer.md
   ├─ Structural: PASS
   ├─ Semantic: PASS
   ├─ References: PASS
   ├─ Integrity: PASS (sha256: a3f2...)
   └─ Provenance: PASS (author: claude-code-templates)

⚠️  backend-api-specialist.md
   ├─ Structural: PASS
   ├─ Semantic: WARNING (SEM_W001: Potential instruction override)
   ├─ References: PASS
   ├─ Integrity: PASS (sha256: b4e1...)
   └─ Provenance: PASS

❌ malicious-agent.md
   ├─ Structural: PASS
   ├─ Semantic: FAIL (SEM_E001: Jailbreak pattern detected)
   ├─ References: FAIL (REF_E001: file:// protocol detected)
   └─ Integrity: PASS (sha256: c5d2...)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary:
  Total: 3 components
  ✅ Passed: 1
  ⚠️  Warnings: 1
  ❌ Failed: 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## GitHub Actions Integration

### Workflow: `.github/workflows/component-validation.yml`

```yaml
name: Component Security Validation

on:
  pull_request:
    paths:
      - 'cli-tool/components/**/*.md'
  push:
    branches:
      - main

jobs:
  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd cli-tool
          npm install

      - name: Run Security Audit
        run: |
          cd cli-tool
          npm run security-audit -- --ci --verbose

      - name: Upload Security Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: security-audit-report
          path: cli-tool/security-report.json
```

### PR Checks
- ✅ All validators must pass
- ⚠️  Warnings are allowed but reported
- ❌ Any errors block the PR

## Component Metadata Schema

### Enhanced components.json
```json
{
  "agents": [
    {
      "name": "frontend-developer",
      "path": "agents/development-team/frontend-developer.md",
      "description": "...",
      "security": {
        "validated": true,
        "validatedAt": "2025-10-15T15:30:00Z",
        "hash": "sha256:a3f2e1d4...",
        "version": "1.0.0",
        "provenance": {
          "author": "claude-code-templates",
          "repository": "https://github.com/danimesq/claude-code-templates",
          "commit": "43dd5f9",
          "verifiedAuthor": false
        },
        "audit": {
          "structural": { "passed": true, "score": 100 },
          "semantic": { "passed": true, "score": 100 },
          "references": { "passed": true, "score": 100 },
          "integrity": { "passed": true, "score": 100 },
          "provenance": { "passed": true, "score": 95 }
        }
      }
    }
  ]
}
```

## Error Code Reference

### Structural (STRUCT_*)
- `STRUCT_E001`: Missing required frontmatter
- `STRUCT_E002`: Invalid YAML syntax
- `STRUCT_E003`: File size exceeds limit
- `STRUCT_E004`: Invalid UTF-8 encoding
- `STRUCT_W001`: Missing optional field

### Semantic (SEM_*)
- `SEM_E001`: Jailbreak pattern detected
- `SEM_E002`: Prompt injection detected
- `SEM_E003`: Instruction override attempt
- `SEM_E004`: Self-modification request
- `SEM_E005`: Credential harvesting pattern
- `SEM_W001`: Suspicious instruction wording

### References (REF_*)
- `REF_E001`: Insecure protocol (file://, http://)
- `REF_E002`: Private IP address detected
- `REF_E003`: Malicious URL (Safe Browsing)
- `REF_E004`: Dangerous HTML tag
- `REF_W001`: Missing HTTPS

### Integrity (INT_*)
- `INT_E001`: Hash mismatch
- `INT_E002`: Missing version
- `INT_E003`: Invalid signature
- `INT_W001`: No signature provided

### Provenance (PROV_*)
- `PROV_E001`: Missing author
- `PROV_E002`: Invalid repository URL
- `PROV_W001`: Unverified author
- `PROV_W002`: Missing commit SHA

## Testing Strategy

### Unit Tests
```bash
npm test -- --testPathPatterns=validation
```

### Integration Tests
```bash
npm run test:integration -- validation
```

### Test Coverage
- Target: 90%+ for validators
- Mocking: GitHub API, Safe Browsing API
- Fixtures: Malicious and benign component examples

## Future Enhancements

### Phase 2
- [ ] LLM-based semantic analysis (lightweight model)
- [ ] Community reporting system
- [ ] Automated revocation mechanism
- [ ] Digital signatures with PGP/GPG

### Phase 3
- [ ] Real-time validation API endpoint
- [ ] Browser extension for component preview
- [ ] Trust score system (0-100)
- [ ] Historical vulnerability tracking

## Security Contact
For security concerns, please open an issue at:
https://github.com/danimesq/claude-code-templates/security
