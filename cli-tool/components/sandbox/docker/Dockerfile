# syntax=docker/dockerfile:1
FROM node:22-alpine

# Install runtime dependencies
RUN apk --no-cache add \
    git \
    bash \
    python3 \
    py3-pip \
    curl \
    && npm install -g @anthropic-ai/claude-agent-sdk

# Create non-root user for security
RUN adduser -u 10001 -D -s /bin/bash sandboxuser

# Set working directory
WORKDIR /app

# Create output directory
RUN mkdir -p /output && chown sandboxuser:sandboxuser /output

# Copy execution script
COPY execute.js /app/execute.js
COPY package.json /app/package.json

# Install dependencies
RUN npm install --production && \
    chown -R sandboxuser:sandboxuser /app

# Switch to non-root user
USER sandboxuser

# Set environment
ENV HOME=/home/sandboxuser
ENV NODE_ENV=production

# Default command (overridden by launcher)
CMD ["node", "/app/execute.js"]
