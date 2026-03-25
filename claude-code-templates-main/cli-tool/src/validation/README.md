# Security Validation System

Comprehensive security validation for Claude Code Templates components based on industry standards (npm 2025, PyPI, GitHub Package Registry, SLSA Framework).

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Validation Tiers](#validation-tiers)
- [CLI Usage](#cli-usage)
- [CI/CD Integration](#cicd-integration)
- [Architecture](#architecture)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Security Validation System ensures that all components in the repository are safe, trustworthy, and meet quality standards before distribution. It validates components across 5 tiers:

1. **Structural Validation** - YAML frontmatter, file format, encoding
2. **Integrity Validation** - SHA256 hashing, tamper detection
3. **Semantic Validation** - Prompt injection, jailbreaks, malicious patterns
4. **Reference Validation** - URLs, external links, SSRF prevention
5. **Provenance Validation** - Author metadata, repository info, Git history

### Key Features

- ✅ **372+ components validated** - Agents, commands, settings, hooks
- 🔒 **10+ security patterns detected** - Jailbreaks, prompt injection, XSS
- 📊 **Trust scoring (0-100)** - Overall security score per component
- 🔗 **Hash tracking** - SHA256 hashes for tamper detection
- ⚡ **Fast validation** - Completes in ~20 seconds for 372 components
- 🤖 **GitHub Actions integration** - Automatic PR validation

## Quick Start

### Run Security Audit Locally

```bash
# From repository root
cd cli-tool
npm run security-audit

# With verbose output
npm run security-audit:verbose

# Generate JSON report
npm run security-audit:json
```

### Example Output

```
🔒 Claude Code Templates - Security Audit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Scanning components directory...
   Found 372 components

🔍 Running security validation...

📊 Validation Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Total components: 372
   ✅ Passed: 123
   ❌ Failed: 249
   ⚠️  Warnings: 938
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Validation Tiers

### 1. Structural Validation

Validates component structure, format, and metadata.

**Checks:**
- ✅ Valid YAML frontmatter
- ✅ Required fields present (name, description, tools)
- ✅ File size limits (< 100KB)
- ✅ UTF-8 encoding
- ✅ Valid tool names (Read, Write, Edit, Bash, Glob, Grep, *)
- ✅ Valid model names (sonnet, opus, haiku)
- ✅ Section count (< 20 sections)

**Error Codes:** `STRUCT_E001` - `STRUCT_E010`
**Warning Codes:** `STRUCT_W001` - `STRUCT_W011`

### 2. Integrity Validation

Ensures components haven't been tampered with.

**Checks:**
- ✅ Generate SHA256 hash
- ✅ Track hash in registry (`.claude/security/component-hashes.json`)
- ✅ Detect content changes
- ✅ Validate semantic versioning

**Error Codes:** `INT_E001` - `INT_E003`
**Info Codes:** `INT_I001` - `INT_I005`

### 3. Semantic Validation

Detects malicious content and prompt injection attempts.

**Dangerous Patterns Detected:**

- 🚫 **Prompt Injection:**
  - "ignore previous instructions"
  - "ignore all previous instructions"
  - "disregard all prior directives"

- 🚫 **Jailbreaks:**
  - "you are now a..."
  - "system prompt"
  - "developer instructions"

- 🚫 **Code Execution:**
  - "execute the following code"
  - "run this command"

- 🚫 **Credential Harvesting:**
  - "fetch...token/key/password"
  - Hardcoded API keys, passwords

- 🚫 **XSS & Injection:**
  - `<script>`, `<iframe>`
  - `javascript:`, `data:`
  - Event handlers (onclick, onerror)

- 🚫 **Dangerous Commands:**
  - `rm -rf /`
  - Fork bombs: `:(){ :|:& };:`
  - `dd if=/dev/zero of=/dev/sda`

**Error Codes:** `SEM_E001` - `SEM_E008`
**Warning Codes:** `SEM_W001` - `SEM_W004`

### 4. Reference Validation

Validates external URLs and prevents SSRF attacks.

**Checks:**
- ✅ Extract all URLs from markdown
- ✅ Block dangerous protocols (file://, javascript:, data:)
- ✅ Detect private IP addresses (127.0.0.1, 10.x.x.x, 192.168.x.x)
- ✅ Flag suspicious TLDs (.tk, .ml, .ga, .zip)
- ✅ HTTPS enforcement (optional strict mode)

**Error Codes:** `REF_E001` - `REF_E005`
**Warning Codes:** `REF_W001` - `REF_W003`

### 5. Provenance Validation

Validates component authorship and origin.

**Checks:**
- ✅ Author metadata in frontmatter
- ✅ Repository information
- ✅ Version tracking
- ✅ Git commit SHA, author, date
- ✅ Repository platform validation (github.com, gitlab.com)

**Error Codes:** `PROV_E001` - `PROV_E003`
**Warning Codes:** `PROV_W001` - `PROV_W003`

## CLI Usage

### Basic Commands

```bash
# Run validation on all components
npm run security-audit

# Verbose output with detailed errors
npm run security-audit:verbose

# Generate JSON report
npm run security-audit:json

# CI mode (fails on errors)
npm run security-audit:ci
```

### Direct Execution

```bash
# From cli-tool directory
node src/security-audit.js [options]

# Options:
#   --ci              Exit with code 1 on errors (for CI/CD)
#   --verbose, -v     Show detailed validation results
#   --json            Output results as JSON
#   --output=FILE     Save JSON report to file
```

### Examples

```bash
# Local development - show all details
npm run security-audit:verbose

# Generate report for review
npm run security-audit:json > my-report.json

# CI/CD pipeline - fail on errors
npm run security-audit:ci
```

## CI/CD Integration

### GitHub Actions Workflow

The repository includes a GitHub Actions workflow that automatically validates components on:
- ✅ Pull requests modifying components
- ✅ Pushes to main branch

**File:** `.github/workflows/component-security-validation.yml`

```yaml
name: Component Security Validation

on:
  pull_request:
    paths:
      - 'cli-tool/components/**'
  push:
    branches:
      - main
    paths:
      - 'cli-tool/components/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: cli-tool
        run: npm install

      - name: Run security validation
        working-directory: cli-tool
        run: npm run security-audit:ci

      - name: Upload security report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: security-report
          path: cli-tool/security-report.json
          retention-days: 30
```

### PR Comment Bot

The workflow automatically posts validation results as PR comments:

```markdown
## 🔒 Security Validation Results

**Status:** ❌ Failed

### Summary
- Total Components: 15
- Passed: 12
- Failed: 3
- Warnings: 8

### Failed Components
1. agents/security/penetration-tester.md
   - Error: Dangerous command detected: `rm -rf /tmp`
   - Score: 50/100

[View Full Report](artifacts/security-report.json)
```

## Architecture

### Module Structure

```
cli-tool/src/validation/
├── ARCHITECTURE.md          # Detailed architecture documentation
├── README.md                # This file
├── BaseValidator.js         # Abstract base class for validators
├── ValidationOrchestrator.js # Coordinates all validators
└── validators/
    ├── StructuralValidator.js
    ├── IntegrityValidator.js
    ├── SemanticValidator.js
    ├── ReferenceValidator.js
    └── ProvenanceValidator.js
```

### Validator Lifecycle

```
1. Component Scanning
   ↓
2. Content Reading
   ↓
3. Parallel Validation
   ├── StructuralValidator
   ├── IntegrityValidator
   ├── SemanticValidator
   ├── ReferenceValidator
   └── ProvenanceValidator
   ↓
4. Result Aggregation
   ↓
5. Report Generation
```

### Scoring Algorithm

```javascript
componentScore = (
  structuralScore * 0.25 +
  integrityScore * 0.20 +
  semanticScore * 0.30 +
  referencesScore * 0.15 +
  provenanceScore * 0.10
)

validatorScore = max(0, 100 - (errors * 25) - (warnings * 5))
```

## Error Codes

### Structural (STRUCT_*)

| Code | Type | Message |
|------|------|---------|
| `STRUCT_E001` | Error | No YAML frontmatter found |
| `STRUCT_E002` | Error | Invalid YAML syntax |
| `STRUCT_E003` | Error | Missing required field: {field} |
| `STRUCT_E004` | Error | File too large (> 100KB) |
| `STRUCT_E010` | Error | Invalid UTF-8 encoding |
| `STRUCT_W006` | Warning | Unknown tools specified |
| `STRUCT_W011` | Warning | Too many sections (>20) |

### Integrity (INT_*)

| Code | Type | Message |
|------|------|---------|
| `INT_E001` | Error | Content changed since last validation |
| `INT_E002` | Error | Invalid semantic version format |
| `INT_I001` | Info | Generated SHA256 hash |
| `INT_I005` | Info | Component not in registry (new) |

### Semantic (SEM_*)

| Code | Type | Message |
|------|------|---------|
| `SEM_E001` | Error | Prompt injection detected: {pattern} |
| `SEM_E002` | Error | Jailbreak attempt detected: {pattern} |
| `SEM_E003` | Error | Code execution pattern detected |
| `SEM_E004` | Error | Credential harvesting detected |
| `SEM_E005` | Error | HTML injection detected: {tag} |
| `SEM_E006` | Error | Hardcoded credentials detected |
| `SEM_E007` | Error | Dangerous command detected: {command} |

### References (REF_*)

| Code | Type | Message |
|------|------|---------|
| `REF_E001` | Error | Dangerous protocol: {protocol} |
| `REF_E002` | Error | Private IP address detected |
| `REF_E003` | Error | SSRF attempt via private network |
| `REF_W001` | Warning | Suspicious TLD: {tld} |
| `REF_W002` | Warning | HTTP URL (should use HTTPS) |

### Provenance (PROV_*)

| Code | Type | Message |
|------|------|---------|
| `PROV_E001` | Error | Missing author information |
| `PROV_W001` | Warning | No repository information |
| `PROV_W002` | Warning | No version specified |

## Best Practices

### For Component Authors

1. **Include Complete Frontmatter:**
   ```yaml
   ---
   name: my-agent
   description: Clear description
   author: Your Name
   version: 1.0.0
   repository: https://github.com/user/repo
   tools:
     - Read
     - Write
   model: sonnet
   ---
   ```

2. **Avoid Dangerous Patterns:**
   - Don't include executable shell commands
   - No hardcoded credentials or API keys
   - Avoid instructing Claude to ignore security rules
   - Use HTTPS URLs only

3. **Keep Components Concise:**
   - File size < 50KB (max 100KB)
   - Sections < 15 (max 20)
   - Clear, focused instructions

4. **Test Before Submitting:**
   ```bash
   npm run security-audit:verbose
   ```

### For Repository Maintainers

1. **Review PR Validation Results:**
   - Check GitHub Actions status
   - Review security scores
   - Investigate failed components

2. **Monitor Hash Changes:**
   - Unexpected hash changes indicate tampering
   - Review `.claude/security/component-hashes.json`

3. **Update Validation Rules:**
   - Add new dangerous patterns to SemanticValidator
   - Adjust scoring thresholds if needed
   - Keep validators up to date

4. **Regular Audits:**
   ```bash
   npm run security-audit:json
   # Review security-report.json
   ```

## Integration with Component Generation

The security validation system integrates with `scripts/generate_components_json.py`:

1. **Automatic Validation** - Runs before generating components.json
2. **Metadata Inclusion** - Security scores, hashes, validation status
3. **Download Statistics** - Combined with Supabase analytics

**Generated metadata:**
```json
{
  "name": "frontend-developer",
  "security": {
    "validated": true,
    "valid": true,
    "score": 96,
    "errorCount": 0,
    "warningCount": 2,
    "lastValidated": "2025-10-15T20:07:37.583Z",
    "hash": "eb5f9f4978b71ba06f129c73f5573a58...",
    "validators": {
      "structural": true,
      "integrity": true,
      "semantic": true,
      "references": true,
      "provenance": true
    }
  }
}
```

## Troubleshooting

### Common Issues

**Issue:** Components directory not found
```bash
# Solution: Run from correct directory
cd cli-tool
npm run security-audit
```

**Issue:** Hash registry conflicts
```bash
# Solution: Clear and regenerate
rm -rf .claude/security/component-hashes.json
npm run security-audit
```

**Issue:** False positives in semantic validation
```bash
# Solution: Review SemanticValidator.js patterns
# Adjust regex patterns if needed
```

### Performance Optimization

- Validation of 372 components: ~20 seconds
- Parallel validation with async/await
- Cached hash registry for faster checks
- JSON report generation optimized

## Contributing

### Adding New Validators

1. Extend `BaseValidator` class
2. Implement `validate(component)` method
3. Add to `ValidationOrchestrator`
4. Write comprehensive tests

```javascript
class CustomValidator extends BaseValidator {
  async validate(component) {
    // Your validation logic
    if (issue) {
      this.addError('CUSTOM_E001', 'Description', metadata);
    }
    return this.getResults();
  }
}
```

### Updating Error Codes

1. Document in `ARCHITECTURE.md`
2. Add to error code tables above
3. Include in test coverage
4. Update this README

## Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture
- [SLSA Framework](https://slsa.dev/) - Supply chain security
- [npm 2025 Security](https://docs.npmjs.com/security) - Package security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Security risks

## License

MIT - See repository LICENSE file
