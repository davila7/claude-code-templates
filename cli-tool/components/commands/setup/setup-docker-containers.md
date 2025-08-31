---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [environment-type] | --development | --production | --microservices | --compose
description: Setup Docker containerization with multi-stage builds and development workflows
model: sonnet
---

# Setup Docker Containers

Setup comprehensive Docker containerization for development and production: **$ARGUMENTS**

## Current Project State

- Application type: @package.json or @requirements.txt (detect Node.js, Python, etc.)
- Existing Docker: @Dockerfile or @docker-compose.yml (if exists)
- Dependencies: !`find . -name "package-lock.json" -o -name "poetry.lock" -o -name "Pipfile.lock" | wc -l`
- Services needed: Database, cache, message queue detection from configs

## Task

Implement production-ready Docker containerization with optimized builds and development workflows:

**Environment Type**: Use $ARGUMENTS to specify development, production, microservices, or Docker Compose setup

**Containerization Strategy**:
1. **Dockerfile Creation** - Multi-stage builds, layer optimization, security best practices
2. **Development Workflow** - Hot reloading, volume mounts, debugging capabilities
3. **Production Optimization** - Image size reduction, security scanning, health checks
4. **Multi-Service Setup** - Docker Compose, service discovery, networking configuration
5. **CI/CD Integration** - Build automation, registry management, deployment pipelines
6. **Monitoring & Logs** - Container observability, log aggregation, resource monitoring

**Security Features**: Non-root users, minimal base images, vulnerability scanning, secrets management.

**Performance Optimization**: Layer caching, build contexts, multi-platform builds, and resource constraints.

**Output**: Complete Docker setup with optimized containers, development workflows, production deployment, and comprehensive documentation.