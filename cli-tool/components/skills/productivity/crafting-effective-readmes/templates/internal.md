# Internal/Work Project README Template

Use this template for team codebases, services, and internal tools.
Focus on onboarding new team members and operational knowledge.

---

# [Service/Project Name]

[One-line description of what this service does]

**Team**: [Team name or slack channel]  
**On-call**: [Rotation or contact info]

## Overview

[2-3 sentences on what this does, why it exists, and where it fits in the system architecture.]

### Dependencies

- **Upstream**: [Services this depends on]
- **Downstream**: [Services that depend on this]

## Local Development Setup

### Prerequisites

- [Required tool 1 with version]
- [Required tool 2]
- Access to [internal system/VPN/etc]

### Environment Variables

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `DATABASE_URL` | [Description] | [1Password/Vault/etc] |
| `API_KEY` | [Description] | [Where to find] |

### Running Locally

```bash
[Step-by-step commands to get running]
```

### Running Tests

```bash
[Test commands]
```

## Architecture

[Brief description of system design. Link to architecture diagrams if they exist.]

```
[Simple ASCII diagram if helpful]
```

### Key Files

| Path | Purpose |
|------|---------|
| `src/[important-file]` | [What it does] |
| `config/` | [Configuration files] |

## Deployment

[How to deploy, or link to deployment docs]

### Environments

| Environment | URL | Notes |
|-------------|-----|-------|
| Development | [URL] | [Notes] |
| Staging | [URL] | [Notes] |
| Production | [URL] | [Notes] |

## Runbooks

### [Common Task 1]

```bash
[Commands or steps]
```

### [Common Task 2]

[Steps]

## Troubleshooting

### [Common Problem 1]

**Symptom**: [What you see]  
**Cause**: [Why it happens]  
**Fix**: [How to resolve]

## Contributing

[Link to team contribution guidelines or PR process]

## Related Docs

- [Link to design doc]
- [Link to API docs]
- [Link to monitoring dashboard]
