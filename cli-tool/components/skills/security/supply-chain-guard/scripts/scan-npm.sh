#!/usr/bin/env bash
# supply-chain-guard: npm supply chain scanner
# Scans node_modules and lockfiles for known compromised packages and IOCs
# Usage: bash scan-npm.sh [project_dir]
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
echo -e "${CYAN}║  supply-chain-guard — npm Supply Chain Scanner          ║${NC}"
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

# --- Known malicious packages: "name|description" ---
MALICIOUS_EXACT=(
  "plain-crypto-js|RAT dropper (axios campaign, 2026-03-31). Remove immediately."
  "spellcheckerpy|RAT trojan. Remove immediately."
  "spellcheckpy|RAT trojan. Remove immediately."
)

# --- Packages with known malicious versions: "name|bad_versions|info" ---
MALICIOUS_VERSIONED=(
  "axios|1.14.1,0.30.4|RAT dropper via plain-crypto-js dependency (2026-03-31). Downgrade to 1.14.0 or 0.30.3."
  "litellm|1.82.7,1.82.8|TeamPCP credential stealer (2026-03-24). Downgrade to <=1.82.6."
  "telnyx|4.87.1,4.87.2|TeamPCP WAV steganography stealer (2026-03-27). Downgrade to 4.87.0."
)

# --- Compromised npm scopes ---
MALICIOUS_SCOPES=("@emilgroup" "@opengov" "@teale.io" "@airtm" "@pypestream")

# --- Filesystem IOCs ---
FS_IOCS=(
  "$HOME/.local/share/pgmon/service.py"
  "$HOME/.config/sysmon/sysmon.py"
  "/tmp/.fonts-unix"
  "/tmp/ld.py"
)

if [[ "$OSTYPE" == "darwin"* ]]; then
  FS_IOCS+=("/Library/Caches/com.apple.act.mond")
fi

# --- Network IOCs ---
MALICIOUS_DOMAINS=(
  "scan.aquasecurtiy.org"
  "checkmarx.zone"
  "models.litellm.cloud"
  "updatenet.work"
  "sfrclak.com"
  "timeapis.io"
  "tdtqy-oyaaa-aaaae-af2dq-cai.raw.icp0.io"
)

MALICIOUS_IPS=(
  "45.148.10.212"
  "83.142.209.11"
  "83.142.209.203"
  "172.86.73.139"
  "63.250.56.54"
)

# ============================================================
# PHASE 1: Check lockfiles for compromised packages/versions
# ============================================================
echo -e "${CYAN}── Phase 1: Scanning lockfiles ──${NC}"

LOCKFILES=()
for f in "$PROJECT_DIR/package-lock.json" "$PROJECT_DIR/yarn.lock" "$PROJECT_DIR/pnpm-lock.yaml" "$PROJECT_DIR/bun.lockb"; do
  [[ -f "$f" ]] && LOCKFILES+=("$f")
done

if [[ ${#LOCKFILES[@]} -eq 0 ]]; then
  echo "  No lockfile found in $PROJECT_DIR. Checking package.json only."
fi

# Check package.json
if [[ -f "$PROJECT_DIR/package.json" ]]; then
  for entry in "${MALICIOUS_EXACT[@]}"; do
    pkg="${entry%%|*}"
    desc="${entry#*|}"
    if grep -q "\"$pkg\"" "$PROJECT_DIR/package.json" 2>/dev/null; then
      alert "package.json contains known malicious package: $pkg — $desc"
    fi
  done

  for entry in "${MALICIOUS_VERSIONED[@]}"; do
    pkg="${entry%%|*}"
    rest="${entry#*|}"
    versions="${rest%%|*}"
    desc="${rest#*|}"
    if grep -q "\"$pkg\"" "$PROJECT_DIR/package.json" 2>/dev/null; then
      IFS=',' read -ra BAD_VERS <<< "$versions"
      for ver in "${BAD_VERS[@]}"; do
        if grep -qE "\"$pkg\"[[:space:]]*:[[:space:]]*\"[~^]?$ver\"" "$PROJECT_DIR/package.json" 2>/dev/null; then
          alert "$pkg@$ver in package.json — $desc"
        fi
      done
    fi
  done
fi

# Check lockfiles
for lockfile in "${LOCKFILES[@]}"; do
  echo "  Scanning: $lockfile"

  for entry in "${MALICIOUS_EXACT[@]}"; do
    pkg="${entry%%|*}"
    desc="${entry#*|}"
    if grep -q "$pkg" "$lockfile" 2>/dev/null; then
      alert "Lockfile contains known malicious package: $pkg — $desc"
    fi
  done

  for entry in "${MALICIOUS_VERSIONED[@]}"; do
    pkg="${entry%%|*}"
    rest="${entry#*|}"
    versions="${rest%%|*}"
    desc="${rest#*|}"
    IFS=',' read -ra BAD_VERS <<< "$versions"
    for ver in "${BAD_VERS[@]}"; do
      if grep -q "${pkg}.*${ver}" "$lockfile" 2>/dev/null || grep -q "\"${pkg}\": \"${ver}\"" "$lockfile" 2>/dev/null; then
        alert "$pkg@$ver found in lockfile — $desc"
      fi
    done
  done

  for scope in "${MALICIOUS_SCOPES[@]}"; do
    if grep -q "$scope/" "$lockfile" 2>/dev/null; then
      warn "Lockfile references packages from compromised scope $scope (CanisterWorm). Verify versions."
    fi
  done
done

# ============================================================
# PHASE 2: Check node_modules for malicious packages
# ============================================================
echo ""
echo -e "${CYAN}── Phase 2: Scanning node_modules ──${NC}"

if [[ -d "$PROJECT_DIR/node_modules" ]]; then
  for entry in "${MALICIOUS_EXACT[@]}"; do
    pkg="${entry%%|*}"
    desc="${entry#*|}"
    if [[ -d "$PROJECT_DIR/node_modules/$pkg" ]]; then
      alert "node_modules contains malicious package: $pkg — $desc"
    fi
  done

  for scope in "${MALICIOUS_SCOPES[@]}"; do
    if [[ -d "$PROJECT_DIR/node_modules/$scope" ]]; then
      warn "node_modules contains packages from compromised scope $scope. Audit all packages in this scope."
    fi
  done

  echo "  Checking for suspicious postinstall scripts..."
  SUSPECT_SCRIPTS=$(find "$PROJECT_DIR/node_modules" -maxdepth 3 -name "package.json" -exec grep -l '"postinstall"' {} \; 2>/dev/null | head -20 || true)
  if [[ -n "$SUSPECT_SCRIPTS" ]]; then
    SCRIPT_COUNT=$(echo "$SUSPECT_SCRIPTS" | wc -l | tr -d ' ')
    echo -e "  ${YELLOW}Found $SCRIPT_COUNT packages with postinstall scripts. Review manually:${NC}"
    echo "$SUSPECT_SCRIPTS" | head -10 | while read -r f; do
      echo "    - $f"
    done
    [[ "$SCRIPT_COUNT" -gt 10 ]] && echo "    ... and $((SCRIPT_COUNT - 10)) more"
  fi
else
  echo "  No node_modules found (not installed or using a different package manager)."
fi

# ============================================================
# PHASE 3: Check GitHub Actions for compromised actions
# ============================================================
echo ""
echo -e "${CYAN}── Phase 3: Scanning GitHub Actions workflows ──${NC}"

WORKFLOW_DIR="$PROJECT_DIR/.github/workflows"
if [[ -d "$WORKFLOW_DIR" ]]; then
  COMPROMISED_ACTIONS=(
    "aquasecurity/trivy-action|75/76 tags poisoned by TeamPCP (2026-03-19). Pin to verified commit SHA."
    "aquasecurity/setup-trivy|All 7 tags poisoned (2026-03-19). Pin to verified commit SHA."
    "Checkmarx/kics-github-action|All 35 tags poisoned (2026-03-23). Pin to verified commit SHA."
    "Checkmarx/ast-github-action|v2.3.28 compromised (2026-03-23). Pin to verified commit SHA."
    "tj-actions/changed-files|All version tags modified (CVE-2025-30066). Pin to verified commit SHA."
  )

  for yml in "$WORKFLOW_DIR"/*.yml "$WORKFLOW_DIR"/*.yaml; do
    [[ -f "$yml" ]] || continue
    for entry in "${COMPROMISED_ACTIONS[@]}"; do
      action="${entry%%|*}"
      desc="${entry#*|}"
      if grep -q "$action" "$yml" 2>/dev/null; then
        if grep "$action" "$yml" | grep -qE "@[a-f0-9]{40}"; then
          warn "$action used in $(basename "$yml") — SHA-pinned (good), but verify the SHA is not from the attack window. $desc"
        else
          alert "$action used in $(basename "$yml") WITHOUT SHA pinning — $desc"
        fi
      fi
    done

    UNPINNED=$(grep -E "uses:.*@(v[0-9]|latest|main|master)" "$yml" 2>/dev/null || true)
    if [[ -n "$UNPINNED" ]]; then
      warn "$(basename "$yml") has actions pinned to mutable tags (v*, latest, main). Pin all actions to commit SHAs."
    fi
  done
else
  echo "  No .github/workflows directory found."
fi

# ============================================================
# PHASE 4: Filesystem IOC scan
# ============================================================
echo ""
echo -e "${CYAN}── Phase 4: Filesystem IOC scan ──${NC}"

for ioc in "${FS_IOCS[@]}"; do
  if [[ -e "$ioc" ]]; then
    alert "Filesystem IOC detected: $ioc — System may be compromised. Investigate immediately."
  fi
done

if command -v systemctl &>/dev/null; then
  for svc in "pgmon.service" "sysmon.service"; do
    if systemctl --user is-enabled "$svc" &>/dev/null 2>&1 || systemctl is-enabled "$svc" &>/dev/null 2>&1; then
      alert "Suspicious systemd service detected: $svc — Known TeamPCP persistence mechanism."
    fi
  done
fi

if command -v python3 &>/dev/null; then
  SITE_PACKAGES=$(python3 -c "import site; print(site.getsitepackages()[0])" 2>/dev/null || echo "")
  if [[ -n "$SITE_PACKAGES" && -d "$SITE_PACKAGES" ]]; then
    SUSPICIOUS_PTH=$(find "$SITE_PACKAGES" -name "*.pth" -newer "$SITE_PACKAGES" -exec grep -l "exec\|import\|eval\|subprocess\|os.system" {} \; 2>/dev/null || true)
    if [[ -n "$SUSPICIOUS_PTH" ]]; then
      alert "Suspicious .pth files with code execution found in site-packages:"
      echo "$SUSPICIOUS_PTH" | while read -r f; do echo "    - $f"; done
    fi
  fi
fi

if [[ -d "/mnt/c/Users" ]]; then
  for user_dir in /mnt/c/Users/*/AppData/Roaming/Microsoft/Windows/Start\ Menu/Programs/Startup/; do
    if [[ -f "${user_dir}msbuild.exe" ]]; then
      alert "Telnyx persistence IOC: msbuild.exe found in Windows Startup folder: $user_dir"
    fi
  done
fi

# ============================================================
# PHASE 5: Network IOC scan in source files
# ============================================================
echo ""
echo -e "${CYAN}── Phase 5: Network IOC scan ──${NC}"

SCAN_DIRS=("$PROJECT_DIR/node_modules" "$PROJECT_DIR/src" "$PROJECT_DIR/lib" "$PROJECT_DIR/dist")

for domain in "${MALICIOUS_DOMAINS[@]}"; do
  for dir in "${SCAN_DIRS[@]}"; do
    [[ -d "$dir" ]] || continue
    HITS=$(grep -rl "$domain" "$dir" 2>/dev/null | head -5 || true)
    if [[ -n "$HITS" ]]; then
      alert "Malicious C2 domain '$domain' found in files:"
      echo "$HITS" | while read -r f; do echo "    - $f"; done
    fi
  done
done

for ip in "${MALICIOUS_IPS[@]}"; do
  for dir in "${SCAN_DIRS[@]}"; do
    [[ -d "$dir" ]] || continue
    HITS=$(grep -rl "$ip" "$dir" 2>/dev/null | head -5 || true)
    if [[ -n "$HITS" ]]; then
      alert "Malicious C2 IP '$ip' found in files:"
      echo "$HITS" | while read -r f; do echo "    - $f"; done
    fi
  done
done

# ============================================================
# PHASE 6: Check .npmrc for token exposure
# ============================================================
echo ""
echo -e "${CYAN}── Phase 6: npm token exposure check ──${NC}"

for npmrc in "$HOME/.npmrc" "$PROJECT_DIR/.npmrc" "/etc/npmrc"; do
  if [[ -f "$npmrc" ]]; then
    if grep -q "_authToken" "$npmrc" 2>/dev/null; then
      warn "npm auth token found in $npmrc — Ensure this token has minimal scopes and rotate if any compromise suspected."
    fi
  fi
done

# ============================================================
# RESULTS
# ============================================================
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
if [[ $FOUND_ISSUES -eq 0 ]]; then
  echo -e "${GREEN}✓ No known supply chain IOCs detected.${NC}"
  echo "  Note: This scanner checks against known IOCs as of 2026-03-31."
  echo "  Always keep dependencies pinned and use lockfiles."
else
  echo -e "${RED}✗ Found $FOUND_ISSUES potential issue(s).${NC}"
  echo ""
  echo "  Recommended immediate actions:"
  echo "  1. Remove/downgrade any flagged packages"
  echo "  2. Rotate ALL credentials accessible from this environment"
  echo "  3. Audit CI/CD pipeline secrets"
  echo "  4. Check network logs for connections to flagged C2 infrastructure"
  echo "  5. If filesystem IOCs found: treat system as fully compromised"
fi
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"

exit $FOUND_ISSUES
