#!/bin/bash

# Production Verification Script
# Run this to verify all features are production-ready

echo "🔍 Verifying Production Readiness..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check counter
CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to check
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}❌ $1${NC}"
        ((CHECKS_FAILED++))
    fi
}

# 1. Check if build passes
echo "📦 Checking build..."
npm run build > /dev/null 2>&1
check "Build passes"

# 2. Check for TypeScript errors
echo "🔍 Checking TypeScript..."
npx tsc --noEmit > /dev/null 2>&1
check "No TypeScript errors"

# 3. Check for mock data imports
echo "🔍 Checking for mock data..."
! grep -r "MOCK_SHOWCASES" src/pages/api/showcase/ > /dev/null 2>&1
check "No mock data in showcase APIs"

! grep -r "USE_MOCK_DATA = true" src/pages/api/ > /dev/null 2>&1
check "No mock data flags in APIs"

# 4. Check database client usage
echo "🗄️ Checking database integration..."
grep -r "getNeonClient" src/pages/api/showcase/ > /dev/null 2>&1
check "Showcase APIs use database"

grep -r "isDatabaseConfigured" src/pages/api/github-stats.ts > /dev/null 2>&1
check "GitHub API checks database"

# 5. Check migrations exist
echo "📋 Checking migrations..."
[ -f "migrations/007_showcase_feature.sql" ]
check "Showcase migration exists"

[ -f "migrations/008_github_integration.sql" ]
check "GitHub migration exists"

# 6. Check documentation
echo "📚 Checking documentation..."
[ -f "LOCAL_DEVELOPMENT.md" ]
check "Local development guide exists"

[ -f "PRODUCTION_READY.md" ]
check "Production guide exists"

[ -f "FINAL_PR_SUMMARY.md" ]
check "PR summary exists"

[ -d "../docs/community-showcase" ]
check "Showcase documentation exists"

[ -d "../docs/github-integration-dashboard" ]
check "GitHub documentation exists"

# 7. Check environment example
echo "🔧 Checking environment..."
grep -q "NEON_DATABASE_URL" .env.example
check "Database URL in .env.example"

grep -q "GITHUB_TOKEN" .env.example
check "GitHub token in .env.example"

# 8. Check API routes exist
echo "🌐 Checking API routes..."
[ -f "src/pages/api/showcase/list.ts" ]
check "Showcase list API exists"

[ -f "src/pages/api/showcase/submit.ts" ]
check "Showcase submit API exists"

[ -f "src/pages/api/github-stats.ts" ]
check "GitHub stats API exists"

# 9. Check pages exist
echo "📄 Checking pages..."
[ -f "src/pages/showcase/index.astro" ]
check "Showcase gallery page exists"

[ -f "src/pages/github.astro" ]
check "GitHub dashboard page exists"

[ -f "src/pages/tutorials/index.astro" ]
check "Tutorials page exists"

# 10. Check components exist
echo "🧩 Checking components..."
[ -f "src/components/showcase/ShowcaseCard.tsx" ]
check "ShowcaseCard component exists"

[ -f "src/components/github/GitHubDashboard.tsx" ]
check "GitHubDashboard component exists"

[ -f "src/components/tutorials/TutorialCard.tsx" ]
check "TutorialCard component exists"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Passed: $CHECKS_PASSED${NC}"
echo -e "${RED}❌ Failed: $CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Ready for production!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run database migrations"
    echo "2. Set environment variables"
    echo "3. Deploy to production"
    echo "4. Create pull request"
    exit 0
else
    echo -e "${RED}⚠️  Some checks failed. Please fix before deploying.${NC}"
    exit 1
fi
