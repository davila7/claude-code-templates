---
name: senior-backend
description: Comprehensive backend development skill for building scalable backend systems using NodeJS, Express, Go, Python, Postgres, GraphQL, REST APIs. Includes API scaffolding, database optimization, security implementation, and performance tuning. Use when designing APIs, optimizing database queries, implementing business logic, handling authentication/authorization, or reviewing backend code.
---

# Senior Backend

Complete toolkit for senior backend with modern tools and best practices.

## Quick Start

### Main Capabilities

This skill provides three core capabilities through automated scripts:

```bash
# Script 1: Api Scaffolder
python scripts/api_scaffolder.py [options]

# Script 2: Database Migration Tool
python scripts/database_migration_tool.py [options]

# Script 3: Api Load Tester
python scripts/api_load_tester.py [options]
```

## Core Capabilities

### 1. Api Scaffolder

Automated tool for api scaffolder tasks.

**Features:**
- Automated scaffolding
- Best practices built-in
- Configurable templates
- Quality checks

**Usage:**
```bash
python scripts/api_scaffolder.py <project-path> [options]
```

### 2. Database Migration Tool

Comprehensive analysis and optimization tool.

**Features:**
- Deep analysis
- Performance metrics
- Recommendations
- Automated fixes

**Usage:**
```bash
python scripts/database_migration_tool.py <target-path> [--verbose]
```

### 3. Api Load Tester

Advanced tooling for specialized tasks.

**Features:**
- Expert-level automation
- Custom configurations
- Integration ready
- Production-grade output

**Usage:**
```bash
python scripts/api_load_tester.py [arguments] [options]
```

## Reference Documentation

### Api Design Patterns

Comprehensive guide available in `references/api_design_patterns.md`:

- Detailed patterns and practices
- Code examples
- Best practices
- Anti-patterns to avoid
- Real-world scenarios

### Database Optimization Guide

Complete workflow documentation in `references/database_optimization_guide.md`:

- Step-by-step processes
- Optimization strategies
- Tool integrations
- Performance tuning
- Troubleshooting guide

### Backend Security Practices

Technical reference guide in `references/backend_security_practices.md`:

- Technology stack details
- Configuration examples
- Integration patterns
- Security considerations
- Scalability guidelines

## Tech Stack

**Languages:** TypeScript, JavaScript, Python, Go, Swift, Kotlin
**Frontend:** React, Next.js, React Native, Flutter
**Backend:** Node.js, Express, GraphQL, REST APIs
**Database:** PostgreSQL, Prisma, NeonDB, Supabase
**DevOps:** Docker, Kubernetes, Terraform, GitHub Actions, CircleCI
**Cloud:** AWS, GCP, Azure

## Development Workflow

### 1. Setup and Configuration

```bash
# Install dependencies
npm install
# or
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

### 2. Run Quality Checks

```bash
# Use the analyzer script
python scripts/database_migration_tool.py .

# Review recommendations
# Apply fixes
```

### 3. Implement Best Practices

Follow the patterns and practices documented in:
- `references/api_design_patterns.md`
- `references/database_optimization_guide.md`
- `references/backend_security_practices.md`

## Best Practices Summary

### Code Quality
- Follow established patterns
- Write comprehensive tests
- Document decisions
- Review regularly

### Performance
- Measure before optimizing
- Use appropriate caching
- Optimize critical paths
- Monitor in production

### Security
- Validate all inputs
- Use parameterized queries
- Implement proper authentication
- Keep dependencies updated

### Maintainability
- Write clear code
- Use consistent naming
- Add helpful comments
- Keep it simple

## Common Commands

```bash
# Development
npm run dev
npm run build
npm run test
npm run lint

# Analysis
python scripts/database_migration_tool.py .
python scripts/api_load_tester.py --analyze

# Deployment
docker build -t app:latest .
docker-compose up -d
kubectl apply -f k8s/
```

## Troubleshooting

### Common Issues

Check the comprehensive troubleshooting section in `references/backend_security_practices.md`.

### Getting Help

- Review reference documentation
- Check script output messages
- Consult tech stack documentation
- Review error logs

## Resources

- Pattern Reference: `references/api_design_patterns.md`
- Workflow Guide: `references/database_optimization_guide.md`
- Technical Guide: `references/backend_security_practices.md`
- Tool Scripts: `scripts/` directory
