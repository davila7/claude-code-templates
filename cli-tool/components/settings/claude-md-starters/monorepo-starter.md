# CLAUDE.md Starter: Monorepo Project

Copy this into your project root as `CLAUDE.md` and customize the placeholders.

This template shows how to use CLAUDE.md imports and `.claude/rules/` for path-specific conventions.

---

## Root CLAUDE.md

```markdown
# CLAUDE.md

## Project Overview

- **Name**: <project-name>
- **Description**: <one-line description>
- **Monorepo tool**: <turborepo | nx | pnpm workspaces | yarn workspaces>
- **Package manager**: pnpm

## Workspace Layout

```text
<project-name>/
├── apps/
│   ├── web/               # Next.js frontend
│   ├── api/               # Express/Fastify backend
│   └── mobile/            # React Native app
├── packages/
│   ├── ui/                # Shared UI components
│   ├── shared/            # Shared types and utilities
│   └── config/            # Shared ESLint, TSConfig, etc.
├── CLAUDE.md              # This file (root conventions)
├── .claude/
│   └── rules/             # Path-specific rules (see below)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Quick Commands

```bash
# Install all dependencies
pnpm install

# Run all apps in dev mode
pnpm dev

# Build all packages
pnpm build

# Run all tests
pnpm test

# Lint everything
pnpm lint

# Run command in specific workspace
pnpm --filter web dev
pnpm --filter api test
pnpm --filter ui build
```

## Cross-Workspace Rules

- Shared types go in `packages/shared/src/types/`
- Shared utilities go in `packages/shared/src/utils/`
- UI components go in `packages/ui/src/`
- Import shared packages by name: `import { Button } from "@<scope>/ui"`
- Never use relative imports across workspace boundaries
- Changes to `packages/shared` may affect all apps, test broadly
- Each package has its own `tsconfig.json` extending root config

## Dependency Rules

- Shared dependencies go in root `package.json`
- App-specific dependencies go in the app's `package.json`
- Keep dependency versions consistent across workspaces
- Use `pnpm --filter <workspace> add <package>` to add deps

## Conventions

- <Add project-wide conventions here>
```

---

## Path-Specific Rules (`.claude/rules/`)

Create these files under `.claude/rules/` for workspace-specific instructions.

### `.claude/rules/frontend.md`

```markdown
---
paths:
  - "apps/web/**"
  - "packages/ui/**"
---

# Frontend Rules

- Use React Server Components by default, add "use client" only when needed
- Style with Tailwind CSS, no CSS modules or styled-components
- Use `cn()` from `packages/shared` for conditional class names
- Component files: PascalCase (`Button.tsx`)
- Export components from barrel `index.ts` in each directory
- Test with Vitest + React Testing Library
- Run `pnpm --filter web test` before committing frontend changes
```

### `.claude/rules/backend.md`

```markdown
---
paths:
  - "apps/api/**"
---

# Backend Rules

- Use Express with TypeScript
- Routes in `src/routes/`, grouped by domain
- Business logic in `src/services/`, not in route handlers
- Validate requests with zod schemas in `src/schemas/`
- Use dependency injection for testability
- Database queries in `src/repositories/`
- Test with Vitest, mock database calls
- Run `pnpm --filter api test` before committing backend changes
```

### `.claude/rules/shared-packages.md`

```markdown
---
paths:
  - "packages/**"
---

# Shared Package Rules

- Packages must have zero app-specific dependencies
- Export public API from `src/index.ts`
- Include a `README.md` documenting the package's purpose
- Version bumps require updating all consuming workspaces
- Test packages independently: `pnpm --filter <package> test`
- Changes here affect multiple apps, be cautious
```

### `.claude/rules/database.md`

```markdown
---
paths:
  - "apps/api/src/db/**"
  - "apps/api/prisma/**"
  - "**/migrations/**"
---

# Database Rules

- Use Prisma for schema and migrations
- Always create a migration for schema changes: `pnpm --filter api prisma migrate dev`
- Never modify migration files after they've been applied
- Add indexes for foreign keys and frequently queried columns
- Use transactions for multi-table operations
- Test database queries with a test database, not mocks
```

---

## Using CLAUDE.md Imports

Instead of path-specific rules, you can use imports in the root CLAUDE.md:

```markdown
# CLAUDE.md

See @apps/web/README.md for frontend conventions.
See @apps/api/README.md for backend conventions.
See @packages/shared/README.md for shared package rules.
```

Claude will automatically load the referenced files when relevant.

---

## Monorepo Settings

To exclude certain directories from CLAUDE.md scanning (e.g., generated code), add to `.claude/settings.json`:

```json
{
  "claudeMdExcludes": [
    "apps/*/node_modules/**",
    "packages/*/dist/**",
    "**/generated/**"
  ]
}
```
