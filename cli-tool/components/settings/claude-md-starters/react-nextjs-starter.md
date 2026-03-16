# CLAUDE.md Starter: React / Next.js Project

Copy this into your project root as `CLAUDE.md` and customize the placeholders.

---

```markdown
# CLAUDE.md

## Project Overview

- **Name**: <project-name>
- **Description**: <one-line description>
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **Package manager**: npm

## Quick Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

## Project Structure

```text
<project-name>/
├── app/                   # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── globals.css        # Global styles
│   └── <route>/
│       ├── page.tsx       # Route page
│       └── loading.tsx    # Loading UI
├── components/
│   ├── ui/                # Reusable UI primitives (Button, Input, etc.)
│   └── <feature>/         # Feature-specific components
├── lib/                   # Utilities, API clients, helpers
├── hooks/                 # Custom React hooks
├── types/                 # Shared TypeScript types
├── public/                # Static assets
└── CLAUDE.md
```

## Code Style

- Use functional components with arrow functions
- Use TypeScript strict mode, type all props with `interface`
- Prefer named exports over default exports (except pages)
- Use `"use client"` directive only when the component needs interactivity
- Keep Server Components as the default
- Tailwind classes: use consistent ordering (layout, spacing, sizing, colors, text)
- Extract repeated Tailwind patterns into components, not @apply

## Component Patterns

```tsx
// Standard component pattern
interface MyComponentProps {
  title: string;
  children: React.ReactNode;
}

export function MyComponent({ title, children }: MyComponentProps) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

- Props interface named `<Component>Props`
- Destructure props in function signature
- One component per file, file named same as component

## Data Fetching

- Use Server Components for data fetching when possible
- Use React Server Actions for mutations (`"use server"`)
- Use `fetch()` with Next.js caching in Server Components
- Use React Query / SWR for client-side data fetching
- API routes go in `app/api/<route>/route.ts`

## State Management

- Use `useState` for local component state
- Use `useReducer` for complex local state
- Use React Context for shared state within a feature
- Use Zustand or Jotai for global client state (if needed)
- Avoid prop drilling deeper than 2-3 levels

## Testing

- Use Vitest + React Testing Library for component tests
- Test behavior, not implementation details
- Use `screen.getByRole()` and `screen.getByText()` over test IDs
- Mock API calls with MSW (Mock Service Worker)
- Name test files `<Component>.test.tsx`

## Conventions

- <Add project-specific conventions here>
```

---

## Variants

### Vite + React (no Next.js)

Replace framework-specific sections:

```markdown
- **Framework**: React 19 + Vite

## Project Structure

```text
├── src/
│   ├── main.tsx           # Entry point
│   ├── App.tsx            # Root component
│   ├── components/        # Reusable components
│   ├── pages/             # Page-level components
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities
│   └── types/             # TypeScript types
├── public/
└── index.html
```

## Routing

- Use React Router v7 for client-side routing
- Route definitions in `src/routes.tsx`
- Lazy-load page components with `React.lazy()`
```

### shadcn/ui

Add this section:

```markdown
## UI Components (shadcn/ui)

- Install components with `npx shadcn@latest add <component>`
- Components live in `components/ui/` and are fully editable
- Use `cn()` helper from `lib/utils` for conditional class merging
- Follow shadcn patterns for form handling (react-hook-form + zod)
- Don't modify component internals unless necessary, compose instead
```

### Tailwind CSS v3 (instead of v4)

```markdown
- **Styling**: Tailwind CSS v3
- Config in `tailwind.config.ts`
- Use `@apply` sparingly, prefer component extraction
```
