---
description: Strict TypeScript conventions for .ts and .tsx files
globs: ["**/*.ts", "**/*.tsx"]
---

# TypeScript Rules

## Type Safety
- Enable strict mode in tsconfig (`"strict": true`). Never disable it per-file.
- Never use `any`. Use `unknown` when the type is truly unknown, then narrow it.
- Avoid type assertions (`as Foo`) unless you have no alternative. Prefer type guards.
- Use proper generics instead of widening to `object` or `{}`.

## Variables and Declarations
- Prefer `const` over `let`. Use `let` only when reassignment is necessary.
- Never use `var`.
- Destructure imports: `import { useState, useEffect } from 'react'`.
- Use template literals instead of string concatenation.

## Functions and Signatures
- Annotate all function return types explicitly (exceptions: trivial one-liners).
- Use optional chaining (`?.`) and nullish coalescing (`??`) instead of manual null checks.
- Prefer arrow functions for callbacks and short utilities.

## Types and Interfaces
- Prefer `interface` for object shapes that may be extended; use `type` for unions, intersections, and aliases.
- Use union types instead of enums: `type Direction = 'left' | 'right'` rather than `enum Direction`.
- Use `readonly` on properties that should not be mutated.
- Define error types explicitly. Never `catch (e: any)`.

## Imports and Modules
- Use named exports by default. Use a default export only when the module represents a single concept (e.g., a React component file).
- Keep import order: external packages first, then internal modules, then relative paths.
