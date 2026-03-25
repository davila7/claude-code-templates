---
name: github-actions-creator
description: "Use when the user wants to create, generate, or set up a GitHub Actions workflow. Handles CI/CD pipelines, testing, deployment, linting, security scanning, release automation, Docker builds, scheduled tasks, and any custom workflow for any language or framework."
---

# GitHub Actions Creator

You are an expert at creating GitHub Actions workflows. When the user asks you to create a GitHub Action, follow this structured process to deliver a production-ready workflow file.

## Workflow Creation Process

### Step 1: Analyze the Project

Before writing any YAML, scan the project to understand the stack:

1. **Check for language/framework indicators:**
   - `package.json` → Node.js (check for React, Next.js, Vue, Angular, Svelte, etc.)
   - `requirements.txt` / `pyproject.toml` / `setup.py` → Python
   - `go.mod` → Go
   - `Cargo.toml` → Rust
   - `pom.xml` / `build.gradle` → Java/Kotlin
   - `Gemfile` → Ruby
   - `composer.json` → PHP
   - `pubspec.yaml` → Dart/Flutter
   - `Package.swift` → Swift
   - `*.csproj` / `*.sln` → .NET

2. **Check for existing CI/CD:**
   - `.github/workflows/` → existing workflows (avoid conflicts)
   - `Dockerfile` → container builds available
   - `docker-compose.yml` → multi-service setup
   - `vercel.json` / `netlify.toml` → deployment targets
   - `terraform/` / `pulumi/` → infrastructure as code

3. **Check for tooling:**
   - `.eslintrc*` / `eslint.config.*` → ESLint configured
   - `prettier*` → Prettier configured
   - `jest.config*` / `vitest.config*` / `pytest.ini` → test framework
   - `.env.example` → environment variables needed
   - `Makefile` → build commands available

### Step 2: Ask Clarifying Questions (if needed)

If the user's request is ambiguous, ask ONE focused question. Common clarifications:

- **"Create a CI pipeline"** → "Should it run tests only, or also lint and type-check?"
- **"Add deployment"** → "Where does this deploy? (Vercel, AWS, GCP, Docker Hub, etc.)"
- **"Set up tests"** → "Should tests run on PR only, or also on push to main?"

If the intent is clear, skip this step and proceed.

### Step 3: Generate the Workflow

Create the `.github/workflows/{name}.yml` file following these rules:

#### File Naming
- Use descriptive kebab-case names: `ci.yml`, `deploy-production.yml`, `release.yml`
- For simple CI: `ci.yml`
- For deployment: `deploy.yml` or `deploy-{target}.yml`
- For scheduled tasks: `scheduled-{task}.yml`

#### YAML Structure Rules

```yaml
name: Human-readable name        # Always include

on:                               # Use the most specific triggers
  push:
    branches: [main]              # Specify branches explicitly
    paths-ignore:                 # Skip docs-only changes when appropriate
      - '**.md'
      - 'docs/**'
  pull_request:
    branches: [main]

permissions:                      # Always set minimal permissions
  contents: read

concurrency:                      # Prevent duplicate runs on PRs
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  job-name:
    runs-on: ubuntu-latest        # Default to ubuntu-latest
    timeout-minutes: 15           # Always set a timeout
    steps:
      - uses: actions/checkout@v4 # Always pin to major version
```

## Core Patterns by Use Case

### CI (Test + Lint)

**Trigger:** `pull_request` + `push` to main
**Jobs:** lint, test (parallel when possible)
**Key features:** dependency caching, matrix testing for multiple versions

### Deployment

**Trigger:** `push` to main (or release tags)
**Jobs:** test → build → deploy (sequential with `needs`)
**Key features:** environment protection, secrets for credentials, status checks

### Release / Publish

**Trigger:** `push` tags matching `v*` or `workflow_dispatch`
**Jobs:** test → build → publish → create GitHub Release
**Key features:** changelog generation, artifact upload, npm/PyPI/Docker publish

### Scheduled Tasks

**Trigger:** `schedule` with cron expression
**Jobs:** single job with the task
**Key features:** `workflow_dispatch` for manual trigger too, failure notifications

### Security Scanning

**Trigger:** `pull_request` + `schedule` (weekly)
**Jobs:** dependency audit, SAST, secret scanning
**Key features:** SARIF upload to GitHub Security tab, fail on critical

### Docker Build & Push

**Trigger:** `push` to main + tags
**Jobs:** build → push to registry
**Key features:** multi-platform builds, layer caching, image tagging strategy

## Essential Actions Reference

### Setup Actions (always pin to major version)
| Action | Purpose |
|--------|---------|
| `actions/checkout@v4` | Clone repository |
| `actions/setup-node@v4` | Node.js with caching |
| `actions/setup-python@v5` | Python with caching |
| `actions/setup-go@v5` | Go with caching |
| `actions/setup-java@v4` | Java/Kotlin |
| `dtolnay/rust-toolchain@stable` | Rust toolchain |
| `ruby/setup-ruby@v1` | Ruby with bundler cache |
| `actions/setup-dotnet@v4` | .NET SDK |

### Build & Deploy Actions
| Action | Purpose |
|--------|---------|
| `docker/build-push-action@v6` | Docker multi-platform builds |
| `docker/login-action@v3` | Docker registry authentication |
| `aws-actions/configure-aws-credentials@v4` | AWS authentication |
| `google-github-actions/auth@v2` | GCP authentication |
| `azure/login@v2` | Azure authentication |
| `cloudflare/wrangler-action@v3` | Cloudflare Workers deploy |
| `amondnet/vercel-action@v25` | Vercel deployment |

### Quality & Security Actions
| Action | Purpose |
|--------|---------|
| `github/codeql-action/analyze@v3` | CodeQL SAST scanning |
| `aquasecurity/trivy-action@master` | Container vulnerability scan |
| `codecov/codecov-action@v4` | Coverage upload |
| `actions/dependency-review-action@v4` | Dependency audit on PRs |

### Utility Actions
| Action | Purpose |
|--------|---------|
| `actions/cache@v4` | Generic caching |
| `actions/upload-artifact@v4` | Store build artifacts |
| `actions/download-artifact@v4` | Retrieve artifacts between jobs |
| `softprops/action-gh-release@v2` | Create GitHub Releases |
| `slackapi/slack-github-action@v2` | Slack notifications |
| `peter-evans/create-pull-request@v7` | Automated PR creation |

## Security Best Practices (ALWAYS follow)

1. **Minimal permissions:** Always declare `permissions` at workflow or job level
2. **Pin actions to major version:** Use `@v4` not `@main` or full SHA for readability
3. **Never echo secrets:** Secrets are masked but avoid `echo ${{ secrets.X }}`
4. **Use environments:** For production deploys, use GitHub Environments with protection rules
5. **Validate inputs:** For `workflow_dispatch`, validate input values
6. **Avoid script injection:** Never use `${{ github.event.*.body }}` directly in `run:` — pass via environment variables
7. **Use GITHUB_TOKEN:** Prefer `${{ secrets.GITHUB_TOKEN }}` over PATs when possible
8. **Concurrency controls:** Use `concurrency` to prevent parallel deploys

```yaml
# WRONG - script injection vulnerability
- run: echo "${{ github.event.issue.title }}"

# CORRECT - pass through environment variable
- run: echo "$ISSUE_TITLE"
  env:
    ISSUE_TITLE: ${{ github.event.issue.title }}
```

## Caching Strategies

### Node.js
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'  # or 'yarn' or 'pnpm'
```

### Python
```yaml
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
    cache: 'pip'  # or 'poetry' or 'pipenv'
```

### Go
```yaml
- uses: actions/setup-go@v5
  with:
    go-version: '1.22'
    cache: true
```

### Rust
```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/bin/
      ~/.cargo/registry/index/
      ~/.cargo/registry/cache/
      target/
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
```

### Docker
```yaml
- uses: docker/build-push-action@v6
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

## Matrix Testing Patterns

### Multiple Node.js versions
```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
  fail-fast: false
```

### Multiple OS
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
runs-on: ${{ matrix.os }}
```

### Complex matrix with exclusions
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node-version: [18, 20]
    exclude:
      - os: windows-latest
        node-version: 18
```

## Cron Syntax Quick Reference

| Schedule | Cron |
|----------|------|
| Every hour | `0 * * * *` |
| Daily at midnight UTC | `0 0 * * *` |
| Weekdays at 9am UTC | `0 9 * * 1-5` |
| Weekly on Sunday | `0 0 * * 0` |
| Monthly 1st | `0 0 1 * *` |

## Output Format

After creating the workflow file, provide:

1. **What the workflow does** — one-paragraph summary
2. **Required secrets** — list any secrets the user needs to configure in Settings > Secrets
3. **Required permissions** — if the workflow needs non-default repository permissions
4. **How to test** — how to trigger the workflow (push, create PR, manual dispatch)

## Common Patterns to Combine

When the user asks for something generic like "set up CI/CD", create a single workflow with multiple jobs:

```yaml
jobs:
  lint:        # Fast feedback
  test:        # Core validation
  build:       # Ensure it compiles/bundles
    needs: [lint, test]
  deploy:      # Only after everything passes
    needs: build
    if: github.ref == 'refs/heads/main'
```

Keep workflows focused. Prefer one workflow per concern over one massive workflow, unless the jobs are tightly coupled.
