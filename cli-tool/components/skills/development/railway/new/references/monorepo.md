# Monorepo Reference

Railway supports two types of monorepo deployments with different configuration approaches.

## Key Decision: Root Directory vs Custom Commands

| Approach | When to Use | What Happens |
|----------|-------------|--------------|
| **Root Directory** | Isolated apps (no shared code) | Only that directory's code is available |
| **Custom Commands** | Shared monorepos (TypeScript, workspaces) | Full repo available, filter at build/start |

**Critical:** Setting root directory means code outside that directory is NOT available during build. For monorepos with shared packages, use custom commands instead.

## Isolated Monorepo

Apps are completely independent - no shared code between directories.

```
├── frontend/        # React app (standalone)
│   ├── package.json
│   └── src/
└── backend/         # Python API (standalone)
    ├── requirements.txt
    └── main.py
```

### Configuration

Set **Root Directory** for each service:
- Frontend service: `/frontend`
- Backend service: `/backend`

Each service only sees its own directory's code.

### When to Use

- Frontend and backend in different languages
- No shared packages or dependencies
- Each app has its own package.json/requirements.txt
- Apps don't import from sibling directories

## Shared Monorepo

Apps share code from common packages or the root.

```
├── package.json           # Root workspace config
├── packages/
│   ├── frontend/
│   │   ├── package.json
│   │   └── src/
│   ├── backend/
│   │   ├── package.json
│   │   └── src/
│   └── shared/            # Shared utilities
│       ├── package.json
│       └── src/
└── tsconfig.json          # Shared TS config
```

### Configuration

Do NOT set root directory. Instead, use custom build and start commands:

**pnpm:**
```
Build: pnpm --filter backend build
Start: pnpm --filter backend start
```

**npm workspaces:**
```
Build: npm run build --workspace=packages/backend
Start: npm run start --workspace=packages/backend
```

**yarn workspaces:**
```
Build: yarn workspace backend build
Start: yarn workspace backend start
```

**bun:**
```
Build: bun run --filter backend build
Start: bun run --filter backend start
```

**Turborepo:**
```
Build: turbo run build --filter=backend
Start: turbo run start --filter=backend
```

### When to Use

- TypeScript/JavaScript monorepo with workspaces
- Packages import from sibling packages (`@myapp/shared`)
- Shared tsconfig.json, eslint config at root
- Using pnpm, yarn workspaces, npm workspaces, or bun
- Using Turborepo, Nx, or similar build tools

## Watch Paths

Prevent changes in one package from triggering rebuilds of other services.

Set watch paths for each service to only rebuild when relevant files change:

| Service | Watch Paths |
|---------|-------------|
| frontend | `/packages/frontend/**`, `/packages/shared/**` |
| backend | `/packages/backend/**`, `/packages/shared/**` |

Include shared packages in watch paths if the service depends on them.

### Pattern Format

Uses gitignore-style patterns:
```
/packages/backend/**     # All files in backend
/packages/shared/**      # All files in shared (if depends on it)
!**/*.md                 # Ignore markdown changes
```

## Configuration Examples

### Isolated: React + Python API

Two separate apps, no shared code.

**Frontend service:**
- Root Directory: `/frontend`
- No custom commands needed (Railpack auto-detects)

**Backend service:**
- Root Directory: `/backend`
- No custom commands needed

### Shared: TypeScript Monorepo with pnpm

Frontend and backend share a `@myapp/shared` package.

**Frontend service:**
- Root Directory: (leave empty)
- Build Command: `pnpm --filter frontend build`
- Start Command: `pnpm --filter frontend start`
- Watch Paths: `/packages/frontend/**`, `/packages/shared/**`

**Backend service:**
- Root Directory: (leave empty)
- Build Command: `pnpm --filter backend build`
- Start Command: `pnpm --filter backend start`
- Watch Paths: `/packages/backend/**`, `/packages/shared/**`

### Shared: Turborepo

**Frontend service:**
- Root Directory: (leave empty)
- Build Command: `turbo run build --filter=frontend`
- Start Command: `turbo run start --filter=frontend`
- Watch Paths: `/apps/frontend/**`, `/packages/**`

**Backend service:**
- Root Directory: (leave empty)
- Build Command: `turbo run build --filter=backend`
- Start Command: `turbo run start --filter=backend`
- Watch Paths: `/apps/backend/**`, `/packages/**`

## Common Mistakes

### Using Root Directory for Shared Monorepos

**Wrong:**
```
Root Directory: /packages/backend
```
This breaks builds because `@myapp/shared` isn't available.

**Right:**
```
Root Directory: (empty)
Build Command: pnpm --filter backend build
Start Command: pnpm --filter backend start
```

### Forgetting Watch Paths

Without watch paths, changing `frontend/` triggers a rebuild of `backend/`.

Always set watch paths for monorepos to avoid unnecessary builds.

### Missing Shared Packages in Watch Paths

If `backend` imports from `shared`, include both in watch paths:
```
/packages/backend/**
/packages/shared/**
```

Otherwise changes to `shared` won't trigger backend rebuilds.

## Detecting Monorepo Type

Check for these indicators:

**Isolated monorepo:**
- Separate package.json in each directory
- No workspace config in root package.json
- No imports between directories

**Shared monorepo:**
- Root package.json with `workspaces` field
- `pnpm-workspace.yaml` exists
- Packages import from each other (`@myapp/shared`)
- Shared tsconfig.json at root
- turbo.json or nx.json at root
