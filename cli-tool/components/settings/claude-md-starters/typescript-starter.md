# CLAUDE.md Starter: TypeScript / Node.js Project

Copy this into your project root as `CLAUDE.md` and customize the placeholders.

---

```markdown
# CLAUDE.md

## Project Overview

- **Name**: <project-name>
- **Description**: <one-line description>
- **Runtime**: Node.js 20+
- **Package manager**: npm (use `npm run` for scripts)

## Quick Commands

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format

# Type check
npx tsc --noEmit
```

## Project Structure

```text
<project-name>/
├── src/
│   ├── index.ts           # Entry point
│   ├── config/            # Configuration and env loading
│   ├── services/          # Business logic
│   ├── utils/             # Pure utility functions
│   └── types/             # Shared TypeScript types
├── tests/
│   └── *.test.ts          # Test files (co-located or mirrored)
├── tsconfig.json
├── package.json
└── CLAUDE.md
```

## Code Style

- Use strict TypeScript (`"strict": true` in tsconfig)
- Prefer `interface` over `type` for object shapes (unless unions needed)
- Use `const` by default, `let` only when reassignment is needed, never `var`
- Use named exports, not default exports
- Use async/await, never raw `.then()` chains
- Use template literals for string interpolation
- Prefer early returns over nested if/else
- Maximum line length: 100 characters (Prettier)

## Testing

- Use Vitest (or Jest) for unit and integration tests
- Name test files `<module>.test.ts` next to the source file
- Use `describe()` for grouping, `it()` or `test()` for individual cases
- Use `vi.mock()` (or `jest.mock()`) for mocking modules
- Always run `npm test` before committing

## Error Handling

- Use typed error classes extending `Error`
- Never swallow errors with empty `catch` blocks
- Use `Result<T, E>` pattern or explicit error types for expected failures
- Log with a structured logger (e.g., pino), not `console.log`

## Dependencies

- Add with `npm install <package>`
- Add dev deps with `npm install --save-dev <package>`
- Keep `package-lock.json` in git
- Never edit `package-lock.json` manually

## Conventions

- <Add project-specific conventions here>
```

---

## Variants

### pnpm

Replace package manager references:

```markdown
- **Package manager**: pnpm

```bash
pnpm install
pnpm run dev
pnpm test
```
```

### Bun

Replace package manager references:

```markdown
- **Package manager**: Bun

```bash
bun install
bun run dev
bun test
```
```

### Express API

Add these sections:

```markdown
## API Conventions

- Routes go in `src/routes/` grouped by domain
- Middleware in `src/middleware/`
- Use `express-async-errors` or wrap handlers to catch async errors
- Validate request bodies with zod schemas
- Return consistent JSON: `{ data: T }` on success, `{ error: string }` on failure
- Use HTTP status codes correctly (201 for creation, 204 for deletion, etc.)
```

### CLI Tool

Add these sections:

```markdown
## CLI Conventions

- Use `commander` or `yargs` for argument parsing
- Entry point in `src/cli.ts` with `#!/usr/bin/env node` shebang
- Subcommands in `src/commands/<name>.ts`
- Use `process.exit(1)` for errors, `process.exit(0)` for success
- Write to stderr for errors/warnings, stdout for output
```
