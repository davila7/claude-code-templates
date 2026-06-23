#!/bin/bash

# Detailed test script for claude-code-templates CLI
set -e

echo "🔬 Starting Detailed CLI Testing..."

TEST_BASE_DIR="/tmp/claude-detailed-test-$(date +%s)"
mkdir -p "$TEST_BASE_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${YELLOW}🔸 Test $TOTAL_TESTS: $test_name${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "   Command: $test_command"
    fi
    echo ""
}

# Test different scenarios
test_scenarios() {
    # Framework combinations to test
    local scenarios=(
        "javascript-typescript:react"
        "javascript-typescript:vue"
        "javascript-typescript:angular"
        "javascript-typescript:node"
        "javascript-typescript:none"
        "common:none"
    )
    
    for scenario in "${scenarios[@]}"; do
        local language="${scenario%:*}"
        local framework="${scenario#*:}"
        
        local test_dir="$TEST_BASE_DIR/test-$language-$framework"
        mkdir -p "$test_dir"
        cd "$test_dir"
        
        echo -e "${YELLOW}📋 Testing scenario: $language + $framework${NC}"
        
        # Test dry run
        run_test "Dry run for $language + $framework" \
            "claude-code-templates --language $language --framework $framework --dry-run --yes > /dev/null 2>&1"
        
        # Test actual installation
        run_test "Installation for $language + $framework" \
            "claude-code-templates --language $language --framework $framework --yes > /dev/null 2>&1"
        
        # Check if CLAUDE.md was created
        run_test "CLAUDE.md exists for $language + $framework" \
            "[ -f 'CLAUDE.md' ]"
        
        # Check if .claude directory was created
        run_test ".claude directory exists for $language + $framework" \
            "[ -d '.claude' ]"
        
        # Check if settings.json was created (for non-common languages)
        if [ "$language" != "common" ]; then
            run_test "settings.json exists for $language + $framework" \
                "[ -f '.claude/settings.json' ]"
            
            # Test hooks functionality
            run_test "settings.json contains hooks for $language" \
                "grep -q '\"hooks\"' '.claude/settings.json'"
            
            run_test "settings.json has valid JSON structure" \
                "jq . '.claude/settings.json' > /dev/null 2>&1"
            
            # Verify specific hook types exist for non-common languages
            run_test "PreToolUse hooks exist for $language" \
                "jq '.hooks.PreToolUse' '.claude/settings.json' | grep -q '\['"
            
            run_test "PostToolUse hooks exist for $language" \
                "jq '.hooks.PostToolUse' '.claude/settings.json' | grep -q '\['"
        fi
        
        # Check for framework-specific commands
        case "$framework" in
            "react")
                run_test "React component command exists" \
                    "[ -f '.claude/commands/component.md' ]"
                run_test "React hooks command exists" \
                    "[ -f '.claude/commands/hooks.md' ]"
                ;;
            "vue")
                run_test "Vue components command exists" \
                    "[ -f '.claude/commands/components.md' ]"
                run_test "Vue composables command exists" \
                    "[ -f '.claude/commands/composables.md' ]"
                ;;
            "angular")
                run_test "Angular components command exists" \
                    "[ -f '.claude/commands/components.md' ]"
                run_test "Angular services command exists" \
                    "[ -f '.claude/commands/services.md' ]"
                ;;
            "node")
                run_test "Node API endpoint command exists" \
                    "[ -f '.claude/commands/api-endpoint.md' ]"
                run_test "Node middleware command exists" \
                    "[ -f '.claude/commands/middleware.md' ]"
                ;;
        esac
        
        echo ""
    done
}

# Test error scenarios
test_error_scenarios() {
    echo -e "${YELLOW}🚨 Testing Error Scenarios${NC}"
    
    # Invalid language
    run_test "Invalid language handling" \
        "! claude-code-templates --language invalid-lang --yes > /dev/null 2>&1"
    
    # Invalid framework
    run_test "Invalid framework handling" \
        "! claude-code-templates --language javascript-typescript --framework invalid-framework --yes > /dev/null 2>&1"
}

# Test hooks functionality specifically
test_hooks_functionality() {
    echo -e "${YELLOW}🔧 Testing Hooks Functionality${NC}"
    
    local test_dir="$TEST_BASE_DIR/test-hooks"
    mkdir -p "$test_dir"
    cd "$test_dir"
    
    # Test JavaScript/TypeScript hooks
    run_test "JS/TS installation with default hooks" \
        "claude-code-templates --language javascript-typescript --yes > /dev/null 2>&1"
    
    run_test "JS/TS hooks count verification" \
        "[ \$(jq '.hooks.PreToolUse | length' '.claude/settings.json') -gt 0 ]"
    
    run_test "JS/TS PostToolUse hooks verification" \
        "[ \$(jq '.hooks.PostToolUse | length' '.claude/settings.json') -gt 0 ]"
    
    run_test "JS/TS Stop hooks verification" \
        "[ \$(jq '.hooks.Stop | length' '.claude/settings.json') -gt 0 ]"
    
    # Test specific hook content
    run_test "Console.log detection hook exists" \
        "jq -r '.hooks.PreToolUse[].hooks[].command' '.claude/settings.json' | grep -q 'console'"
    
    run_test "Prettier formatting hook exists" \
        "jq -r '.hooks.PostToolUse[].hooks[].command' '.claude/settings.json' | grep -q 'prettier'"
    
    run_test "TypeScript checking hook exists" \
        "jq -r '.hooks.PostToolUse[].hooks[].command' '.claude/settings.json' | grep -q 'tsc'"
    
    run_test "ESLint hook exists in Stop hooks" \
        "jq -r '.hooks.Stop[].hooks[].command' '.claude/settings.json' | grep -q 'eslint'"
    
    # Test other languages
    cd "$TEST_BASE_DIR"
    
    # Test Python hooks
    mkdir -p "test-python-hooks"
    cd "test-python-hooks"
    
    run_test "Python installation with hooks" \
        "claude-code-templates --language python --yes > /dev/null 2>&1"
    
    run_test "Python Black formatter hook exists" \
        "jq -r '.hooks.PostToolUse[].hooks[].command' '.claude/settings.json' | grep -q 'black'"
    
    run_test "Python flake8 hook exists" \
        "jq -r '.hooks.PostToolUse[].hooks[].command' '.claude/settings.json' | grep -q 'flake8'"
    
    # Test Go hooks
    cd "$TEST_BASE_DIR"
    mkdir -p "test-go-hooks"
    cd "test-go-hooks"
    
    run_test "Go installation with hooks" \
        "claude-code-templates --language go --yes > /dev/null 2>&1"
    
    run_test "Go fmt hook exists" \
        "jq -r '.hooks.PostToolUse[].hooks[].command' '.claude/settings.json' | grep -q 'gofmt'"
    
    run_test "Go vet hook exists" \
        "jq -r '.hooks.PostToolUse[].hooks[].command' '.claude/settings.json' | grep -q 'go vet'"
    
    # Test Rust hooks
    cd "$TEST_BASE_DIR"
    mkdir -p "test-rust-hooks"
    cd "test-rust-hooks"
    
    run_test "Rust installation with hooks" \
        "claude-code-templates --language rust --yes > /dev/null 2>&1"
    
    run_test "Rust fmt hook exists" \
        "jq -r '.hooks.PostToolUse[].hooks[].command' '.claude/settings.json' | grep -q 'rustfmt'"
    
    run_test "Rust clippy hook exists" \
        "jq -r '.hooks.PostToolUse[].hooks[].command' '.claude/settings.json' | grep -q 'clippy'"
}

# Test command variants
test_command_variants() {
    echo -e "${YELLOW}🔧 Testing Command Variants${NC}"
    
    local test_dir="$TEST_BASE_DIR/test-variants"
    mkdir -p "$test_dir"
    cd "$test_dir"
    
    # Test all command aliases
    run_test "claude-code-templates command" \
        "claude-code-templates --version > /dev/null 2>&1"
    
    run_test "create-claude-config command" \
        "create-claude-config --version > /dev/null 2>&1"
    
    run_test "claude-code-template command" \
        "claude-code-template --version > /dev/null 2>&1"
    
    run_test "claude-init command" \
        "claude-init --version > /dev/null 2>&1"
}

# Run all tests
echo "🏁 Starting test execution..."
test_scenarios
test_hooks_functionality
test_error_scenarios
test_command_variants

# Summary
echo -e "${YELLOW}📊 Test Summary${NC}"
echo -e "Total tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit_code=0
else
    echo -e "${RED}💥 Some tests failed!${NC}"
    exit_code=1
fi

# Cleanup
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
rm -rf "$TEST_BASE_DIR"

exit $exit_code