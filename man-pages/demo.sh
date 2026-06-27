#!/bin/bash
# Demo script to showcase Claude Code Skills man pages

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

clear

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}║     Claude Code Skills - Man Pages Demo                   ║${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

sleep 1

echo -e "${GREEN}✓${NC} 257 Claude Code Skills converted to Linux man pages"
echo ""
sleep 1

echo -e "${CYAN}Demo 1: Viewing a skill man page${NC}"
echo -e "${YELLOW}Command:${NC} man skill-file-organizer"
echo ""
echo "Press Enter to view the man page (press 'q' to exit)..."
read -r

man ./man1/skill-file-organizer.1

clear

echo -e "${CYAN}Demo 2: Searching for skills${NC}"
echo -e "${YELLOW}Command:${NC} ls man1/ | grep -E '(pdf|seo|code)' | head -10"
echo ""
sleep 1

ls man1/ | grep -E '(pdf|seo|code)' | head -10 | sed 's/\.1$//' | sed 's/^/  • /'
echo ""
sleep 2

echo -e "${CYAN}Demo 3: Quick preview of multiple skills${NC}"
echo ""
sleep 1

SKILLS=("skill-code-reviewer" "skill-seo-optimizer" "skill-pdf-processing-pro")

for skill in "${SKILLS[@]}"; do
    echo -e "${YELLOW}═══ $skill ═══${NC}"
    man ./man1/${skill}.1 | head -15 | tail -10
    echo ""
    sleep 1
done

echo -e "${CYAN}Demo 4: Statistics${NC}"
echo ""
sleep 1

echo "Total man pages: $(ls man1/*.1 | wc -l)"
echo "Total size (uncompressed): $(du -sh man1/ | cut -f1)"
echo ""

echo "Top categories:"
for category in development scientific business-marketing productivity; do
    count=$(ls man1/ | grep -i "$category" | wc -l)
    if [ "$count" -gt 0 ]; then
        printf "  %-25s %3d skills\n" "$category" "$count"
    fi
done
echo ""
sleep 2

echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Installation Options:${NC}"
echo ""
echo "  1. User installation (recommended):"
echo -e "     ${YELLOW}./install.sh --user${NC}"
echo ""
echo "  2. System-wide installation:"
echo -e "     ${YELLOW}./install.sh --system${NC}"
echo ""
echo "  3. Build only (no installation):"
echo -e "     ${YELLOW}./install.sh --build-only${NC}"
echo ""
echo -e "${GREEN}Usage After Installation:${NC}"
echo ""
echo -e "  ${YELLOW}man skill-file-organizer${NC}     # View a skill"
echo -e "  ${YELLOW}man -k skill${NC}                 # Search all skills"
echo -e "  ${YELLOW}apropos pdf${NC}                  # Find PDF-related skills"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Demo complete! 🎉"
echo ""

