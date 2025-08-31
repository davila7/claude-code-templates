---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [migration-strategy] | --gradual | --complete | --strict | --incremental
description: Migrate JavaScript project to TypeScript with proper typing and tooling setup
model: sonnet
---

# Migrate to TypeScript

Migrate JavaScript project to TypeScript with comprehensive type safety: **$ARGUMENTS**

## Current JavaScript State

- Project structure: @package.json (analyze JS/TS mix and dependencies)
- JavaScript files: !`find . -name "*.js" -not -path "./node_modules/*" | wc -l`
- Existing TypeScript: !`find . -name "*.ts" -not -path "./node_modules/*" | wc -l`
- Build system: @webpack.config.js or @vite.config.js or @rollup.config.js

## Task

Systematically migrate JavaScript codebase to TypeScript with proper typing and tooling:

**Migration Strategy**: Use $ARGUMENTS to specify gradual migration, complete conversion, strict mode, or incremental approach

**Migration Process**:
1. **Environment Setup** - TypeScript installation, tsconfig.json configuration, build tool integration
2. **Type Definitions** - Install @types packages, create custom type declarations, define interfaces
3. **File Migration** - Rename .js to .ts/.tsx, add type annotations, resolve compiler errors
4. **Code Transformation** - Convert classes, functions, and modules with proper typing
5. **Error Resolution** - Fix type mismatches, null/undefined handling, strict mode issues
6. **Testing & Validation** - Update test files, configure type checking, validate type coverage

**Advanced Features**: Generic types, mapped types, conditional types, module augmentation, and strict compiler settings.

**Developer Experience**: Configure IDE integration, debugging, linting rules, and team onboarding.

**Output**: Fully typed TypeScript codebase with strict type checking, comprehensive IntelliSense, and improved developer productivity.