---
allowed-tools: Bash, Read
argument-hint: [--skip-install] | [--only-lint] | [--skip-tests]
description: Run comprehensive CI checks and fix issues until repository is in working state
model: sonnet
---

# Husky CI Pre-commit Checks

Run comprehensive CI checks and fix issues: $ARGUMENTS

## Current Repository State

- Git status: !`git status --porcelain`
- Package manager: !`which pnpm npm yarn | head -1`
- Current branch: !`git branch --show-current`
- Package.json: @package.json
- Environment file: @.env (if exists)

## Task

Verify repository is in working state and fix issues. All commands run from repo root.

## CI Check Protocol

### Step 0: Environment Setup
- Update dependencies: `pnpm i` (unless --skip-install)
- Source environment: `.env` file if exists

### Step 1: Linting
- Check linter passes: `pnpm lint`
- Fix formatting issues automatically when possible

### Step 2: TypeScript & Build
- Run comprehensive build checks:
  ```bash
  pnpm nx run-many --targets=build:types,build:dist,build:app,generate:docs,dev:run,typecheck
  ```
- If specific command fails, debug that command individually
- Fix TypeScript errors and build issues

### Step 3: Test Coverage
- Source `.env` file first if exists
- Run test coverage: `pnpm nx run-many --target=test:coverage`
- **NEVER** run normal test command (times out)
- Run individual packages one by one for easier debugging
- For snapshot test failures: explain thesis before updating snapshots

### Step 4: Package Validation
- Sort package.json: `pnpm run sort-package-json`
- Lint packages: `pnpm nx run-many --targets=lint:package,lint:deps`

### Step 5: Double Check
- If fixes made in any step, re-run all preceding checks
- Ensure no regression introduced

### Step 6: Staging
- Check status: `git status`
- Add files: `git add`
- **EXCLUDE**: Git submodules in `lib/*` folders
- **DO NOT COMMIT**: Only stage files

## Error Handling Protocol

### 1. Diagnosis
- Explain why command broke with complete analysis
- Cite source code and logs supporting thesis
- Add console logs if needed for confirmation
- Ask for help if insufficient context

### 2. Fix Implementation
- Propose specific fix with full explanation
- Explain why fix will work
- If fix fails, return to Step 1

### 3. Impact Analysis
- Consider if same bug exists elsewhere
- Search codebase for similar patterns
- Fix related issues proactively

### 4. Cleanup
- Remove all added console.logs after fixing
- Run `pnpm run lint` to format files
- Ask user before staging changes
- Suggest commit message (don't commit)

## Development Notes

### File Organization
- Functions/types like `createTevmNode` are in:
  - Implementation: `createTevmNode.js`
  - Types: `TevmNode.ts`
  - Tests: `createTevmNode.spec.ts`

### Tool-Specific Tips

#### pnpm i
- If fails, abort unless simple syntax error (missing comma)

#### pnpm lint (Biome)
- Lints entire codebase
- Auto-fixes most formatting issues

#### TypeScript Builds
- Look for types in node_modules if not obvious
- For tevm packages, check monorepo structure
- Consult documentation if multiple failures

#### Test Execution
- Use Vite test runner
- Run packages individually for debugging
- Add console logs to test assumptions
- Explain snapshot changes before updating

## Success Criteria

Print checklist at end with ✅ for passed steps:
- ✅ Dependencies updated
- ✅ Linting passed
- ✅ TypeScript/Build passed
- ✅ Tests passed
- ✅ Package validation passed
- ✅ Files staged (no commits made)

## Safety Guidelines

- **Fix errors proactively** - TypeScript/tests will catch regressions
- **Never commit** - Only stage changes
- **One step at a time** - Don't proceed until current step passes
- **Ask permission** before staging if fixes were made