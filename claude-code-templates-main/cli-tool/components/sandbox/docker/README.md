# Docker Claude Code Sandbox

Execute Claude Code in isolated Docker containers with AI-powered code generation using the Claude Agent SDK.

## Quick Start

### 1. Install Docker

Ensure Docker is installed and running on your system:

```bash
# Check Docker installation
docker --version

# Verify Docker daemon is running
docker ps
```

If Docker is not installed, visit: https://docs.docker.com/get-docker/

### 2. Configure API Key

Set your Anthropic API key:

```bash
# Set as environment variable
export ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# Or pass directly when using the CLI
npx claude-code-templates@latest --sandbox docker \
  --agent development/frontend-developer \
  --prompt "Create a React component" \
  --anthropic-api-key sk-ant-your-key
```

### 3. Run Your First Sandbox

```bash
# Basic execution
npx claude-code-templates@latest --sandbox docker \
  --prompt "Write a function to calculate factorial"

# With specific agent
npx claude-code-templates@latest --sandbox docker \
  --agent development/python-developer \
  --prompt "Create a data validation script"

# With multiple components
npx claude-code-templates@latest --sandbox docker \
  --agent development/fullstack-developer \
  --command development/setup-testing \
  --prompt "Set up a complete testing environment"
```

## Architecture

This sandbox combines two powerful technologies:

1. **Claude Agent SDK** - Provides programmatic access to Claude Code
2. **Docker** - Provides isolated container execution

```
User Prompt → Docker Launcher → Container Build → Execute Script → Claude Agent SDK → Output Files
```

### Components

```
docker/
├── docker-launcher.js   # Node.js launcher that orchestrates Docker
├── Dockerfile           # Container definition with Claude Agent SDK
├── execute.js           # Script that runs inside container
├── package.json         # Dependencies (Claude Agent SDK)
└── README.md           # This file
```

## How It Works

### 1. Launcher Phase (docker-launcher.js)
- Checks Docker installation and daemon status
- Builds container image if it doesn't exist
- Prepares environment variables and volume mounts
- Launches container with user prompt

### 2. Container Phase (execute.js)
- Installs requested components (agents, commands, MCPs, etc.)
- Executes Claude Agent SDK with the user's prompt
- Auto-allows all tool uses (no permission prompts)
- Captures output and generated files
- Copies results to mounted output directory

### 3. Output Phase
- Generated files are saved to `output/` directory
- Files preserve directory structure
- Accessible on host machine for inspection

## Usage Examples

### Simple Code Generation

```bash
npx claude-code-templates@latest --sandbox docker \
  --prompt "Create a REST API server with Express.js"
```

### With Specific Agent

```bash
npx claude-code-templates@latest --sandbox docker \
  --agent security/security-auditor \
  --prompt "Audit this codebase for security vulnerabilities"
```

### Multiple Components

```bash
npx claude-code-templates@latest --sandbox docker \
  --agent development/frontend-developer \
  --command testing/setup-testing \
  --setting performance/performance-optimization \
  --prompt "Create a React app with testing setup"
```

### Development Workflow

```bash
# 1. Generate initial code
npx claude-code-templates@latest --sandbox docker \
  --agent development/fullstack-developer \
  --prompt "Create a blog API with authentication"

# 2. Check output
ls -la output/

# 3. Iterate on generated code
npx claude-code-templates@latest --sandbox docker \
  --prompt "Add pagination to the blog API"
```

## Configuration

### Environment Variables

**Required:**
- `ANTHROPIC_API_KEY` - Your Anthropic API key

**Optional:**
- `DOCKER_BUILDKIT=1` - Enable BuildKit for faster builds

### Docker Image Details

The Docker image (`claude-sandbox`) includes:

- **Base**: Node.js 22 Alpine Linux (minimal, secure)
- **Runtime**: Git, Bash, Python3, Pip, Curl
- **Claude SDK**: `@anthropic-ai/claude-agent-sdk` installed globally
- **Security**: Runs as non-root user (UID 10001)
- **Working Directory**: `/app`
- **Output Directory**: `/output` (mounted as volume)

### Build Configuration

Edit `Dockerfile` to customize:

```dockerfile
# Add additional system dependencies
RUN apk --no-cache add postgresql-client redis

# Install additional global npm packages
RUN npm install -g typescript tsx

# Set custom environment variables
ENV CUSTOM_VAR=value
```

## Command Reference

### Build Image Manually

```bash
cd .claude/sandbox/docker
docker build -t claude-sandbox .
```

### Run Container Directly

```bash
docker run --rm \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd)/output:/output \
  claude-sandbox \
  node /app/execute.js "Your prompt here" ""
```

### Clean Up

```bash
# Remove built image
docker rmi claude-sandbox

# Remove all stopped containers
docker container prune

# Remove dangling images
docker image prune
```

## Troubleshooting

### Docker Not Found

**Error:** `Docker is not installed`

**Solution:**
```bash
# Install Docker from official site
# macOS: https://docs.docker.com/desktop/install/mac-install/
# Linux: https://docs.docker.com/engine/install/
# Windows: https://docs.docker.com/desktop/install/windows-install/
```

### Docker Daemon Not Running

**Error:** `Docker daemon is not running`

**Solution:**
```bash
# macOS/Windows: Start Docker Desktop application
# Linux: sudo systemctl start docker
```

### API Key Not Set

**Error:** `ANTHROPIC_API_KEY environment variable is required`

**Solution:**
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Build Failures

**Error:** Failed to build Docker image

**Solution:**
```bash
# Check Docker logs
docker logs <container-id>

# Rebuild from scratch
docker build --no-cache -t claude-sandbox .

# Check disk space
docker system df
```

### Permission Issues

**Error:** Permission denied when accessing output files

**Solution:**
```bash
# Check output directory permissions
ls -la output/

# Fix permissions (if needed)
sudo chown -R $USER:$USER output/
```

### Container Execution Failures

**Error:** Container failed with code 1

**Solution:**
```bash
# Run container interactively for debugging
docker run -it --rm \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  claude-sandbox \
  /bin/bash

# Check container logs
docker logs <container-id>
```

## Performance Tips

1. **Image Caching**: First build takes longer, subsequent builds are fast
2. **Volume Mounts**: Use volumes instead of COPY for faster iteration
3. **Layer Optimization**: Group RUN commands to reduce image layers
4. **BuildKit**: Enable for parallel builds (`DOCKER_BUILDKIT=1`)
5. **Prune Regularly**: Clean up unused images and containers

## Security

- **Isolation**: Containers are isolated from host system
- **Non-root User**: Execution runs as `sandboxuser` (UID 10001)
- **No Network**: Container has no internet access (except during build)
- **Read-only**: Host filesystem is mounted read-only
- **Resource Limits**: Docker enforces CPU and memory limits
- **Secret Management**: API keys are passed as environment variables (not stored in image)

## Cost Estimation

**Docker:**
- Free and open-source
- No cloud costs (runs locally)
- Resource usage: ~500MB disk space, ~512MB RAM during execution

**Anthropic API:**
- Claude Sonnet 4.5: ~$3 per million input tokens
- Average request: ~200 tokens = $0.0006 per request

**Example costs for 100 executions:**
- Docker: $0 (local execution)
- Anthropic: ~$0.06 (avg 200 tokens/request)
- **Total: ~$0.06**

## Comparison with Other Providers

| Feature | Docker | E2B | Cloudflare |
|---------|--------|-----|------------|
| Execution Location | 🏠 Local | ☁️ Cloud | 🌍 Edge |
| Setup Complexity | Medium | Easy | Easy |
| Internet Required | Setup only | Yes | Yes |
| Cost | Free | Paid | Paid |
| Privacy | Full control | Third-party | Third-party |
| Offline Support | Yes | No | No |
| Best For | Local dev, privacy, offline | Full stack projects | Serverless, global APIs |

## Development

### Project Structure

```
docker/
├── docker-launcher.js   # Orchestrates container lifecycle
│   ├── checkDockerInstalled()
│   ├── checkDockerRunning()
│   ├── buildDockerImage()
│   └── runDockerContainer()
├── Dockerfile           # Container definition
│   ├── Base image (Node 22 Alpine)
│   ├── System dependencies
│   ├── Claude Agent SDK
│   └── Security (non-root user)
├── execute.js           # Execution script (runs in container)
│   ├── installComponents()
│   ├── executeQuery()
│   └── copyGeneratedFiles()
├── package.json         # NPM dependencies
└── README.md           # Documentation
```

### Scripts

```bash
# Build image
npm run build

# Clean image
npm run clean
```

### Extending the Image

Add custom tools to the Dockerfile:

```dockerfile
# Install Python packages
RUN pip install --no-cache-dir pandas numpy matplotlib

# Install Node.js packages globally
RUN npm install -g typescript eslint prettier

# Add custom scripts
COPY scripts/ /app/scripts/
```

## Advanced Usage

### Custom Dockerfile

Create a custom Dockerfile for specialized environments:

```dockerfile
FROM node:22-alpine

# Install database clients
RUN apk add --no-cache postgresql-client mysql-client

# Install development tools
RUN apk add --no-cache vim nano tmux

# Install Claude Agent SDK
RUN npm install -g @anthropic-ai/claude-agent-sdk

# ... rest of configuration
```

### Multi-stage Builds

Optimize image size with multi-stage builds:

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci --only=production

# Runtime stage
FROM node:22-alpine
COPY --from=builder /build/node_modules ./node_modules
# ... rest of configuration
```

### Persistent Storage

Mount additional volumes for persistent data:

```bash
docker run --rm \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd)/output:/output \
  -v $(pwd)/cache:/cache \
  claude-sandbox
```

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Container Security](https://docs.docker.com/engine/security/)

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
1. Check Docker installation: `docker --version && docker ps`
2. Verify API key: `echo $ANTHROPIC_API_KEY`
3. Check container logs: `docker logs <container-id>`
4. Review output directory: `ls -la output/`
5. Open an issue on GitHub

---

Built with ❤️ using Docker, Node.js, and Claude Agent SDK
