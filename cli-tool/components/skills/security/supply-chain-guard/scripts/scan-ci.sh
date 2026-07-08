#!/usr/bin/env bash
# supply-chain-guard: CI/CD Pipeline Security Scanner
# Audits GitHub Actions, Docker configurations, and CI/CD security posture
# Usage: bash scan-ci.sh [project_dir]
# Compatible with bash 3.2+ (macOS default)

set -eo pipefail

PROJECT_DIR="${1:-.}"
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'
FOUND_ISSUES=0

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  supply-chain-guard — CI/CD Pipeline Security Scanner   ║${NC}"
echo -e "${CYAN}║  IOC Database: 2026-03-31                               ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

alert() {
  echo -e "${RED}[CRITICAL]${NC} $1"
  FOUND_ISSUES=$((FOUND_ISSUES + 1))
}

warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
  FOUND_ISSUES=$((FOUND_ISSUES + 1))
}

info() {
  echo -e "${GREEN}[OK]${NC} $1"
}

# ============================================================
# PHASE 1: GitHub Actions Security Audit
# ============================================================
echo -e "${CYAN}── Phase 1: GitHub Actions Audit ──${NC}"

WORKFLOW_DIR="$PROJECT_DIR/.github/workflows"
if [[ -d "$WORKFLOW_DIR" ]]; then
  TOTAL_WORKFLOWS=0
  UNPINNED_COUNT=0
  PULL_REQUEST_TARGET=0

  # Compromised actions: "action_path|description"
  COMPROMISED_ACTIONS=(
    "aquasecurity/trivy-action|Tag-poisoned by TeamPCP Mar 19, 2026"
    "aquasecurity/setup-trivy|Tag-poisoned by TeamPCP Mar 19, 2026"
    "Checkmarx/kics-github-action|Tag-poisoned by TeamPCP Mar 23, 2026"
    "Checkmarx/ast-github-action|v2.3.28 compromised Mar 23, 2026"
    "tj-actions/changed-files|All tags modified (CVE-2025-30066)"
    "reviewdog/action-setup|Compromised, led to tj-actions attack"
  )

  for yml in "$WORKFLOW_DIR"/*.yml "$WORKFLOW_DIR"/*.yaml; do
    [[ -f "$yml" ]] || continue
    TOTAL_WORKFLOWS=$((TOTAL_WORKFLOWS + 1))
    BASENAME=$(basename "$yml")

    # --- Check for known compromised actions ---
    for entry in "${COMPROMISED_ACTIONS[@]}"; do
      action="${entry%%|*}"
      desc="${entry#*|}"
      if grep -q "$action" "$yml" 2>/dev/null; then
        if grep "$action" "$yml" | grep -qE "@[a-f0-9]{40}"; then
          warn "$BASENAME: Uses $action (SHA-pinned). Verify SHA is from after remediation. $desc"
        else
          alert "$BASENAME: Uses $action WITHOUT SHA pinning. $desc"
        fi
      fi
    done

    # --- Check for actions not pinned to SHA ---
    UNPINNED_LINES=$(grep -nE "uses:.*@(v[0-9]|latest|main|master|develop)" "$yml" 2>/dev/null || true)
    if [[ -n "$UNPINNED_LINES" ]]; then
      UNPINNED_IN_FILE=$(echo "$UNPINNED_LINES" | wc -l | tr -d ' ')
      UNPINNED_COUNT=$((UNPINNED_COUNT + UNPINNED_IN_FILE))
      warn "$BASENAME: $UNPINNED_IN_FILE action(s) pinned to mutable tags instead of commit SHAs."
      echo "$UNPINNED_LINES" | head -5 | while read -r line; do echo "    $line"; done
    fi

    # --- Check for pull_request_target ---
    if grep -q "pull_request_target" "$yml" 2>/dev/null; then
      PULL_REQUEST_TARGET=$((PULL_REQUEST_TARGET + 1))
      warn "$BASENAME: Uses pull_request_target trigger — high-risk attack vector. Ensure checkout is from base, not PR head."
      if grep -A5 "pull_request_target" "$yml" | grep -q "ref.*head\|github.event.pull_request.head" 2>/dev/null; then
        alert "$BASENAME: pull_request_target + checkout of PR head detected. This is the exact pattern TeamPCP exploited."
      fi
    fi

    # --- Check for overly permissive permissions ---
    if grep -qE "permissions:.*write-all|permissions:.*contents:.*write" "$yml" 2>/dev/null; then
      warn "$BASENAME: Workflow has write permissions. Apply least-privilege: use read-only unless write is required."
    fi

    # --- Check for secrets passed to third-party actions ---
    if grep -E 'with:.*\$\{\{.*secrets\.' "$yml" 2>/dev/null | grep -v "actions/checkout\|actions/setup-" &>/dev/null; then
      warn "$BASENAME: Secrets passed directly to third-party actions. Consider using OIDC or scoped tokens."
    fi

    # --- Check for npm/pip install without --ignore-scripts ---
    if grep -qE "npm (ci|install)[^|]*$" "$yml" 2>/dev/null; then
      if ! grep -qE "npm (ci|install).*--ignore-scripts" "$yml" 2>/dev/null; then
        warn "$BASENAME: npm install/ci without --ignore-scripts. Postinstall scripts are a primary attack vector."
      fi
    fi

  done

  echo ""
  info "Scanned $TOTAL_WORKFLOWS workflow file(s)."
  [[ $UNPINNED_COUNT -gt 0 ]] && echo -e "  ${YELLOW}Total unpinned actions: $UNPINNED_COUNT${NC}"
  [[ $PULL_REQUEST_TARGET -gt 0 ]] && echo -e "  ${YELLOW}Workflows with pull_request_target: $PULL_REQUEST_TARGET${NC}"
else
  echo "  No .github/workflows directory found."
fi

# ============================================================
# PHASE 2: Docker Security Check
# ============================================================
echo ""
echo -e "${CYAN}── Phase 2: Docker Configuration Audit ──${NC}"

DOCKERFILES=()
while IFS= read -r -d '' f; do
  DOCKERFILES+=("$f")
done < <(find "$PROJECT_DIR" -maxdepth 3 \( -name "Dockerfile" -o -name "Dockerfile.*" -o -name "*.dockerfile" \) -print0 2>/dev/null)

if [[ ${#DOCKERFILES[@]} -gt 0 ]]; then
  for dockerfile in "${DOCKERFILES[@]}"; do
    echo "  Scanning: $dockerfile"

    if grep -qE "aquasec/trivy.*:.*0\.69\.[45]" "$dockerfile" 2>/dev/null; then
      alert "$dockerfile: References compromised Trivy Docker image v0.69.4/v0.69.5/v0.69.6."
    fi

    if grep -qE "^FROM .+:latest" "$dockerfile" 2>/dev/null; then
      warn "$dockerfile: Uses :latest tag. Pin to specific digest for reproducibility."
    fi

    if grep -qE "npm (install|ci)" "$dockerfile" 2>/dev/null; then
      if ! grep -qE "npm (install|ci).*--ignore-scripts" "$dockerfile" 2>/dev/null; then
        warn "$dockerfile: npm install without --ignore-scripts inside Docker build."
      fi
    fi

    if grep -qE "pip install" "$dockerfile" 2>/dev/null; then
      if ! grep -qE "pip install.*--require-hashes" "$dockerfile" 2>/dev/null; then
        warn "$dockerfile: pip install without --require-hashes. Consider hash-pinning dependencies."
      fi
    fi
  done
else
  echo "  No Dockerfiles found."
fi

COMPOSE_FILES=()
while IFS= read -r -d '' f; do
  COMPOSE_FILES+=("$f")
done < <(find "$PROJECT_DIR" -maxdepth 2 \( -name "docker-compose*.yml" -o -name "docker-compose*.yaml" -o -name "compose.yml" -o -name "compose.yaml" \) -print0 2>/dev/null)

for compose in "${COMPOSE_FILES[@]}"; do
  if grep -qE "aquasec/trivy" "$compose" 2>/dev/null; then
    warn "$compose: References Trivy Docker image. Verify version is not in compromised range (v0.69.4-v0.69.6)."
  fi
done

# ============================================================
# PHASE 3: Dependency Pinning & Lockfile Integrity
# ============================================================
echo ""
echo -e "${CYAN}── Phase 3: Dependency Pinning Audit ──${NC}"

if [[ -f "$PROJECT_DIR/package.json" ]]; then
  if [[ ! -f "$PROJECT_DIR/package-lock.json" && ! -f "$PROJECT_DIR/yarn.lock" && ! -f "$PROJECT_DIR/pnpm-lock.yaml" ]]; then
    warn "package.json exists but no lockfile found. Lockfiles are essential for reproducible builds."
  fi

  RANGE_DEPS=$(grep -cE '"[\^~]' "$PROJECT_DIR/package.json" 2>/dev/null || echo "0")
  if [[ "$RANGE_DEPS" -gt 0 ]]; then
    warn "$RANGE_DEPS dependencies use range specifiers (^ or ~). Consider exact pinning for security-critical projects."
  fi
fi

if [[ -f "$PROJECT_DIR/requirements.txt" ]]; then
  UNPINNED_PY=$(grep -cvE "==|#|^$|^-" "$PROJECT_DIR/requirements.txt" 2>/dev/null || echo "0")
  if [[ "$UNPINNED_PY" -gt 0 ]]; then
    warn "requirements.txt has $UNPINNED_PY dependencies without exact version pins (==)."
  fi
fi

# ============================================================
# PHASE 4: Secret Exposure Risk
# ============================================================
echo ""
echo -e "${CYAN}── Phase 4: Secret Exposure Risk Assessment ──${NC}"

if command -v git &>/dev/null && [[ -d "$PROJECT_DIR/.git" ]]; then
  ENV_IN_GIT=$(git -C "$PROJECT_DIR" ls-files | grep -E "\.env$|\.env\." 2>/dev/null || true)
  if [[ -n "$ENV_IN_GIT" ]]; then
    # Filter out .env.example files (these are safe)
    REAL_ENV=$(echo "$ENV_IN_GIT" | grep -v "\.env\.example" || true)
    if [[ -n "$REAL_ENV" ]]; then
      alert ".env file(s) tracked in git — credentials may be exposed in history:"
      echo "$REAL_ENV" | while read -r f; do echo "    - $f"; done
    else
      info ".env.example files found (safe — no real secrets)."
    fi
  fi

  if [[ -f "$PROJECT_DIR/.gitignore" ]]; then
    if ! grep -q "\.env" "$PROJECT_DIR/.gitignore" 2>/dev/null; then
      warn ".gitignore does not include .env pattern."
    fi
  else
    warn "No .gitignore found. Ensure sensitive files are not committed."
  fi
fi

# ============================================================
# RESULTS
# ============================================================
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
if [[ $FOUND_ISSUES -eq 0 ]]; then
  echo -e "${GREEN}✓ CI/CD pipeline audit passed with no issues.${NC}"
else
  echo -e "${RED}✗ Found $FOUND_ISSUES potential issue(s) in CI/CD configuration.${NC}"
  echo ""
  echo "  Key recommendations:"
  echo "  1. Pin ALL GitHub Actions to full commit SHAs"
  echo "  2. Avoid pull_request_target unless absolutely necessary"
  echo "  3. Use --ignore-scripts for npm install in CI"
  echo "  4. Pin Docker base images to digests"
  echo "  5. Use --require-hashes for pip install in CI"
  echo "  6. Apply least-privilege permissions to workflow tokens"
fi
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"

exit $FOUND_ISSUES
