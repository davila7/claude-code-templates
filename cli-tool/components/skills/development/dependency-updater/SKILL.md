---
name: dependency-updater
description: Smart dependency management for any language. Auto-detects project type, applies safe updates automatically, prompts for major versions, diagnoses and fixes dependency issues.
license: MIT
metadata:
  version: 1.0.0
---

# Dependency Updater

Smart dependency management for any language with automatic detection and safe updates.

---

## Quick Start

```
update my dependencies
```

The skill auto-detects your project type and handles the rest.

---

## Triggers

| Trigger | Example |
|---------|---------|
| Update dependencies | "update dependencies", "update deps" |
| Check outdated | "check for outdated packages" |
| Fix dependency issues | "fix my dependency problems" |
| Security audit | "audit dependencies for vulnerabilities" |
| Diagnose deps | "diagnose dependency issues" |

---

## Supported Languages

| Language | Package File | Update Tool | Audit Tool |
|----------|--------------|-------------|------------|
| **Node.js** | package.json | `taze` | `npm audit` |
| **Python** | requirements.txt, pyproject.toml | `pip-review` | `safety`, `pip-audit` |
| **Go** | go.mod | `go get -u` | `govulncheck` |
| **Rust** | Cargo.toml | `cargo update` | `cargo audit` |
| **Ruby** | Gemfile | `bundle update` | `bundle audit` |
| **Java** | pom.xml, build.gradle | `mvn versions:*` | `mvn dependency:*` |
| **.NET** | *.csproj | `dotnet outdated` | `dotnet list package --vulnerable` |

---

## Quick Reference

| Update Type | Version Change | Action |
|-------------|----------------|--------|
| **Fixed** | No `^` or `~` | Skip (intentionally pinned) |
| **PATCH** | `x.y.z` → `x.y.Z` | Auto-apply |
| **MINOR** | `x.y.z` → `x.Y.0` | Auto-apply |
| **MAJOR** | `x.y.z` → `X.0.0` | Prompt user individually |

---

## Workflow

```
User Request
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ Step 1: DETECT PROJECT TYPE                         │
│ • Scan for package files (package.json, go.mod...) │
│ • Identify package manager                          │
├─────────────────────────────────────────────────────┤
│ Step 2: CHECK PREREQUISITES                         │
│ • Verify required tools are installed               │
│ • Suggest installation if missing                   │
├─────────────────────────────────────────────────────┤
│ Step 3: SCAN FOR UPDATES                            │
│ • Run language-specific outdated check              │
│ • Categorize: MAJOR / MINOR / PATCH / Fixed         │
├─────────────────────────────────────────────────────┤
│ Step 4: AUTO-APPLY SAFE UPDATES                     │
│ • Apply MINOR and PATCH automatically               │
│ • Report what was updated                           │
├─────────────────────────────────────────────────────┤
│ Step 5: PROMPT FOR MAJOR UPDATES                    │
│ • AskUserQuestion for each MAJOR update             │
│ • Show current → new version                        │
├─────────────────────────────────────────────────────┤
│ Step 6: APPLY APPROVED MAJORS                       │
│ • Update only approved packages                     │
├─────────────────────────────────────────────────────┤
│ Step 7: FINALIZE                                    │
│ • Run install command                               │
│ • Run security audit                                │
└─────────────────────────────────────────────────────┘
```

---

## Commands by Language

### Node.js (npm/yarn/pnpm)

```bash
# Check prerequisites
scripts/check-tool.sh taze "npm install -g taze"

# Scan for updates
taze

# Apply minor/patch
taze minor --write

# Apply specific majors
taze major --write --include pkg1,pkg2

# Monorepo support
taze -r  # recursive

# Security
npm audit
npm audit fix
```

### Python

```bash
# Check outdated
pip list --outdated

# Update all (careful!)
pip-review --auto

# Update specific
pip install --upgrade package-name

# Security
pip-audit
safety check
```

### Go

```bash
# Check outdated
go list -m -u all

# Update all
go get -u ./...

# Tidy up
go mod tidy

# Security
govulncheck ./...
```

### Rust

```bash
# Check outdated
cargo outdated

# Update within semver
cargo update

# Security
cargo audit
```

### Ruby

```bash
# Check outdated
bundle outdated

# Update all
bundle update

# Update specific
bundle update --conservative gem-name

# Security
bundle audit
```

### Java (Maven)

```bash
# Check outdated
mvn versions:display-dependency-updates

# Update to latest
mvn versions:use-latest-releases

# Security
mvn dependency:tree
mvn dependency-check:check
```

### .NET

```bash
# Check outdated
dotnet list package --outdated

# Update specific
dotnet add package PackageName

# Security
dotnet list package --vulnerable
```

---

## Diagnosis Mode

When dependencies are broken, run diagnosis:

### Common Issues & Fixes

| Issue | Symptoms | Fix |
|-------|----------|-----|
| **Version Conflict** | "Cannot resolve dependency tree" | Clean install, use overrides/resolutions |
| **Peer Dependency** | "Peer dependency not satisfied" | Install required peer version |
| **Security Vuln** | `npm audit` shows issues | `npm audit fix` or manual update |
| **Unused Deps** | Bloated bundle | Run `depcheck` (Node) or equivalent |
| **Duplicate Deps** | Multiple versions installed | Run `npm dedupe` or equivalent |

### Emergency Fixes

```bash
# Node.js - Nuclear reset
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Python - Clean virtualenv
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Go - Reset modules
rm go.sum
go mod tidy
```

---

## Security Audit

Run security checks for any project:

```bash
# Node.js
npm audit
npm audit --json | jq '.metadata.vulnerabilities'

# Python
pip-audit
safety check

# Go
govulncheck ./...

# Rust
cargo audit

# Ruby
bundle audit

# .NET
dotnet list package --vulnerable
```

### Severity Response

| Severity | Action |
|----------|--------|
| **Critical** | Fix immediately |
| **High** | Fix within 24h |
| **Moderate** | Fix within 1 week |
| **Low** | Fix in next release |

---

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Update fixed versions | Intentionally pinned | Skip them |
| Auto-apply MAJOR | Breaking changes | Prompt user |
| Batch MAJOR prompts | Loses context | Prompt individually |
| Skip lock file | Irreproducible builds | Always commit lock files |
| Ignore security alerts | Vulnerabilities | Address by severity |

---

## Verification Checklist

After updates:

- [ ] Updates scanned without errors
- [ ] MINOR/PATCH auto-applied
- [ ] MAJOR updates prompted individually
- [ ] Fixed versions untouched
- [ ] Lock file updated
- [ ] Install command ran
- [ ] Security audit passed (or issues noted)

---

<details>
<summary><strong>Deep Dive: Project Detection</strong></summary>

The skill auto-detects project type by scanning for package files:

| File Found | Language | Package Manager |
|------------|----------|-----------------|
| `package.json` | Node.js | npm/yarn/pnpm |
| `requirements.txt` | Python | pip |
| `pyproject.toml` | Python | pip/poetry |
| `Pipfile` | Python | pipenv |
| `go.mod` | Go | go modules |
| `Cargo.toml` | Rust | cargo |
| `Gemfile` | Ruby | bundler |
| `pom.xml` | Java | Maven |
| `build.gradle` | Java/Kotlin | Gradle |
| `*.csproj` | .NET | dotnet |

**Detection order matters for monorepos:**
1. Check current directory first
2. Then check for workspace/monorepo patterns
3. Offer to run recursively if applicable

</details>

<details>
<summary><strong>Deep Dive: Node.js with taze</strong></summary>

### Prerequisites

```bash
# Install taze globally (recommended)
npm install -g taze

# Or use npx
npx taze
```

### Smart Update Flow

```bash
# 1. Scan all updates
taze

# 2. Apply safe updates (minor + patch)
taze minor --write

# 3. For each major, prompt user:
#    "Update @types/node from ^20.0.0 to ^22.0.0?"
#    If yes, add to approved list

# 4. Apply approved majors
taze major --write --include approved-pkg1,approved-pkg2

# 5. Install
npm install  # or pnpm install / yarn
```

### Auto-Approve List

Some packages have frequent major bumps but are backward-compatible:

| Package | Reason |
|---------|--------|
| `lucide-react` | Icon library, majors are additive |
| `@types/*` | Type definitions, usually safe |

</details>

<details>
<summary><strong>Deep Dive: Version Strategies</strong></summary>

### Semantic Versioning

```
MAJOR.MINOR.PATCH (e.g., 2.3.1)

MAJOR: Breaking changes - requires code changes
MINOR: New features - backward compatible
PATCH: Bug fixes - backward compatible
```

### Range Specifiers

| Specifier | Meaning | Example |
|-----------|---------|---------|
| `^1.2.3` | Minor + Patch OK | `>=1.2.3 <2.0.0` |
| `~1.2.3` | Patch only | `>=1.2.3 <1.3.0` |
| `1.2.3` | Exact (fixed) | Only `1.2.3` |
| `>=1.2.3` | At least | Any `>=1.2.3` |
| `*` | Any | Latest (dangerous) |

### Recommended Strategy

```json
{
  "dependencies": {
    "critical-lib": "1.2.3",      // Exact for critical
    "stable-lib": "~1.2.3",       // Patch only for stable
    "modern-lib": "^1.2.3"        // Minor OK for active
  }
}
```

</details>

<details>
<summary><strong>Deep Dive: Conflict Resolution</strong></summary>

### Node.js Conflicts

**Diagnosis:**
```bash
npm ls package-name      # See dependency tree
npm explain package-name # Why installed
yarn why package-name    # Yarn equivalent
```

**Resolution with overrides:**
```json
// package.json
{
  "overrides": {
    "lodash": "^4.18.0"
  }
}
```

**Resolution with resolutions (Yarn):**
```json
{
  "resolutions": {
    "lodash": "^4.18.0"
  }
}
```

### Python Conflicts

**Diagnosis:**
```bash
pip check
pipdeptree -p package-name
```

**Resolution:**
```bash
# Use virtual environment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Or use constraints
pip install -c constraints.txt -r requirements.txt
```

</details>

---

## Script Reference

| Script | Purpose |
|--------|---------|
| `scripts/check-tool.sh` | Verify tool is installed |
| `scripts/run-taze.sh` | Run taze with proper flags |

---

## Related Tools

| Tool | Language | Purpose |
|------|----------|---------|
| [taze](https://github.com/antfu-collective/taze) | Node.js | Smart dependency updates |
| [npm-check-updates](https://github.com/raineorshine/npm-check-updates) | Node.js | Alternative to taze |
| [pip-review](https://github.com/jgonggrijp/pip-review) | Python | Interactive pip updates |
| [cargo-edit](https://github.com/killercup/cargo-edit) | Rust | Cargo dependency management |
| [bundler-audit](https://github.com/rubysec/bundler-audit) | Ruby | Security auditing |
