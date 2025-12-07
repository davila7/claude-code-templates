# Security-hardened Docker image for claude-code-templates chats-mobile server
#
# SECURITY FEATURES:
# - Runs as non-root user
# - No curl/wget (prevents exfiltration tools)
# - Minimal base image (node:20-slim)
# - Clean apt caches removed
#
# Use with docker-compose.yml for full security hardening including:
# - Network isolation (no internet access)
# - Read-only filesystem
# - All capabilities dropped
# - No privilege escalation

FROM node:20-slim

# Security: No additional packages installed - curl removed to prevent exfiltration tools
# Clean apt cache
RUN rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Accept build argument for user ID (allows matching host user for volume permissions)
ARG USER_ID=1000

# Create a non-root user with the specified UID
RUN useradd -m -u ${USER_ID} -s /bin/bash appuser && \
    mkdir -p /home/appuser/.claude && \
    chown -R appuser:appuser /home/appuser

# Install claude-code-templates globally
# Using global install avoids npx network calls at runtime
RUN npm install -g claude-code-templates@1.28.3

# Switch to non-root user (security best practice)
USER appuser

# Expose port 9876 (the port used by --chats)
EXPOSE 9876

# Direct execution using global install
CMD ["claude-code-templates", "--chats"]
