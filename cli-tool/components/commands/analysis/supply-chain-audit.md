# /supply-chain-audit

Audit a project for software supply chain risk, including dependency vulnerabilities, lockfile issues, malicious package indicators, SBOM coverage, and license concerns.

## Purpose

Use this command to perform a focused supply chain security review of a codebase. It helps identify dependency-related risk across JavaScript, Python, Go, Rust, Java, Ruby, and container-based projects.

The command reviews both direct and transitive dependencies, highlights the most important findings first, and recommends exact remediation steps where possible.

## Usage

/supply-chain-audit
/supply-chain-audit npm
/supply-chain-audit python
/supply-chain-audit docker
/supply-chain-audit ./services/api
/supply-chain-audit --report
/supply-chain-audit --sbom
/supply-chain-audit --licenses

## Implementation

When this command runs, Claude should:

1. Detect the ecosystem by checking for package.json, requirements.txt, go.mod, Cargo.toml, pom.xml, Gemfile, or Dockerfile.

2. Inventory all dependencies: direct, transitive, dev, build-time, and base images.

3. Evaluate supply chain risk across:
- Known CVEs and advisories
- Unpinned or floating versions
- Missing or stale lockfiles
- Install scripts that execute code
- Typosquatting and suspicious naming
- Dependency confusion vectors
- Missing SBOM workflow
- License incompatibilities
- Weak CI/CD provenance

4. Present findings using severity tiers:
- CRITICAL
- HIGH
- MEDIUM
- LOW

5. For every finding include: what was detected, why it matters, how to verify it, and the exact remediation command.

6. Tailor remediation to the ecosystem:
- npm: npm audit, lockfile checks, .npmrc scoping, --save-exact
- Python: pip-audit, cyclonedx-py, lockfile verification
- Go: govulncheck, go mod verify
- Rust: cargo audit, cargo deny
- Java: dependency-check, Snyk, OWASP plugin
- Ruby: bundler-audit
- Docker: Syft, Grype, Trivy, digest pinning

7. End with an action plan: Fix now / Fix this sprint / Monitor / Nice to have

## Examples

User: /supply-chain-audit
Claude detects the package manager, checks lockfiles, flags floating versions, scans install hooks, and produces a ranked report with remediation commands.

User: /supply-chain-audit --sbom
Claude checks whether an SBOM exists and recommends syft or cdxgen to generate one in CycloneDX or SPDX format, then explains how to attach it to CI artifacts.

User: /supply-chain-audit ./services/api
Claude scopes the analysis to that directory, detects the local package manager, and produces findings only for that service.
