#!/bin/bash

# Pre-Deployment Validation Script
# This script MUST pass before deploying to production

set -e  # Exit on any error

echo "🚀 Pre-Deployment Validation Check"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print success
success() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

# Function to print error
error() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to print info
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

echo "Step 1: Checking Git Status"
echo "----------------------------"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "Not a git repository"
    exit 1
else
    success "Git repository detected"
fi

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    warning "There are uncommitted changes"
    git status -s
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    success "No uncommitted changes"
fi

echo ""
echo "Step 2: Checking Node.js & npm"
echo "-------------------------------"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    success "Node.js ${NODE_VERSION} installed"
else
    error "Node.js not found"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    success "npm ${NPM_VERSION} installed"
else
    error "npm not found"
    exit 1
fi

echo ""
echo "Step 3: Installing/Updating Dependencies"
echo "-----------------------------------------"

# Install root dependencies
if [ -f "package.json" ]; then
    info "Installing root dependencies..."
    if npm install --silent; then
        success "Root dependencies installed"
    else
        error "Failed to install root dependencies"
        exit 1
    fi
fi

# Install API dependencies
if [ -f "api/package.json" ]; then
    info "Installing API dependencies..."
    cd api
    if npm install --silent; then
        success "API dependencies installed"
    else
        error "Failed to install API dependencies"
        exit 1
    fi
    cd ..
fi

echo ""
echo "Step 4: Running API Tests"
echo "-------------------------"

cd api

# Run critical API tests
info "Running critical endpoint tests..."
if npm run test:api --silent; then
    success "All API tests passed"
else
    error "API tests failed"
    echo ""
    echo "Fix the failing tests before deploying!"
    exit 1
fi

cd ..

echo ""
echo "Step 5: Checking API File Structure"
echo "------------------------------------"

# Check critical API endpoints exist
CRITICAL_ENDPOINTS=(
    "api/track-download-supabase.js"
    "api/discord/interactions.js"
    "api/claude-code-check.js"
)

for endpoint in "${CRITICAL_ENDPOINTS[@]}"; do
    if [ -f "$endpoint" ]; then
        success "$(basename $endpoint) exists"
    else
        error "$(basename $endpoint) NOT FOUND - Critical endpoint missing!"
        exit 1
    fi
done

echo ""
echo "Step 6: Validating Environment Variables"
echo "-----------------------------------------"

# Check if .env.example exists
if [ -f ".env.example" ]; then
    success ".env.example file exists"

    # Extract required variables
    REQUIRED_VARS=$(grep -E "^[A-Z_]+=" .env.example | cut -d'=' -f1 | sort | uniq)

    info "Required environment variables:"
    echo "$REQUIRED_VARS" | while read var; do
        echo "   - $var"
    done
    echo ""
    warning "Make sure these are set in Vercel Dashboard"
else
    warning ".env.example not found"
fi

echo ""
echo "Step 7: Vercel Configuration Check"
echo "-----------------------------------"

# Check vercel.json
if [ -f "vercel.json" ]; then
    success "vercel.json exists"

    # Validate it's valid JSON
    if jq empty vercel.json 2>/dev/null; then
        success "vercel.json is valid JSON"
    else
        error "vercel.json is invalid JSON"
        exit 1
    fi
else
    warning "vercel.json not found"
fi

echo ""
echo "Step 8: Final Checks"
echo "--------------------"

# Check if vercel CLI is installed
if command -v vercel &> /dev/null; then
    VERCEL_VERSION=$(vercel --version)
    success "Vercel CLI ${VERCEL_VERSION} installed"
else
    warning "Vercel CLI not installed (install with: npm i -g vercel)"
fi

# Summary
echo ""
echo "=================================="
echo "Pre-Deployment Check Summary"
echo "=================================="
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready to deploy.${NC}"
    echo ""
    echo "Deploy with:"
    echo "  vercel --prod"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Fix issues before deploying.${NC}"
    echo ""
    exit 1
fi
