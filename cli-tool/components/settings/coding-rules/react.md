---
description: React patterns for functional components in .tsx and .jsx files
globs: ["**/*.tsx", "**/*.jsx"]
---

# React Rules

## Component Structure
- Use functional components exclusively. Never write class components.
- One component per file. The file name matches the component name (PascalCase).
- Use named exports for components. Avoid default exports except at page/route level.

## Hooks
- Extract shared stateful logic into custom hooks (`use` prefix).
- Keep hooks at the top level of a component. Never call hooks inside conditions or loops.
- Use `useCallback` and `useMemo` only when there is a measurable performance problem. Do not add them speculatively.
- Use `React.memo` sparingly and only after profiling.

## Props and Types
- In `.tsx` files, define prop types with a `Props` interface in the same file, above the component.
- In `.tsx` files, do not use `React.FC` - annotate props directly: `function MyComponent({ title }: Props)`.
- In `.tsx` files, mark props that will not change as `readonly`.
- In `.jsx` files, use `PropTypes` for runtime prop validation if TypeScript is not available.

## Accessibility
- Add `aria-label` or `aria-labelledby` to interactive elements that lack visible text.
- Use semantic HTML elements (`button`, `nav`, `main`, `section`) instead of generic `div` wrappers.
- Ensure all images have an `alt` attribute.

## Composition and Patterns
- Prefer composition over inheritance. Use children, render props, or compound components.
- Use error boundaries around sections that may throw (data fetching, third-party widgets).
- Colocate styles with the component (CSS modules or styled components in the same directory).

## State Management
- Keep state as local as possible. Lift state only when two components genuinely share it.
- Avoid putting derived data in state. Compute it during render instead.

## Performance
- Use `key` props that are stable and unique (never array indexes for reordered lists).
- Avoid inline object and function literals in JSX props for frequently re-rendered components.
