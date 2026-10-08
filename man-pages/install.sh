#!/bin/bash
# Installation script for Claude Code Skills man pages

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAN_DIR="$SCRIPT_DIR/man1"
PREFIX="skill"

# Functions
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  Claude Code Skills - Man Pages Installer${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}→${NC} $1"
}

check_dependencies() {
    print_info "Checking dependencies..."
    
    if ! command -v python3 &> /dev/null; then
        print_error "python3 is required but not installed."
        exit 1
    fi
    
    if ! command -v make &> /dev/null; then
        print_error "make is required but not installed."
        exit 1
    fi
    
    print_success "All dependencies found"
}

build_man_pages() {
    print_info "Building man pages..."
    
    cd "$SCRIPT_DIR"
    
    if [ "$COMPRESS" = true ]; then
        make compress
    else
        make all
    fi
    
    # Count generated pages
    if [ "$COMPRESS" = true ]; then
        COUNT=$(ls -1 "$MAN_DIR"/*.1.gz 2>/dev/null | wc -l)
    else
        COUNT=$(ls -1 "$MAN_DIR"/*.1 2>/dev/null | wc -l)
    fi
    
    print_success "Built $COUNT man pages"
}

install_user() {
    print_info "Installing man pages to user directory..."
    
    USER_MAN_DIR="$HOME/.local/share/man/man1"
    mkdir -p "$USER_MAN_DIR"
    
    if [ "$COMPRESS" = true ]; then
        cp "$MAN_DIR"/*.1.gz "$USER_MAN_DIR/"
    else
        cp "$MAN_DIR"/*.1 "$USER_MAN_DIR/"
    fi
    
    print_success "Installed to $USER_MAN_DIR"
    
    # Update MANPATH if needed
    if [[ ":$MANPATH:" != *":$HOME/.local/share/man:"* ]]; then
        echo ""
        print_info "Add this to your ~/.bashrc or ~/.zshrc:"
        echo -e "${YELLOW}export MANPATH=\"\$HOME/.local/share/man:\$MANPATH\"${NC}"
    fi
}

install_system() {
    print_info "Installing man pages system-wide (requires sudo)..."
    
    sudo mkdir -p /usr/local/share/man/man1
    
    if [ "$COMPRESS" = true ]; then
        sudo cp "$MAN_DIR"/*.1.gz /usr/local/share/man/man1/
    else
        sudo cp "$MAN_DIR"/*.1 /usr/local/share/man/man1/
    fi
    
    # Update man database
    if command -v mandb &> /dev/null; then
        sudo mandb -q
    fi
    
    print_success "Installed system-wide to /usr/local/share/man/man1"
}

uninstall_user() {
    print_info "Uninstalling man pages from user directory..."
    
    USER_MAN_DIR="$HOME/.local/share/man/man1"
    rm -f "$USER_MAN_DIR/${PREFIX}-"*.1
    rm -f "$USER_MAN_DIR/${PREFIX}-"*.1.gz
    
    print_success "Uninstalled from user directory"
}

uninstall_system() {
    print_info "Uninstalling man pages from system (requires sudo)..."
    
    sudo rm -f "/usr/local/share/man/man1/${PREFIX}-"*.1
    sudo rm -f "/usr/local/share/man/man1/${PREFIX}-"*.1.gz
    
    if command -v mandb &> /dev/null; then
        sudo mandb -q
    fi
    
    print_success "Uninstalled from system"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Install Claude Code Skills as Linux man pages.

OPTIONS:
    --user              Install to user directory (~/.local/share/man)
    --system            Install system-wide (/usr/local/share/man) [requires sudo]
    --compress          Compress man pages with gzip (saves space)
    --uninstall-user    Remove from user directory
    --uninstall-system  Remove from system [requires sudo]
    --build-only        Only build man pages, don't install
    --help              Show this help message

EXAMPLES:
    $0 --user                    # Install for current user
    $0 --user --compress         # Install compressed for current user
    $0 --system                  # Install system-wide (all users)
    $0 --build-only              # Just build, don't install
    $0 --uninstall-user          # Remove user installation

After installation, use:
    man skill-<name>             # View a skill man page
    man -k skill                 # Search for skills
    apropos skill                # Alternative search

EOF
}

test_installation() {
    print_info "Testing installation..."
    
    # Test a few man pages
    TEST_PAGES=("skill-file-organizer" "skill-code-reviewer" "skill-seo-optimizer")
    
    for page in "${TEST_PAGES[@]}"; do
        if man -w "$page" &> /dev/null; then
            print_success "$page is accessible"
        else
            print_info "$page not found (this is OK if not all pages were installed)"
        fi
    done
}

list_skills() {
    echo ""
    print_info "Installed skills (sample):"
    
    if [ -d "$MAN_DIR" ]; then
        if ls "$MAN_DIR"/*.1 &> /dev/null; then
            ls "$MAN_DIR"/*.1 | head -10 | xargs -n1 basename | sed 's/\.1$//' | sed 's/^/  - /'
        elif ls "$MAN_DIR"/*.1.gz &> /dev/null; then
            ls "$MAN_DIR"/*.1.gz | head -10 | xargs -n1 basename | sed 's/\.1\.gz$//' | sed 's/^/  - /'
        fi
        
        TOTAL=$(find "$MAN_DIR" -name "*.1*" | wc -l)
        echo ""
        echo -e "  ${GREEN}Total: $TOTAL skills${NC}"
    fi
}

# Main script
main() {
    print_header
    
    # Parse arguments
    MODE=""
    COMPRESS=false
    
    if [ $# -eq 0 ]; then
        show_usage
        exit 0
    fi
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --user)
                MODE="user"
                shift
                ;;
            --system)
                MODE="system"
                shift
                ;;
            --compress)
                COMPRESS=true
                shift
                ;;
            --uninstall-user)
                uninstall_user
                exit 0
                ;;
            --uninstall-system)
                uninstall_system
                exit 0
                ;;
            --build-only)
                MODE="build"
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Execute based on mode
    check_dependencies
    
    build_man_pages
    
    if [ "$MODE" = "user" ]; then
        install_user
        test_installation
    elif [ "$MODE" = "system" ]; then
        install_system
        test_installation
    elif [ "$MODE" = "build" ]; then
        print_success "Build complete!"
    fi
    
    list_skills
    
    echo ""
    print_success "Installation complete!"
    echo ""
    print_info "Try it out:"
    echo -e "  ${YELLOW}man skill-file-organizer${NC}"
    echo -e "  ${YELLOW}man -k skill${NC}"
    echo -e "  ${YELLOW}apropos skill | head${NC}"
    echo ""
}

# Run main
main "$@"

