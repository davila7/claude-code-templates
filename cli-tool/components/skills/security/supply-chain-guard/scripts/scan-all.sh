#!/usr/bin/env bash
# supply-chain-guard: Full project supply chain audit
# Runs all scanners: npm, Python/PyPI, CI/CD, and system IOCs
# Usage: bash scan-all.sh [project_dir]

set -eo pipefail

PROJECT_DIR="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL_ISSUES=0
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     supply-chain-guard — Full Supply Chain Audit        ║${NC}"
echo -e "${CYAN}║     Project: $(printf '%-41s' "$PROJECT_DIR")║${NC}"
echo -e "${CYAN}║     Date: $(date '+%Y-%m-%d %H:%M %Z')                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

run_scanner() {
  local scanner="$1"
  local label="$2"
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  Running: $label${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  bash "$SCRIPT_DIR/$scanner" "$PROJECT_DIR"
  local exit_code=$?
  TOTAL_ISSUES=$((TOTAL_ISSUES + exit_code))
}

run_scanner "scan-npm.sh" "npm / Node.js Scanner"
run_scanner "scan-python.sh" "Python / PyPI Scanner"
run_scanner "scan-ci.sh" "CI/CD Pipeline Scanner"

# ============================================================
# FINAL SUMMARY
# ============================================================
echo ""
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║             SUPPLY CHAIN AUDIT SUMMARY                 ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

if [[ $TOTAL_ISSUES -eq 0 ]]; then
  echo -e "${GREEN}✓ All scanners passed. No known supply chain issues detected.${NC}"
  echo ""
  echo "  Ongoing best practices:"
  echo "  • Keep lockfiles committed and up to date"
  echo "  • Pin all dependencies to exact versions"
  echo "  • Pin GitHub Actions to full commit SHAs"
  echo "  • Use --ignore-scripts for npm install"
  echo "  • Use --require-hashes for pip install"
  echo "  • Run this audit regularly and before deployments"
  echo "  • Subscribe to security advisories for your dependencies"
else
  echo -e "${RED}✗ Total issues found across all scanners: $TOTAL_ISSUES${NC}"
  echo ""
  echo "  Immediate response checklist:"
  echo "  ┌─────────────────────────────────────────────────────┐"
  echo "  │ 1. Remove/downgrade all flagged packages            │"
  echo "  │ 2. Rotate ALL credentials:                          │"
  echo "  │    - npm/PyPI tokens                                │"
  echo "  │    - Cloud provider keys (AWS, GCP, Azure)          │"
  echo "  │    - SSH keys                                       │"
  echo "  │    - Database passwords                             │"
  echo "  │    - API keys and JWT secrets                       │"
  echo "  │ 3. Check for persistence mechanisms:                │"
  echo "  │    - systemd services (pgmon, sysmon)               │"
  echo "  │    - .pth files in Python site-packages             │"
  echo "  │    - Cron jobs                                      │"
  echo "  │    - Windows Startup folder                         │"
  echo "  │ 4. Audit network logs for C2 connections            │"
  echo "  │ 5. If filesystem IOCs found: full incident response │"
  echo "  │ 6. Review CI/CD pipeline execution history          │"
  echo "  └─────────────────────────────────────────────────────┘"
fi
echo ""

exit $TOTAL_ISSUES
