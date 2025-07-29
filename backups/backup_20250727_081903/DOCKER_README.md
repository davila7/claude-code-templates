# Running Claude Code Templates with Docker

This guide explains how to run Claude Code Templates in a Docker container.

## Quick Start

### Option 1: Using docker-run.sh (Easiest)

```bash
# Make the script executable
chmod +x docker-run.sh

# Run interactive setup
./docker-run.sh setup

# Start analytics dashboard
./docker-run.sh analytics

# Run health check
./docker-run.sh health

# Quick setup with options
./docker-run.sh quick-setup --language python --framework django --yes
```

### Option 2: Using Docker Compose

```bash
# Build and run interactive setup
docker-compose run --rm claude-code-templates

# Start analytics dashboard in background
docker-compose up -d analytics

# Run health check
docker-compose run --rm health-check

# View logs
docker-compose logs -f analytics
```

### Option 3: Using Docker directly

```bash
# Build the image
docker build -t claude-code-templates:latest .

# Run interactive setup
docker run -it --rm \
  -v $(pwd):/project \
  -v ~/.claude:/root/.claude \
  claude-code-templates:latest

# Run with specific options
docker run -it --rm \
  -v $(pwd):/project \
  claude-code-templates:latest \
  node /app/bin/create-claude-config.js --language python --framework django --yes

# Start analytics dashboard
docker run -d --rm \
  --name claude-analytics \
  -p 3333:3333 \
  -v ~/.claude:/root/.claude:ro \
  claude-code-templates:latest \
  node /app/src/analytics.js
```

## Volume Mounts

The Docker setup uses two main volume mounts:

1. **Project Directory** (`/project`): Your current working directory where Claude Code configurations will be created
2. **Claude Config** (`~/.claude`): Your home directory's Claude configuration (optional, for existing configs)

## Available Services

### 1. CLI Tool (claude-code-templates)
- Interactive setup wizard
- Framework detection
- Configuration generation

### 2. Analytics Dashboard (analytics)
- Real-time monitoring
- Available at http://localhost:3333
- Read-only access to Claude data

### 3. Health Check (health-check)
- System validation
- Configuration verification
- One-time execution

## Environment Variables

You can customize behavior with environment variables:

```bash
# Enable debug logging
docker run -it --rm \
  -e DEBUG=true \
  -v $(pwd):/project \
  claude-code-templates:latest

# Change analytics port
docker run -d --rm \
  -e PORT=8080 \
  -p 8080:8080 \
  claude-code-templates:latest \
  node /app/src/analytics.js
```

## Troubleshooting

### Permission Issues
If you encounter permission issues with created files:

```bash
# Run with your user ID
docker run -it --rm \
  --user $(id -u):$(id -g) \
  -v $(pwd):/project \
  claude-code-templates:latest
```

### Container Won't Start
```bash
# Check logs
docker-compose logs claude-code-templates

# Rebuild image
docker-compose build --no-cache
```

### Analytics Dashboard Not Accessible
```bash
# Check if port 3333 is already in use
lsof -i :3333

# Use a different port
docker run -d --rm \
  -p 8080:3333 \
  claude-code-templates:latest \
  node /app/src/analytics.js
```

## Development Mode

For development, you can mount the source code:

```bash
docker run -it --rm \
  -v $(pwd)/cli-tool:/app \
  -v $(pwd)/templates:/app/templates \
  -v $(pwd):/project \
  claude-code-templates:latest \
  /bin/bash
```

## Cleanup

```bash
# Stop all containers
docker-compose down

# Remove the image
docker rmi claude-code-templates:latest

# Remove all related containers
docker rm -f $(docker ps -a -q -f name=claude)
```