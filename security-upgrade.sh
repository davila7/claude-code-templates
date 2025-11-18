#!/bin/bash

# Security Upgrade Script for Claude Code Templates
# This script safely upgrades dependencies and fixes security vulnerabilities

set -e  # Exit on error

echo "======================================="
echo "Security Upgrade Script v1.0"
echo "Claude Code Templates Security Fixes"
echo "======================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Step 1: Check current status
echo "Step 1: Checking current security status..."
echo "-------------------------------------------"
npm audit --json > audit-before.json 2>/dev/null || true
VULNS_BEFORE=$(npm audit 2>/dev/null | grep -E "found [0-9]+" | head -1 || echo "0 vulnerabilities")
print_status "Current status: $VULNS_BEFORE"
echo ""

# Step 2: Backup current state
echo "Step 2: Creating backup..."
echo "--------------------------"
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup
print_status "Backup created (package.json.backup, package-lock.json.backup)"
echo ""

# Step 3: Update non-breaking dependencies
echo "Step 3: Updating non-breaking dependencies..."
echo "---------------------------------------------"
npm update
print_status "Non-breaking updates completed"
echo ""

# Step 4: Fix @vercel/node vulnerability
echo "Step 4: Upgrading @vercel/node..."
echo "----------------------------------"
print_warning "Attempting to upgrade @vercel/node to latest version (may have breaking changes)"

# Remove and reinstall @vercel/node
npm uninstall @vercel/node
npm install --save-dev @vercel/node@latest

print_status "@vercel/node upgraded to latest version"
echo ""

# Step 5: Run tests
echo "Step 5: Running tests..."
echo "------------------------"

# Check if API tests exist and run them
if [ -d "api" ] && [ -f "api/package.json" ]; then
    print_status "Running API tests..."
    cd api
    npm test > /dev/null 2>&1 && print_status "API tests passed" || print_warning "Some API tests failed - please review"
    cd ..
else
    print_warning "No API tests found"
fi

# Run main tests if they exist
if grep -q '"test"' package.json; then
    npm test > /dev/null 2>&1 && print_status "Main tests passed" || print_warning "Some tests failed - please review"
else
    print_warning "No main tests configured"
fi
echo ""

# Step 6: Verify Vercel functionality
echo "Step 6: Verifying Vercel functionality..."
echo "-----------------------------------------"
if command -v vercel &> /dev/null; then
    # Test vercel build
    vercel build > /dev/null 2>&1 && print_status "Vercel build successful" || print_warning "Vercel build failed - please check manually"
else
    print_warning "Vercel CLI not installed - skipping Vercel checks"
fi
echo ""

# Step 7: Final security check
echo "Step 7: Final security audit..."
echo "--------------------------------"
npm audit --json > audit-after.json 2>/dev/null || true
VULNS_AFTER=$(npm audit 2>/dev/null | grep -E "found [0-9]+" | head -1 || echo "0 vulnerabilities")
print_status "Final status: $VULNS_AFTER"

# Compare before and after
if [ "$VULNS_AFTER" = "0 vulnerabilities" ]; then
    print_status "All vulnerabilities resolved!"
else
    print_warning "Some vulnerabilities remain - review npm audit output"
fi
echo ""

# Step 8: Generate report
echo "Step 8: Generating upgrade report..."
echo "------------------------------------"
cat > SECURITY_UPGRADE_LOG.txt << EOF
Security Upgrade Log
Generated: $(date)

Before Upgrade:
$VULNS_BEFORE

After Upgrade:
$VULNS_AFTER

Changes Made:
- Updated all non-breaking dependencies
- Upgraded @vercel/node to latest version
- Ran test suites

Backup Files:
- package.json.backup
- package-lock.json.backup

To rollback if needed:
mv package.json.backup package.json
mv package-lock.json.backup package-lock.json
npm install
EOF

print_status "Upgrade report saved to SECURITY_UPGRADE_LOG.txt"
echo ""

# Final summary
echo "======================================="
echo "Security Upgrade Complete!"
echo "======================================="
echo ""
echo "Summary:"
echo "  Before: $VULNS_BEFORE"
echo "  After:  $VULNS_AFTER"
echo ""
echo "Next Steps:"
echo "  1. Review SECURITY_UPGRADE_LOG.txt"
echo "  2. Test your application thoroughly"
echo "  3. Run: vercel dev (to test local development)"
echo "  4. If issues occur, rollback using backup files"
echo ""
print_warning "Please test all functionality before deploying to production!"

# Cleanup audit files
rm -f audit-before.json audit-after.json

exit 0