---
name: supply-chain-guard
description: "Detect and remediate software supply chain attacks in npm, PyPI, crates.io, GitHub Actions, and CI/CD pipelines by scanning for known compromised packages, malicious versions, filesystem IOCs, C2 indicators, and CI/CD misconfigurations."
metadata:
  author: dan-avila
  version: '1.0'
  ioc-db-date: '2026-03-31'
---

# Supply Chain Guard

Automated detection and remediation of software supply chain attacks across npm, PyPI, crates.io, GitHub Actions, and CI/CD pipelines. Built from real-world attack intelligence gathered through March 31, 2026.

## When to Use This Skill

Use this skill when:

- The user asks to audit a project's dependencies for security issues
- Before deploying code to production
- When investigating a potential supply chain compromise
- When the user mentions a recent supply chain attack and wants to check their projects
- As a regular security check in development workflows
- When setting up CI/CD pipelines and wanting to harden them
- When a new supply chain attack is reported and the user wants to verify exposure

## Instructions

### Step 1: Understand the Project

Identify what the user's project uses:
- **Node.js/npm**: Look for `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- **Python/PyPI**: Look for `requirements.txt`, `Pipfile`, `pyproject.toml`, `poetry.lock`
- **Rust/crates.io**: Look for `Cargo.toml`, `Cargo.lock`
- **CI/CD**: Look for `.github/workflows/`, `Dockerfile`, `docker-compose.yml`

### Step 2: Run the Appropriate Scanners

The skill includes three specialized scanners plus a unified runner. All scripts are in the `scripts/` directory.

**Full audit (recommended):**
```bash
bash /path/to/supply-chain-guard/scripts/scan-all.sh /path/to/project
```

**Individual scanners:**
```bash
# npm/Node.js projects
bash /path/to/supply-chain-guard/scripts/scan-npm.sh /path/to/project

# Python/PyPI projects
bash /path/to/supply-chain-guard/scripts/scan-python.sh /path/to/project

# CI/CD pipeline audit
bash /path/to/supply-chain-guard/scripts/scan-ci.sh /path/to/project
```

Each scanner checks for:
1. **Known compromised packages** — exact matches against the IOC database
2. **Malicious versions** — specific version numbers known to contain malware
3. **Filesystem IOCs** — persistence mechanisms left by attackers
4. **Network IOCs** — C2 domains and IPs in source code
5. **CI/CD misconfigurations** — unpinned actions, dangerous triggers, exposed secrets
6. **Credential exposure** — npm tokens, PyPI credentials, .env files

### Step 3: Interpret Results

Scanners exit with the number of issues found (0 = clean). Issues are categorized:

- **[CRITICAL]** — Known malicious package or active IOC detected. Immediate action required.
- **[WARNING]** — Security concern that needs investigation. May not be an active compromise.

### Step 4: Remediate

Based on findings, guide the user through remediation:

#### If a compromised package is found:
1. Remove or downgrade to a known safe version immediately
2. Clear package caches: `npm cache clean --force` / `pip cache purge`
3. Delete `node_modules` / `.venv` and reinstall from lockfile
4. Rotate ALL credentials that were accessible from the environment

#### If filesystem IOCs are found:
1. The system should be treated as **fully compromised**
2. Identify and remove persistence mechanisms (systemd services, .pth files, cron jobs)
3. Rotate every credential on the system
4. Audit cloud provider logs (AWS CloudTrail, GCP Audit Logs, Azure Activity Log)
5. Check for lateral movement in Kubernetes clusters
6. Consider reimaging the machine

#### If CI/CD issues are found:
1. Pin all GitHub Actions to full commit SHAs (not version tags)
2. Add `--ignore-scripts` to npm install/ci commands
3. Add `--require-hashes` to pip install commands
4. Remove or secure `pull_request_target` triggers
5. Apply least-privilege permissions to workflow tokens
6. Audit pipeline execution logs for the attack window periods

### Step 5: Harden the Project

After remediation, recommend these preventive measures:

1. **Lock everything**: Exact version pins + lockfiles committed to repo
2. **Hash-verify**: Use `npm ci` (not `npm install`), `pip install --require-hashes`
3. **Disable scripts**: Use `--ignore-scripts` by default, enable only for trusted packages
4. **Pin actions**: All GitHub Actions pinned to full SHA, never tags
5. **Scope tokens**: CI/CD tokens should have minimal permissions
6. **Monitor**: Set up automated dependency scanning (but verify the scanner itself is not compromised — see Trivy incident)
7. **Network controls**: Block known C2 domains/IPs at firewall level
8. **Audit regularly**: Run this scanner before every deployment

## Reference Files

- `references/ioc-database.md` — Full IOC database with all compromised packages, malicious versions, C2 infrastructure, filesystem indicators, and attack timelines. Read this file for detailed intelligence on specific attacks.

## Current Threat Landscape (as of 2026-03-31)

### Active Campaign: TeamPCP (CRITICAL)

The most significant active threat. TeamPCP is executing a cascading credential-chain campaign:
- Compromised Trivy (security scanner) → stole CI/CD secrets from thousands of pipelines
- Used stolen npm tokens to deploy CanisterWorm across 141+ npm packages
- Used stolen PyPI tokens to backdoor LiteLLM (95M monthly downloads) and Telnyx
- Uses blockchain (ICP) for C2, making takedown impossible
- Deploys WAV steganography for payload delivery
- Targets Kubernetes for lateral movement
- Has a destructive variant that wipes Iranian systems

### Active: axios npm Hijack (2026-03-31)

- axios@1.14.1 and axios@0.30.4 contain RAT dropper via fake `plain-crypto-js` dependency
- 300M+ weekly downloads makes this extremely high-impact
- Cross-platform RAT for macOS, Windows, and Linux
- Compromised maintainer account (jasonsaayman)

### Recent: Malicious Rust Crates (2026-02/03)

- 5 crates impersonating time utilities on crates.io
- Steal .env files, AWS credentials, SSH keys
- First significant supply chain attack targeting Rust ecosystem

### Historical but Relevant: Shai-Hulud Worm

- Self-replicating npm worm that compromised ~1000 packages
- Targets npm tokens for self-propagation
- Destructive fallback: wipes home directory if exfiltration fails

## Updating the IOC Database

When new supply chain attacks are reported:

1. Search for the latest advisories from Socket, Aikido, Endor Labs, Snyk, JFrog
2. Update `references/ioc-database.md` with new packages, versions, domains, IPs
3. Update the scanner scripts with new package entries in the MALICIOUS_* arrays
4. Update the `ioc-db-date` in the SKILL.md frontmatter
