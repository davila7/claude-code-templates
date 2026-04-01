#!/usr/bin/env bash
# supply-chain-guard: Python/PyPI supply chain scanner
# Scans Python environments, requirements files, and Pipfiles for known compromised packages
# Usage: bash scan-python.sh [project_dir]
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
echo -e "${CYAN}║  supply-chain-guard — Python/PyPI Supply Chain Scanner  ║${NC}"
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

# --- Known malicious packages (remove entirely) ---
MALICIOUS_REMOVE=("spellcheckerpy" "spellcheckpy" "sympy-dev")

# --- Packages with known malicious versions: "name|bad_versions|info" ---
MALICIOUS_VERSIONED=(
  "litellm|1.82.7,1.82.8|TeamPCP 3-stage credential stealer + K8s lateral movement (2026-03-24). Downgrade to <=1.82.6."
  "telnyx|4.87.1,4.87.2|TeamPCP WAV steganography payload (2026-03-27). Downgrade to 4.87.0."
)

# --- Filesystem IOCs ---
FS_IOCS=(
  "$HOME/.local/share/pgmon/service.py"
  "$HOME/.config/sysmon/sysmon.py"
  "/tmp/.fonts-unix"
  "/tmp/ld.py"
)

# ============================================================
# PHASE 1: Scan requirements files
# ============================================================
echo -e "${CYAN}── Phase 1: Scanning requirements/dependency files ──${NC}"

REQ_FILES=()
while IFS= read -r -d '' f; do
  REQ_FILES+=("$f")
done < <(find "$PROJECT_DIR" -maxdepth 3 \( -name "requirements*.txt" -o -name "Pipfile" -o -name "Pipfile.lock" -o -name "pyproject.toml" -o -name "setup.py" -o -name "setup.cfg" -o -name "poetry.lock" \) -not -path "*/node_modules/*" -not -path "*/.venv/*" -not -path "*/venv/*" -print0 2>/dev/null)

if [[ ${#REQ_FILES[@]} -eq 0 ]]; then
  echo "  No Python dependency files found in $PROJECT_DIR."
else
  for reqfile in "${REQ_FILES[@]}"; do
    echo "  Scanning: $reqfile"

    for pkg in "${MALICIOUS_REMOVE[@]}"; do
      if grep -qi "^${pkg}\b\|^${pkg}[=><!~]" "$reqfile" 2>/dev/null || grep -qi "\"${pkg}\"" "$reqfile" 2>/dev/null; then
        alert "$pkg found in $reqfile — Known malicious package. Remove immediately."
      fi
    done

    for entry in "${MALICIOUS_VERSIONED[@]}"; do
      pkg="${entry%%|*}"
      rest="${entry#*|}"
      versions="${rest%%|*}"
      desc="${rest#*|}"
      if grep -qi "$pkg" "$reqfile" 2>/dev/null; then
        IFS=',' read -ra BAD_VERS <<< "$versions"
        for ver in "${BAD_VERS[@]}"; do
          if grep -qi "${pkg}[=~><!]*=${ver}\|${pkg}==${ver}" "$reqfile" 2>/dev/null; then
            alert "$pkg==$ver in $reqfile — $desc"
          fi
        done
        if grep -qiE "^${pkg}$|^${pkg}[^=]" "$reqfile" 2>/dev/null; then
          warn "$pkg in $reqfile is not pinned to a specific version. Pin to a known safe version."
        fi
      fi
    done
  done
fi

# ============================================================
# PHASE 2: Scan installed Python packages
# ============================================================
echo ""
echo -e "${CYAN}── Phase 2: Scanning installed Python packages ──${NC}"

if command -v pip &>/dev/null || command -v pip3 &>/dev/null; then
  PIP_CMD=$(command -v pip3 || command -v pip)
  INSTALLED=$($PIP_CMD list --format=freeze 2>/dev/null || true)

  if [[ -n "$INSTALLED" ]]; then
    for pkg in "${MALICIOUS_REMOVE[@]}"; do
      if echo "$INSTALLED" | grep -qi "^${pkg}=="; then
        alert "Installed malicious package detected: $pkg — Uninstall with: pip uninstall $pkg"
      fi
    done

    for entry in "${MALICIOUS_VERSIONED[@]}"; do
      pkg="${entry%%|*}"
      rest="${entry#*|}"
      versions="${rest%%|*}"
      desc="${rest#*|}"
      IFS=',' read -ra BAD_VERS <<< "$versions"
      for ver in "${BAD_VERS[@]}"; do
        if echo "$INSTALLED" | grep -qi "^${pkg}==${ver}"; then
          alert "Compromised version installed: $pkg==$ver — $desc"
        fi
      done
    done

    info "Scanned $(echo "$INSTALLED" | wc -l | tr -d ' ') installed packages."
  fi
else
  echo "  pip not found. Skipping installed package scan."
fi

# Also check virtualenv if present
for venv_dir in "$PROJECT_DIR/.venv" "$PROJECT_DIR/venv" "$PROJECT_DIR/env"; do
  if [[ -f "$venv_dir/bin/pip" ]]; then
    echo "  Scanning virtualenv: $venv_dir"
    VENV_INSTALLED=$("$venv_dir/bin/pip" list --format=freeze 2>/dev/null || true)
    for pkg in "${MALICIOUS_REMOVE[@]}"; do
      if echo "$VENV_INSTALLED" | grep -qi "^${pkg}=="; then
        alert "Malicious package in virtualenv $venv_dir: $pkg"
      fi
    done
    for entry in "${MALICIOUS_VERSIONED[@]}"; do
      pkg="${entry%%|*}"
      rest="${entry#*|}"
      versions="${rest%%|*}"
      desc="${rest#*|}"
      IFS=',' read -ra BAD_VERS <<< "$versions"
      for ver in "${BAD_VERS[@]}"; do
        if echo "$VENV_INSTALLED" | grep -qi "^${pkg}==${ver}"; then
          alert "Compromised version in $venv_dir: $pkg==$ver — $desc"
        fi
      done
    done
  fi
done

# ============================================================
# PHASE 3: Check for .pth file hijacking
# ============================================================
echo ""
echo -e "${CYAN}── Phase 3: Checking for .pth file hijacking ──${NC}"

if command -v python3 &>/dev/null; then
  SITE_DIRS=$(python3 -c "import site; [print(p) for p in site.getsitepackages()]" 2>/dev/null || true)
  USER_SITE=$(python3 -c "import site; print(site.getusersitepackages())" 2>/dev/null || true)

  ALL_SITES="$SITE_DIRS"
  [[ -n "$USER_SITE" ]] && ALL_SITES="$ALL_SITES"$'\n'"$USER_SITE"

  while IFS= read -r site_dir; do
    [[ -d "$site_dir" ]] || continue
    while IFS= read -r -d '' pth_file; do
      if grep -qE "^import |^exec|^eval|subprocess|os\.system|os\.popen|__import__" "$pth_file" 2>/dev/null; then
        alert "Suspicious .pth file with code execution: $pth_file"
        echo "    Content preview:"
        head -5 "$pth_file" | while read -r line; do echo "      $line"; done
      fi
      if [[ "$(basename "$pth_file")" == "litellm_init.pth" ]]; then
        alert "LiteLLM persistence IOC: litellm_init.pth found at $pth_file — This executes on EVERY Python startup."
      fi
    done < <(find "$site_dir" -name "*.pth" -print0 2>/dev/null)
  done <<< "$ALL_SITES"
else
  echo "  python3 not found. Skipping .pth scan."
fi

# ============================================================
# PHASE 4: Check for PyPI token exposure
# ============================================================
echo ""
echo -e "${CYAN}── Phase 4: PyPI credential exposure check ──${NC}"

PYPIRC="$HOME/.pypirc"
if [[ -f "$PYPIRC" ]]; then
  warn ".pypirc found at $PYPIRC — Contains PyPI publishing credentials. Ensure token has minimal scope."
  if grep -q "password" "$PYPIRC" 2>/dev/null; then
    warn ".pypirc contains a password field. Use scoped API tokens instead."
  fi
fi

if env | grep -qi "PYPI\|TWINE" 2>/dev/null; then
  warn "PyPI/Twine credentials found in environment variables. Rotate if any compromise suspected."
fi

# ============================================================
# PHASE 5: Filesystem IOC scan
# ============================================================
echo ""
echo -e "${CYAN}── Phase 5: Filesystem IOC scan ──${NC}"

for ioc in "${FS_IOCS[@]}"; do
  if [[ -e "$ioc" ]]; then
    alert "Filesystem IOC detected: $ioc — System may be compromised."
  fi
done

if command -v systemctl &>/dev/null; then
  for svc in "pgmon.service" "sysmon.service"; do
    if systemctl --user is-enabled "$svc" &>/dev/null 2>&1; then
      alert "TeamPCP persistence mechanism: systemd user service $svc is enabled."
    fi
  done
fi

if command -v crontab &>/dev/null; then
  CRON=$(crontab -l 2>/dev/null || true)
  if echo "$CRON" | grep -qE "pgmon|sysmon|\.fonts-unix|icp0\.io" 2>/dev/null; then
    alert "Suspicious cron entry found matching known IOC patterns."
  fi
fi

# ============================================================
# PHASE 6: Check Rust crates (if Cargo.lock present)
# ============================================================
echo ""
echo -e "${CYAN}── Phase 6: Checking Rust dependencies (if present) ──${NC}"

CARGO_LOCKS=()
while IFS= read -r -d '' f; do
  CARGO_LOCKS+=("$f")
done < <(find "$PROJECT_DIR" -maxdepth 3 -name "Cargo.lock" -not -path "*/target/*" -print0 2>/dev/null)

if [[ ${#CARGO_LOCKS[@]} -gt 0 ]]; then
  MALICIOUS_CRATES=("chrono_anchor" "dnp3times" "time_calibrator" "time_calibrators" "time-sync")
  for cargo_lock in "${CARGO_LOCKS[@]}"; do
    echo "  Scanning: $cargo_lock"
    for crate in "${MALICIOUS_CRATES[@]}"; do
      if grep -q "name = \"$crate\"" "$cargo_lock" 2>/dev/null; then
        alert "Malicious Rust crate in $cargo_lock: $crate — Credential stealer targeting .env files. Remove immediately."
      fi
    done
  done
else
  echo "  No Cargo.lock found."
fi

# ============================================================
# RESULTS
# ============================================================
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
if [[ $FOUND_ISSUES -eq 0 ]]; then
  echo -e "${GREEN}✓ No known supply chain IOCs detected.${NC}"
  echo "  Note: This scanner checks against known IOCs as of 2026-03-31."
  echo "  Always pin dependencies and verify package integrity."
else
  echo -e "${RED}✗ Found $FOUND_ISSUES potential issue(s).${NC}"
  echo ""
  echo "  Recommended immediate actions:"
  echo "  1. Uninstall/downgrade any flagged packages"
  echo "  2. Rotate ALL credentials: PyPI tokens, cloud keys, SSH keys, API keys"
  echo "  3. Check for persistence: systemd services, .pth files, cron jobs"
  echo "  4. Audit CI/CD pipelines that run pip install"
  echo "  5. If filesystem IOCs found: treat system as fully compromised"
fi
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"

exit $FOUND_ISSUES
