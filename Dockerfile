# Claude Code Templates - Production Docker Image
# This Dockerfile creates a lightweight container for running Claude Code analytics
# with memory optimizations to prevent OOM errors when processing large conversation histories

# Use Node.js 20 LTS Alpine for minimal size (185MB vs 1GB+ for full Node image)
FROM node:20-alpine

# Install essential dependencies only
# - bash: Required for some npm scripts and better shell experience
# - git: Needed for git-based project detection
# - openssh: Required for git operations over SSH
# - make: Build tool for native dependencies
RUN apk add --no-cache \
    bash \
    git \
    openssh \
    make

# Set application directory
WORKDIR /app

# Copy package files first for better Docker layer caching
# This allows Docker to skip npm install if dependencies haven't changed
COPY cli-tool/package*.json ./

# Install production dependencies only to reduce image size
# --omit=dev: Skip devDependencies (saves ~50MB)
# --legacy-peer-deps: Handle peer dependency conflicts in older packages
RUN npm ci --omit=dev --legacy-peer-deps

# Copy application code
COPY cli-tool/ .

# Copy configuration files
# These files provide project-specific settings and templates
COPY CLAUDE.md ./
COPY .claude/ ./.claude/
COPY .mcp.json ./

# Make CLI executable
RUN chmod +x /app/bin/create-claude-config.js

# Production environment flag
ENV NODE_ENV=production

# Volume for mounting user's project directory
# Usage: -v /path/to/project:/project
VOLUME ["/project"]

# Default working directory for user's project
WORKDIR /project

# IMPORTANT: Flexible entrypoint for running different commands
# This allows running both the CLI tool and the analytics server:
# - CLI: docker run image (uses default CMD)
# - Analytics: docker run image /app/bin/create-claude-config.js --analytics
# - Custom: docker run image /app/src/analytics.js
ENTRYPOINT ["node"]

# Default command shows help
CMD ["/app/bin/create-claude-config.js", "--help"]