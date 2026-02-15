# React TypeScript Development Skill

## Purpose

The `react-dev` skill provides comprehensive TypeScript patterns and best practices for building type-safe React applications. It serves as a complete reference for modern React development with TypeScript, covering React 18-19 features, including Server Components, type-safe routing, and proper event handling.

This skill exists to eliminate TypeScript guesswork in React development by providing compile-time guarantees, confident refactoring, and production-ready patterns that catch bugs before runtime.

## When to Use

Activate this skill when working on:

- **Building typed React components** - Creating new components with proper TypeScript types
- **Implementing generic components** - Tables, lists, modals, form fields that work with any data type
- **Typing event handlers and forms** - Mouse events, form submissions, input changes, keyboard events
- **Using React 19 features** - Actions, Server Components, `use()` hook, `useActionState`
- **Router integration** - TanStack Router or React Router v7 with type safety
- **Custom hooks with proper typing** - Creating reusable hooks with correct return types
- **Migrating to React 19** - Understanding breaking changes and new patterns

**Trigger phrases:**
- "Build a typed React component"
- "Type this event handler"
- "Create a generic Table/List/Modal"
- "Use React 19 Server Components"
- "Type-safe routing with TanStack/React Router"
- "How do I type this hook?"
- "React TypeScript best practices"

**Not for:**
- Non-React TypeScript projects
- Vanilla JavaScript React (without TypeScript)
- React Native-specific patterns

## How It Works

The skill provides progressive disclosure of React TypeScript knowledge:

1. **Core patterns loaded immediately** - Component props, event handlers, hooks typing
2. **Advanced patterns referenced on-demand** - Generic components, Server Components, routing
3. **Reference files for deep dives** - Detailed examples and edge cases only loaded when needed
4. **React 19 migration guidance** - Breaking changes and new APIs clearly marked

The skill is structured around:
- **Quick reference sections** - Common patterns you can copy immediately
- **Detailed reference files** - In-depth examples and explanations
- **Rules and anti-patterns** - What to always do and what to never do
- **Version-specific guidance** - React 18 vs React 19 differences highlighted

## Key Features

### 1. React 19 Breaking Changes

Covers all major breaking changes in React 19:

- **ref as prop** - No more `forwardRef`, refs are regular props now
- **useActionState** - Replaces deprecated `useFormState`
- **use() hook** - Unwraps promises and context in components
- **Migration patterns** - Step-by-step guides for updating existing code

### 2. Component Patterns

Type-safe patterns for common component scenarios:

- **Props typing** - Extending native HTML elements with `ComponentPropsWithoutRef`
- **Children typing** - `ReactNode`, `ReactElement`, render props
- **Discriminated unions** - Type-safe variant props (e.g., button vs link)
- **Generic components** - Reusable components that infer types from data

### 3. Event Handler Typing

Specific event types for accurate TypeScript inference:

- Mouse events (`MouseEvent<HTMLButtonElement>`)
- Form events (`FormEvent<HTMLFormElement>`)
- Input changes (`ChangeEvent<HTMLInputElement>`)
- Keyboard events (`KeyboardEvent<HTMLInputElement>`)
- Focus, drag, clipboard, touch, wheel events (in reference docs)

### 4. Hooks Typing

Proper TypeScript patterns for all React hooks:

- `useState` - Explicit types for unions and nullable values
- `useRef` - DOM refs (null) vs mutable refs (direct access)
- `useReducer` - Discriminated union actions
- `useContext` - Null guard patterns
- Custom hooks - Tuple returns with `as const`

### 5. Server Components (React 19)

Modern patterns for Server Components and Server Actions:

- Async components with direct data fetching
- Server Actions with `'use server'` directive
- Client components consuming Server Actions
- Promise handoff with `use()` hook
- Parallel fetching and streaming

### 6. Type-Safe Routing

Comprehensive routing patterns for both major routers:

- **TanStack Router** - Compile-time type safety with Zod validation
- **React Router v7** - Auto-generated types with Framework Mode
- Type-safe params, search params, loaders, actions

### 7. Generic Components

Reusable components that work with any data type:

- Tables with type-safe columns
- Lists with constrained generics
- Modals, selects, form fields
- Render props and keyof patterns

## Prerequisites

- **React 18 or 19** - Patterns are optimized for modern React
- **TypeScript 5.0+** - Uses latest TypeScript features
- **Router (optional)** - TanStack Router or React Router v7 for routing patterns
- **Zod (optional)** - For TanStack Router search param validation

## Usage Examples

### Example 1: Type-Safe Button Component

```typescript
type ButtonProps = {
  variant: 'primary' | 'secondary';
} & React.ComponentPropsWithoutRef<'button'>;

function Button({ variant, children, ...props }: ButtonProps) {
  return (
    <button
      className={variant}
      {...props}
    >
      {children}
    </button>
  );
}

// Usage
<Button variant="primary" onClick={(e) => console.log(e.currentTarget.disabled)}>
  Click me
</Button>
```

### Example 2: Generic Table Component

```typescript
type Column<T> = {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], item: T) => React.ReactNode;
};

type TableProps<T> = {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
};

function Table<T>({ data, columns, keyExtractor }: TableProps<T>) {
  return (
    <table>
      <thead>
        <tr>{columns.map(col => <th key={String(col.key)}>{col.header}</th>)}</tr>
      </thead>
      <tbody>
        {data.map(item => (
          <tr key={keyExtractor(item)}>
            {columns.map(col => (
              <td key={String(col.key)}>
                {col.render ? col.render(item[col.key], item) : String(item[col.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Usage - types are inferred!
type User = { id: number; name: string; email: string };
const users: User[] = [...];

<Table
  data={users}
  columns={[
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' }
  ]}
  keyExtractor={user => user.id}
/>
```

### Example 3: React 19 Server Action with Form

```typescript
// actions/user.ts
'use server';

export async function updateUser(userId: string, formData: FormData) {
  const name = formData.get('name') as string;
  await db.user.update({
    where: { id: userId },
    data: { name }
  });
  revalidatePath(`/users/${userId}`);
  return { success: true };
}

// UserForm.tsx
'use client';

import { useActionState } from 'react';
import { updateUser } from '@/actions/user';

function UserForm({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState(
    (prev, formData) => updateUser(userId, formData),
    {}
  );

  return (
    <form action={formAction}>
      <input name="name" />
      <button disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
      {state.success && <p>Saved!</p>}
    </form>
  );
}
```

### Example 4: Type-Safe Event Handlers

```typescript
function Form() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    console.log(Object.fromEntries(formData));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.value); // Typed correctly!
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // currentTarget is typed as HTMLInputElement
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </form>
  );
}
```

### Example 5: Custom Hook with Proper Typing

```typescript
function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = () => setValue(v => !v);
  return [value, toggle] as const; // Tuple type preserved!
}

// Usage
const [isOpen, toggleOpen] = useToggle(false);
// isOpen is boolean, toggleOpen is () => void
```

### Example 6: TanStack Router Type-Safe Route

```typescript
import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';

const userRoute = createRoute({
  path: '/users/$userId',
  component: UserPage,
  loader: async ({ params }) => ({
    user: await fetchUser(params.userId)
  }),
  validateSearch: z.object({
    tab: z.enum(['profile', 'settings']).optional(),
    page: z.number().int().positive().default(1),
  }),
});

function UserPage() {
  // All fully typed from the route definition!
  const { user } = useLoaderData({ from: userRoute.id });
  const { tab, page } = useSearch({ from: userRoute.id });
  const { userId } = useParams({ from: userRoute.id });

  return <div>{user.name} - {tab} - Page {page}</div>;
}
```

## Output

The skill provides:

1. **Code examples** - Copy-paste ready TypeScript code
2. **Type definitions** - Exact types to use for your scenarios
3. **Pattern explanations** - Why patterns work and when to use them
4. **Migration guides** - Step-by-step updates for React 19
5. **Reference links** - Pointers to detailed documentation when needed

## Best Practices

### Always Do

✅ **Use specific event types** - `MouseEvent<HTMLButtonElement>` not `React.MouseEvent`
✅ **Explicit `useState` for unions/null** - `useState<User | null>(null)`
✅ **Extend native elements** - `ComponentPropsWithoutRef<'button'>`
✅ **Discriminated unions for variants** - Type-safe props based on variant
✅ **`as const` for tuple returns** - Preserve tuple types in custom hooks
✅ **`ref` as prop in React 19** - No `forwardRef` needed
✅ **`useActionState` for forms** - Not deprecated `useFormState`
✅ **Type-safe routing patterns** - Use provided router patterns

### Never Do

❌ **Use `any` for event handlers** - Defeats TypeScript's purpose
❌ **Use `JSX.Element` for children** - Use `ReactNode` instead
❌ **Use `forwardRef` in React 19+** - It's deprecated
❌ **Use `useFormState`** - Deprecated in React 19
❌ **Forget null handling for DOM refs** - Always use `ref?.current`
❌ **Mix Server/Client in same file** - Will cause hydration errors
❌ **Await promises before `use()`** - Defeats streaming/Suspense

### Progressive Enhancement

1. **Start simple** - Basic component props and event handlers
2. **Add constraints** - Discriminated unions, generic constraints
3. **Leverage inference** - Let TypeScript infer types from usage
4. **Reference docs when stuck** - Deep dive into specific patterns

### Reference File Organization

The skill includes detailed reference files:

- **hooks.md** - `useState`, `useRef`, `useReducer`, `useContext`, custom hooks
- **event-handlers.md** - All event types, generic handlers, edge cases
- **react-19-patterns.md** - `useActionState`, `use()`, `useOptimistic`, migration
- **generic-components.md** - Table, Select, List, Modal, FormField patterns
- **server-components.md** - Async components, Server Actions, streaming
- **tanstack-router.md** - TanStack Router typed routes, search params, navigation
- **react-router.md** - React Router v7 loaders, actions, type generation

These files are loaded on-demand to keep context efficient. The skill will reference them when deeper knowledge is needed.

## Context Efficiency

This skill follows progressive disclosure principles:

- **Core patterns in SKILL.md** - Most common use cases immediately available
- **Reference files on-demand** - Deep dives only when needed
- **Script-free design** - Pure knowledge, no executable scripts needed
- **Single-level references** - Direct links, no nested includes

This keeps the skill's context footprint minimal while providing comprehensive coverage when needed.

## Version Compatibility

- **React 18** - All patterns work, ignore React 19-specific sections
- **React 19** - Full support including Server Components, `use()`, `useActionState`
- **TypeScript 5.0+** - Recommended for best type inference
- **TanStack Router** - Any version supporting `createRoute`
- **React Router v7+** - Framework Mode for auto-generated types

## Getting Started

1. **Install the skill** in Claude Code or add to claude.ai project knowledge
2. **Mention React TypeScript** in your conversation or request
3. **Reference specific patterns** - "How do I type this event handler?"
4. **Let Claude suggest patterns** - Describe what you're building
5. **Explore reference docs** - Ask for deep dives when needed

## Related Skills

- **typescript-patterns** - General TypeScript patterns beyond React
- **frontend-testing** - Testing typed React components
- **component-library** - Building design systems with TypeScript

---

**Version:** 1.0.0
**Last Updated:** 2026-01-20
**Maintained by:** Softaworks Agent Skills
