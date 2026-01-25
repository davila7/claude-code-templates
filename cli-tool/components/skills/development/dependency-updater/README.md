# Dependency Updater

Smart dependency management for any programming language with automatic detection and safe updates.

## Purpose

The Dependency Updater skill provides intelligent, language-agnostic dependency management that:

- **Auto-detects your project type** by scanning for package files (package.json, go.mod, Cargo.toml, etc.)
- **Applies safe updates automatically** (minor and patch versions)
- **Prompts for major updates individually** to prevent breaking changes
- **Respects intentionally pinned versions** by skipping fixed dependencies
- **Runs security audits** to identify vulnerabilities
- **Diagnoses and fixes** common dependency issues

This skill eliminates the manual work of checking for outdated packages across different ecosystems while maintaining safety through semantic versioning awareness.

## When to Use

Use this skill when you want to:

| Scenario | Trigger Phrases |
|----------|-----------------|
| Update dependencies | "update dependencies", "update deps", "update my packages" |
| Check for outdated packages | "check for outdated packages", "what packages need updating" |
| Fix dependency problems | "fix my dependency problems", "resolve dependency conflicts" |
| Security audit | "audit dependencies for vulnerabilities", "check for security issues" |
| Diagnose issues | "diagnose dependency issues", "why won't my dependencies install" |

**Quick Start:**
```
update my dependencies
```

The skill will auto-detect your project type and handle everything.

## Supported Languages

| Language | Package File | Update Tool | Audit Tool |
|----------|--------------|-------------|------------|
| Node.js | package.json | `taze` | `npm audit` |
| Python | requirements.txt, pyproject.toml, Pipfile | `pip-review` | `safety`, `pip-audit` |
| Go | go.mod | `go get -u` | `govulncheck` |
| Rust | Cargo.toml | `cargo update` | `cargo audit` |
| Ruby | Gemfile | `bundle update` | `bundle audit` |
| Java | pom.xml, build.gradle | `mvn versions:*` | `mvn dependency-check:check` |
| .NET | *.csproj | `dotnet outdated` | `dotnet list package --vulnerable` |

## How It Works

The skill follows a systematic 7-step workflow:

```
1. DETECT PROJECT TYPE
   Scan for package files and identify the package manager

2. CHECK PREREQUISITES
   Verify required tools are installed, suggest installation if missing

3. SCAN FOR UPDATES
   Run language-specific outdated checks and categorize updates

4. AUTO-APPLY SAFE UPDATES
   Automatically apply MINOR and PATCH updates

5. PROMPT FOR MAJOR UPDATES
   Ask user about each MAJOR update individually (breaking changes)

6. APPLY APPROVED MAJORS
   Update only the packages the user approved

7. FINALIZE
   Run install command and security audit
```

### Update Classification

| Update Type | Version Change | Action |
|-------------|----------------|--------|
| **Fixed** | No `^` or `~` prefix | Skip (intentionally pinned) |
| **PATCH** | `1.2.3` to `1.2.4` | Auto-apply |
| **MINOR** | `1.2.3` to `1.3.0` | Auto-apply |
| **MAJOR** | `1.2.3` to `2.0.0` | Prompt user individually |

## Key Features

### Language-Agnostic Detection

The skill automatically identifies your project by scanning for common package files:

- `package.json` - Node.js (npm/yarn/pnpm)
- `requirements.txt` / `pyproject.toml` / `Pipfile` - Python
- `go.mod` - Go
- `Cargo.toml` - Rust
- `Gemfile` - Ruby
- `pom.xml` / `build.gradle` - Java/Kotlin
- `*.csproj` - .NET

### Safe-by-Default Updates

- Minor and patch updates are applied automatically (backward compatible)
- Major updates require explicit approval (may contain breaking changes)
- Fixed/pinned versions are never modified

### Security Auditing

Built-in security vulnerability scanning for each ecosystem:
- Identifies vulnerabilities by severity (Critical, High, Moderate, Low)
- Recommends appropriate response times based on severity
- Integrates with ecosystem-specific audit tools

### Dependency Diagnosis

Troubleshoots common issues:
- Version conflicts
- Peer dependency problems
- Security vulnerabilities
- Unused dependencies
- Duplicate packages

## Usage Examples

### Basic Update

```
update my dependencies
```

The skill will scan your project, apply safe updates, and prompt for major versions.

### Security-Focused Audit

```
audit my dependencies for security issues
```

Runs security scanners and reports vulnerabilities by severity.

### Diagnose Problems

```
my npm install keeps failing, diagnose the issue
```

Analyzes dependency tree, identifies conflicts, and suggests fixes.

### Node.js Specific

```bash
# Check prerequisites
scripts/check-tool.sh taze "npm install -g taze"

# Run taze directly
scripts/run-taze.sh

# Run in monorepo mode
scripts/run-taze.sh -r
```

## Prerequisites

### General Requirements

Each language ecosystem requires its standard package manager:
- Node.js: npm, yarn, or pnpm
- Python: pip
- Go: go modules
- Rust: cargo
- Ruby: bundler
- Java: Maven or Gradle
- .NET: dotnet CLI

### Recommended Tools

For the best experience, install these optional but recommended tools:

| Language | Tool | Install Command |
|----------|------|-----------------|
| Node.js | taze | `npm install -g taze` |
| Python | pip-review | `pip install pip-review` |
| Python | pip-audit | `pip install pip-audit` |
| Go | govulncheck | `go install golang.org/x/vuln/cmd/govulncheck@latest` |
| Rust | cargo-audit | `cargo install cargo-audit` |
| Ruby | bundler-audit | `gem install bundler-audit` |

## Output

### Update Summary

After running, you will see:
- List of auto-applied minor/patch updates
- Prompts for each major update decision
- Final package count and versions
- Security audit results

### Security Audit Results

Vulnerabilities are reported with severity levels:

| Severity | Recommended Response |
|----------|---------------------|
| Critical | Fix immediately |
| High | Fix within 24 hours |
| Moderate | Fix within 1 week |
| Low | Fix in next release |

## Best Practices

### Do

- **Commit lock files** - Always commit package-lock.json, yarn.lock, go.sum, etc.
- **Review major updates** - Check changelogs before approving major version bumps
- **Run tests after updates** - Verify your application still works
- **Address security issues promptly** - Prioritize by severity level
- **Use version ranges appropriately** - `^` for active libraries, `~` for stable ones, exact for critical dependencies

### Avoid

- **Don't auto-approve all majors** - Breaking changes require code modifications
- **Don't ignore security alerts** - Vulnerabilities can be exploited
- **Don't update fixed versions** - They were pinned for a reason
- **Don't skip the lock file** - It ensures reproducible builds

### Version Range Strategy

```json
{
  "dependencies": {
    "critical-lib": "1.2.3",      // Exact for critical dependencies
    "stable-lib": "~1.2.3",       // Patch only for stable libraries
    "modern-lib": "^1.2.3"        // Minor OK for actively maintained
  }
}
```

## Emergency Fixes

When dependencies are completely broken:

### Node.js - Nuclear Reset

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Python - Clean Virtual Environment

```bash
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Go - Reset Modules

```bash
rm go.sum
go mod tidy
```

## Verification Checklist

After running updates, verify:

- [ ] Updates scanned without errors
- [ ] Minor/patch updates auto-applied
- [ ] Major updates prompted individually
- [ ] Fixed versions remained untouched
- [ ] Lock file updated
- [ ] Install command succeeded
- [ ] Security audit passed (or issues noted)
- [ ] Tests pass
- [ ] Application runs correctly

## Related Tools

| Tool | Language | Purpose | Link |
|------|----------|---------|------|
| taze | Node.js | Smart dependency updates | [GitHub](https://github.com/antfu-collective/taze) |
| npm-check-updates | Node.js | Alternative to taze | [GitHub](https://github.com/raineorshine/npm-check-updates) |
| pip-review | Python | Interactive pip updates | [GitHub](https://github.com/jgonggrijp/pip-review) |
| cargo-edit | Rust | Cargo dependency management | [GitHub](https://github.com/killercup/cargo-edit) |
| bundler-audit | Ruby | Security auditing | [GitHub](https://github.com/rubysec/bundler-audit) |

## License

MIT
