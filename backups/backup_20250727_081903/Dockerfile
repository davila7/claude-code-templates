# Use Node.js 20 LTS as base image (supports Node 14+ requirement)
FROM node:20-alpine

# Install dependencies for better terminal experience
RUN apk add --no-cache \
    bash \
    git \
    openssh \
    make

# Set working directory
WORKDIR /app

# Copy package files
COPY cli-tool/package*.json ./

# Install dependencies (omit dev dependencies and use legacy peer deps)
RUN npm ci --omit=dev --legacy-peer-deps

# Copy the entire cli-tool directory
COPY cli-tool/ .

# Copy other necessary files (if they exist)
COPY CLAUDE.md ./
COPY .claude/ ./.claude/
COPY .mcp.json ./

# Make the entry point executable
RUN chmod +x /app/bin/create-claude-config.js

# Set environment variable for non-interactive mode
ENV NODE_ENV=production

# Create a volume for the project directory
VOLUME ["/project"]

# Set the default working directory for the container
WORKDIR /project

# Set entrypoint to the CLI script
ENTRYPOINT ["/app/bin/create-claude-config.js"]

# Default command - show help
CMD ["--help"]