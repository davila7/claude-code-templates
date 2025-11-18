# Architecture Notes

**Last Updated:** November 18, 2025
**Purpose:** Clarify the intentional two-package architecture of claude-code-templates

## Overview

The claude-code-templates repository uses a **deliberate two-package architecture** that may appear confusing at first glance. This document explains why this structure exists and why it is not a bug.

---

## The Two Packages

### Package 1: CLI Tool (npm package)
**Location:** `/cli-tool/`
**Version:** 1.28.3
**Purpose:** Command-line interface tool distributed via npm
**Package Name:** `claude-code-templates`
**Distribution:** Published to npm registry

**Key Files:**
- `/cli-tool/package.json` - version: 1.28.3
- `/cli-tool/package-lock.json`
- `/cli-tool/bin/` - CLI executable
- `/cli-tool/src/` - CLI source code
- `/cli-tool/components/` - Commands, skills, plugins

**Installation:**
```bash
npm install -g claude-code-templates
```

**Purpose:**
This is the installable CLI tool that users run on their local machines. It provides:
- Component installation (commands, skills, plugins)
- Health checks
- Statistics and analytics
- Dashboard servers
- MCP management

---

### Package 2: Web Application (Vercel deployment)
**Location:** `/` (root)
**Version:** 1.21.14
**Purpose:** Web presence and download tracking
**Deployment:** Vercel serverless functions
**URL:** https://claude-code-templates.vercel.app (or configured domain)

**Key Files:**
- `/package.json` - version: 1.21.14
- `/package-lock.json`
- `/api/` - Vercel serverless functions
- `/public/` - Static web assets

**Purpose:**
This is the web application that provides:
- Landing page and documentation
- Download tracking via Supabase
- Usage analytics
- Web-based component browser
- API endpoints for telemetry

---

## Why Two Separate Packages?

### Reason 1: Different Deployment Targets

**CLI Tool:**
- Runs on user's local machine
- Installed via npm
- Requires Node.js runtime
- Version updates via npm

**Web App:**
- Runs on Vercel's serverless infrastructure
- Deployed via git push
- Stateless serverless functions
- Version updates via git deployment

These are fundamentally different deployment models that require separate package configurations.

---

### Reason 2: Different Dependencies

**CLI Tool Dependencies:**
- Commander.js for CLI parsing
- Inquirer for interactive prompts
- File system operations
- Local database (SQLite)
- Analytics web server
- Plugin management

**Web App Dependencies:**
- Vercel serverless runtime
- Supabase client for database
- Next.js or Express for routing
- Minimal dependencies for fast cold starts

The dependency trees are completely different because they serve different purposes.

---

### Reason 3: Independent Versioning

**CLI Tool (1.28.3):**
- Rapid iteration and frequent updates
- Breaking changes to CLI interface
- New component additions
- Bug fixes for local installation

**Web App (1.21.14):**
- Stable API endpoints
- Slower update cycle
- Focus on availability and performance
- Analytics and tracking features

These components evolve at different rates and need independent version control.

---

### Reason 4: Security and Isolation

**CLI Tool:**
- Runs with user's local permissions
- Accesses local file system
- Manages user's .claude directory
- No public attack surface

**Web App:**
- Public-facing endpoints
- Restricted permissions (serverless sandbox)
- No file system access
- Must defend against web attacks

Security requirements are completely different, necessitating separate configurations.

---

## This Is NOT a Bug

### Common Misconception
When developers see two `package.json` files with different versions, they often assume:
- "Version mismatch bug"
- "Need to sync versions"
- "Duplicate package configuration"

### Reality
This is an **intentional architectural decision** for the following reasons:

1. **Separation of Concerns:** CLI and web are different applications
2. **Independent Deployment:** Different deployment pipelines and schedules
3. **Optimized Dependencies:** Each package has only what it needs
4. **Clear Boundaries:** Prevents coupling between CLI and web
5. **Maintainability:** Easier to reason about and update separately

---

## Package Relationship

```
claude-code-templates (Repository)
│
├── CLI Tool (/cli-tool/)
│   ├── Published to npm as "claude-code-templates"
│   ├── Version: 1.28.3
│   ├── Users install globally: npm install -g claude-code-templates
│   └── Provides: Component installation, health checks, analytics
│
└── Web App (root /)
    ├── Deployed to Vercel
    ├── Version: 1.21.14
    ├── Public URL: https://claude-code-templates.vercel.app
    └── Provides: Documentation, download tracking, web API
```

### Data Flow

1. **User discovers project** → Web App (landing page)
2. **User installs CLI** → npm downloads CLI Tool package
3. **User runs commands** → CLI Tool operates locally
4. **Usage tracked** → CLI Tool reports to Web App API (optional)
5. **Analytics viewed** → Web App displays aggregated data

---

## Version Synchronization Strategy

### When to Sync Versions
**Never.** These are independent packages with independent version semantics.

### CLI Tool Versioning (1.28.3)
Follows semantic versioning for npm package:
- Major: Breaking CLI changes
- Minor: New features/commands
- Patch: Bug fixes

### Web App Versioning (1.21.14)
Follows semantic versioning for web API:
- Major: Breaking API changes
- Minor: New endpoints/features
- Patch: Bug fixes and improvements

### Compatibility
The Web App API is designed to be **backwards compatible** with all CLI Tool versions. The CLI Tool may evolve faster than the web API, which is intentional.

---

## Development Workflow

### Working on CLI Tool
```bash
cd /Users/lroc/claude-code-templates/cli-tool
npm install
npm run dev
npm test
npm version patch  # Increment CLI version
npm publish        # Publish to npm
```

### Working on Web App
```bash
cd /Users/lroc/claude-code-templates
npm install
vercel dev         # Test locally
git push           # Deploy to Vercel (auto-deploy)
```

### Working on Both
Each package is developed and tested independently. There's no need to update both simultaneously unless adding a feature that spans both (e.g., new analytics endpoint).

---

## Monorepo vs. Current Structure

### Why Not a Monorepo?
The project could use a monorepo structure (Lerna, Nx, pnpm workspaces), but the current structure was chosen for simplicity:

**Advantages of Current Structure:**
- Simple for contributors to understand
- No monorepo tooling required
- Clear separation visible in directory structure
- Independent git history per package (if needed)
- No shared dependencies to manage

**When to Consider Monorepo:**
If the project grows to include:
- 3+ packages
- Shared utility libraries
- Complex inter-package dependencies
- Need for synchronized releases

Currently, the simplicity of the two-package structure outweighs the benefits of monorepo tooling.

---

## Common Questions

### Q: Should I update both package.json files when making changes?
**A:** No. Only update the package.json for the package you're modifying.

### Q: Why does `npm install` at root install web app dependencies, not CLI?
**A:** Because root is the web app package. To work on CLI, use `cd cli-tool && npm install`.

### Q: Can I install the CLI from the root package.json?
**A:** No. The CLI must be installed from npm: `npm install -g claude-code-templates`

### Q: Where should I add new CLI commands?
**A:** In `/cli-tool/components/commands/`

### Q: Where should I add new web API endpoints?
**A:** In `/api/` (root level)

### Q: Which version number do I use when referencing the project?
**A:** Depends on context:
- CLI tool version: 1.28.3
- Web app version: 1.21.14
- Repository: Use latest release tag

### Q: Is there a master version that should be updated?
**A:** No. Each package maintains its own version independently.

---

## File Structure Reference

```
/Users/lroc/claude-code-templates/
│
├── package.json              # Web app package (v1.21.14)
├── package-lock.json         # Web app dependencies
├── vercel.json              # Vercel deployment config
├── api/                     # Vercel serverless functions
│   └── track-download-supabase.js
│
├── cli-tool/                # CLI package (v1.28.3)
│   ├── package.json         # CLI package config
│   ├── package-lock.json    # CLI dependencies
│   ├── bin/                 # CLI executable
│   ├── src/                 # CLI source code
│   ├── components/          # Commands, skills, plugins
│   │   ├── commands/
│   │   ├── skills/
│   │   └── plugins/
│   └── tests/
│
├── README.md                # Main documentation
├── CONTRIBUTING.md          # Contribution guidelines
└── docs/                    # Additional documentation
```

---

## Best Practices for Contributors

### When Contributing to CLI
1. Work in `/cli-tool/` directory
2. Update `/cli-tool/package.json` version if needed
3. Test with `npm link` before publishing
4. Update CLI-specific documentation
5. Run CLI test suite

### When Contributing to Web App
1. Work in root directory
2. Test with `vercel dev`
3. Update API documentation if adding endpoints
4. Consider backwards compatibility
5. Test serverless function cold starts

### When Contributing Documentation
1. Add to root `/docs/` or top-level markdown files
2. Reference both packages appropriately
3. Clarify which version you're documenting
4. Update both if feature spans packages

---

## Migration Path (If Needed)

If the project outgrows the current structure, here's a migration path to a monorepo:

```
claude-code-templates/
├── package.json              # Root workspace config
├── packages/
│   ├── cli/                 # CLI package
│   │   └── package.json     # CLI config
│   ├── web/                 # Web app package
│   │   └── package.json     # Web config
│   └── shared/              # Shared utilities
│       └── package.json     # Shared config
└── lerna.json or pnpm-workspace.yaml
```

**When to migrate:** 3+ packages, shared code, complex dependencies
**Current status:** Not needed - current structure is optimal for 2 packages

---

## Conclusion

The two-package architecture of claude-code-templates is a deliberate design decision that:

1. Separates CLI tool from web application
2. Enables independent versioning and deployment
3. Optimizes dependencies for each use case
4. Maintains clear boundaries and responsibilities
5. Simplifies development and maintenance

**This is not a bug.** It's a feature that allows the project to maintain both a robust CLI tool and a performant web presence without unnecessary coupling.

---

## Related Documentation

- [CONTRIBUTING.md](/CONTRIBUTING.md) - Contribution guidelines
- [DEPLOYMENT.md](/DEPLOYMENT.md) - Deployment procedures
- [cli-tool/README.md](/cli-tool/README.md) - CLI documentation
- [TESTING_RESULTS.md](/TESTING_RESULTS.md) - Testing documentation

---

*This architecture document clarifies the intentional design decisions behind the project structure. If you have questions about this architecture, please open a GitHub issue for discussion.*
