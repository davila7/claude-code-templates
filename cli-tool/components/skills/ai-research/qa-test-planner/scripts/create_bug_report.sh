#!/bin/bash

# Bug Report Generator
# Create structured, reproducible bug reports

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${RED}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║           Bug Report Generator                   ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════╝${NC}"
echo ""

prompt_input() {
    local prompt_text="$1"
    local var_name="$2"
    local required="$3"
    
    while true; do
        echo -e "${CYAN}${prompt_text}${NC}"
        read -r input
        
        if [ -n "$input" ]; then
            eval "$var_name=\"$input\""
            break
        elif [ "$required" != "true" ]; then
            eval "$var_name=\"\""
            break
        else
            echo -e "${RED}This field is required.${NC}"
        fi
    done
}

# Bug ID
BUG_ID="BUG-$(date +%Y%m%d%H%M%S)"
echo -e "${YELLOW}Auto-generated Bug ID: $BUG_ID${NC}"
echo ""

# Basic Info
prompt_input "Bug title (clear, specific):" BUG_TITLE true

echo ""
echo "Severity:"
echo "1) Critical - System crash, data loss, security issue"
echo "2) High - Major feature broken, no workaround"
echo "3) Medium - Feature partially broken, workaround exists"
echo "4) Low - Cosmetic, minor inconvenience"
echo ""

prompt_input "Select severity (1-4):" SEVERITY_NUM true

case $SEVERITY_NUM in
    1) SEVERITY="Critical" ;;
    2) SEVERITY="High" ;;
    3) SEVERITY="Medium" ;;
    4) SEVERITY="Low" ;;
    *) SEVERITY="Medium" ;;
esac

echo ""
echo "Priority:"
echo "1) P0 - Blocks release"
echo "2) P1 - Fix before release"
echo "3) P2 - Fix in next release"
echo "4) P3 - Fix when possible"
echo ""

prompt_input "Select priority (1-4):" PRIORITY_NUM true

case $PRIORITY_NUM in
    1) PRIORITY="P0" ;;
    2) PRIORITY="P1" ;;
    3) PRIORITY="P2" ;;
    4) PRIORITY="P3" ;;
    *) PRIORITY="P2" ;;
esac

# Environment
echo ""
echo -e "${MAGENTA}━━━ Environment Details ━━━${NC}"
echo ""

prompt_input "Operating System (e.g., Windows 11, macOS 14):" OS true
prompt_input "Browser & Version (e.g., Chrome 120, Firefox 121):" BROWSER true
prompt_input "Device (e.g., Desktop, iPhone 15):" DEVICE false
prompt_input "Build/Version number:" BUILD true
prompt_input "URL or page where bug occurs:" URL false

# Bug Description
echo ""
echo -e "${MAGENTA}━━━ Bug Description ━━━${NC}"
echo ""

prompt_input "Brief description of the issue:" DESCRIPTION true

# Reproduction Steps
echo ""
echo -e "${MAGENTA}━━━ Steps to Reproduce ━━━${NC}"
echo ""

echo "Enter reproduction steps (one per line, press Enter twice when done):"
REPRO_STEPS=""
STEP_NUM=1
while true; do
    read -r line
    if [ -z "$line" ]; then
        break
    fi
    REPRO_STEPS="${REPRO_STEPS}${STEP_NUM}. ${line}\n"
    ((STEP_NUM++))
done

# Expected vs Actual
echo ""
prompt_input "Expected behavior:" EXPECTED true
prompt_input "Actual behavior:" ACTUAL true

# Additional Info
echo ""
echo -e "${MAGENTA}━━━ Additional Information ━━━${NC}"
echo ""

prompt_input "Console errors (paste if any):" CONSOLE_ERRORS false
prompt_input "Frequency (Always/Sometimes/Rare):" FREQUENCY false
prompt_input "How many users affected (estimate):" USER_IMPACT false
prompt_input "Workaround available? (describe if yes):" WORKAROUND false
prompt_input "Related test case ID:" TEST_CASE false
prompt_input "Figma design link (if UI bug):" FIGMA_LINK false
prompt_input "First noticed (date/build):" FIRST_NOTICED false

FILENAME="${BUG_ID}.md"

OUTPUT_DIR="."
if [ ! -z "$1" ]; then
    OUTPUT_DIR="$1"
fi

OUTPUT_FILE="$OUTPUT_DIR/$FILENAME"

echo ""
echo -e "${BLUE}Generating bug report...${NC}"
echo ""

cat > "$OUTPUT_FILE" << EOF
# ${BUG_ID}: ${BUG_TITLE}

**Severity:** ${SEVERITY}
**Priority:** ${PRIORITY}
**Type:** ${TEST_TYPE:-Functional}
**Status:** Open
**Reported:** $(date +%Y-%m-%d)
**Reporter:** [Your Name]

---

## Environment

- **OS:** ${OS}
- **Browser:** ${BROWSER}
- **Device:** ${DEVICE:-Desktop}
- **Build:** ${BUILD}
- **URL:** ${URL:-N/A}

---

## Description

${DESCRIPTION}

---

## Steps to Reproduce

${REPRO_STEPS}

---

## Expected Behavior

${EXPECTED}

---

## Actual Behavior

${ACTUAL}

---

## Visual Evidence

- [ ] Screenshot attached
- [ ] Screen recording attached
- [ ] Console logs attached

**Console Errors:**
\`\`\`
${CONSOLE_ERRORS:-None}
\`\`\`

---

## Impact

- **Frequency:** ${FREQUENCY:-Unknown}
- **User Impact:** ${USER_IMPACT:-Unknown}
- **Workaround:** ${WORKAROUND:-None available}

---

## Additional Context

${FIGMA_LINK:+**Figma Design:** ${FIGMA_LINK}}

${TEST_CASE:+**Related Test Case:** ${TEST_CASE}}

${FIRST_NOTICED:+**First Noticed:** ${FIRST_NOTICED}}

**Is this a regression?** [Yes/No - if yes, since when]

---

## Root Cause

[To be filled by developer]

---

## Fix

[To be filled by developer]

---

## Verification

- [ ] Bug fix verified in dev environment
- [ ] Regression testing completed
- [ ] Related test cases passing
- [ ] Ready for release

**Verified By:** ___________
**Date:** ___________

---

## Comments

[Discussion and updates]

EOF

echo -e "${GREEN}✅ Bug report generated successfully!${NC}"
echo ""
echo -e "File location: ${BLUE}$OUTPUT_FILE${NC}"
echo ""
echo -e "${RED}⚠️  IMPORTANT NEXT STEPS:${NC}"
echo "1. Attach screenshots/screen recordings"
echo "2. Add console errors if available"
echo "3. Verify reproduction steps work"
echo "4. Submit to bug tracking system"
if [ -n "$FIGMA_LINK" ]; then
    echo "5. Verify against Figma design"
fi
echo ""
echo -e "${CYAN}Tip: Clear, reproducible steps = faster fixes${NC}"
echo ""
