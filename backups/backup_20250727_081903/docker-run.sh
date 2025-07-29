#!/bin/bash

# Docker run helper script for Claude Code Templates

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Claude Code Templates - Docker Runner${NC}"
echo "======================================"

# Function to display usage
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  setup              Run interactive setup for your project"
    echo "  analytics          Start the analytics dashboard (port 3333)"
    echo "  health             Run health check"
    echo "  quick-setup        Quick setup with options (e.g., --language python --framework django)"
    echo "  bash               Open bash shell in container"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 analytics"
    echo "  $0 quick-setup --language javascript-typescript --framework react --yes"
    echo ""
    exit 1
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

# Build the Docker image if it doesn't exist
if [[ "$(docker images -q claude-code-templates:latest 2> /dev/null)" == "" ]]; then
    echo -e "${YELLOW}Building Docker image...${NC}"
    docker build -t claude-code-templates:latest .
fi

# Get the command
COMMAND=${1:-setup}
shift

# Get current directory for volume mounting
CURRENT_DIR=$(pwd)

case $COMMAND in
    setup)
        echo -e "${GREEN}Starting interactive setup...${NC}"
        docker run -it --rm \
            -v "$CURRENT_DIR:/project" \
            -v "$HOME/.claude:/root/.claude" \
            claude-code-templates:latest \
            node /app/bin/create-claude-config.js
        ;;
    
    analytics)
        echo -e "${GREEN}Starting analytics dashboard on http://localhost:3333${NC}"
        docker run -d --rm \
            --name claude-analytics \
            -p 3333:3333 \
            -v "$HOME/.claude:/root/.claude:ro" \
            claude-code-templates:latest \
            node /app/src/analytics.js
        echo "Analytics dashboard is running. Access it at http://localhost:3333"
        echo "To stop: docker stop claude-analytics"
        ;;
    
    health)
        echo -e "${GREEN}Running health check...${NC}"
        docker run -it --rm \
            -v "$CURRENT_DIR:/project" \
            -v "$HOME/.claude:/root/.claude" \
            claude-code-templates:latest \
            node /app/bin/create-claude-config.js --health-check
        ;;
    
    quick-setup)
        echo -e "${GREEN}Running quick setup with options...${NC}"
        docker run -it --rm \
            -v "$CURRENT_DIR:/project" \
            -v "$HOME/.claude:/root/.claude" \
            claude-code-templates:latest \
            node /app/bin/create-claude-config.js "$@"
        ;;
    
    bash)
        echo -e "${GREEN}Opening bash shell in container...${NC}"
        docker run -it --rm \
            -v "$CURRENT_DIR:/project" \
            -v "$HOME/.claude:/root/.claude" \
            claude-code-templates:latest \
            /bin/bash
        ;;
    
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        usage
        ;;
esac