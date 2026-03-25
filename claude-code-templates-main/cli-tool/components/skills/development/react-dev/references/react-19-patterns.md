# React 19 TypeScript Patterns

React 19 introduces breaking changes and new APIs requiring updated TypeScript patterns.

## ref as Prop (No More forwardRef)

React 19 allows ref as regular prop — forwardRef deprecated but still works.

```typescript
// ✅ React 19 - ref as prop
type InputProps = {
  ref?: React.Ref<HTMLInputElement>;
  label: string;
} & React.ComponentPropsWithoutRef<'input'>;

export function Input({ ref, label, ...props }: InputProps) {
  return (
    <div>
      <label>{label}</label>
      <input ref={ref} {...props} />
    </div>
  );
}

// Usage
function Form() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form>
      <Input ref={inputRef} label="Name" />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
    </form>
  );
}
```

```typescript
// ❌ Old pattern (still works, but unnecessary)
import { forwardRef } from 'react';

type InputProps = {
  label: string;
} & React.ComponentPropsWithoutRef<'input'>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, ...props }, ref) => {
    return (
      <div>
        <label>{label}</label>
        <input ref={ref} {...props} />
      </div>
    );
  }
);

Input.displayName = 'Input';
```

### Generic Components with ref

```typescript
type SelectProps<T> = {
  ref?: React.Ref<HTMLSelectElement>;
  options: T[];
  value: T;
  onChange: (value: T) => void;
  getLabel: (option: T) => string;
};

export function Select<T>({ ref, options, value, onChange, getLabel }: SelectProps<T>) {
  return (
    <select
      ref={ref}
      value={getLabel(value)}
      onChange={(e) => {
        const selected = options.find((opt) => getLabel(opt) === e.target.value);
        if (selected) onChange(selected);
      }}
    >
      {options.map((opt) => (
        <option key={getLabel(opt)} value={getLabel(opt)}>
          {getLabel(opt)}
        </option>
      ))}
    </select>
  );
}
```

### Combining ref with Other Props

```typescript
type ButtonProps = {
  ref?: React.Ref<HTMLButtonElement>;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
} & React.ComponentPropsWithoutRef<'button'>;

export function Button({
  ref,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      className={`btn btn-${variant} btn-${size} ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

## useActionState - Form State Management

Replaces useFormState — manages form submission state with Server Actions.

```typescript
'use client';

import { useActionState } from 'react';

type FormState = {
  success?: boolean;
  errors?: Record<string, string[]>;
  message?: string;
};

type FormData = {
  email: string;
  password: string;
};

// Server Action
async function login(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  'use server';

  const email = formData.get('email');
  const password = formData.get('password');

  if (!email || typeof email !== 'string') {
    return {
      success: false,
      errors: { email: ['Email is required'] },
    };
  }

  if (!password || typeof password !== 'string') {
    return {
      success: false,
      errors: { password: ['Password is required'] },
    };
  }

  try {
    await signIn(email, password);
    return { success: true, message: 'Logged in successfully' };
  } catch (error) {
    return {
      success: false,
      message: 'Invalid credentials',
    };
  }
}

// Client Component
export function LoginForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    login,
    {} // Initial state
  );

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          aria-invalid={!!state.errors?.email}
        />
        {state.errors?.email?.map((error) => (
          <p key={error} className="error">{error}</p>
        ))}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          aria-invalid={!!state.errors?.password}
        />
        {state.errors?.password?.map((error) => (
          <p key={error} className="error">{error}</p>
        ))}
      </div>

      {state.message && (
        <div className={state.success ? 'success' : 'error'}>
          {state.message}
        </div>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
}
```

### useActionState with Optimistic Updates

```typescript
'use client';

import { useActionState, useOptimistic } from 'react';

type Todo = { id: string; title: string; completed: boolean };

async function toggleTodo(
  prevState: { todos: Todo[] },
  formData: FormData
): Promise<{ todos: Todo[] }> {
  'use server';

  const todoId = formData.get('todoId') as string;
  await db.todo.update({
    where: { id: todoId },
    data: { completed: { toggle: true } },
  });

  const todos = await db.todo.findMany();
  return { todos };
}

export function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [state, formAction] = useActionState(
    toggleTodo,
    { todos: initialTodos }
  );

  const [optimisticTodos, setOptimisticTodos] = useOptimistic(
    state.todos,
    (currentTodos, todoId: string) =>
      currentTodos.map((todo) =>
        todo.id === todoId ? { ...todo, completed: !todo.completed } : todo
      )
  );

  return (
    <ul>
      {optimisticTodos.map((todo) => (
        <li key={todo.id}>
          <form
            action={(formData) => {
              setOptimisticTodos(todo.id);
              formAction(formData);
            }}
          >
            <input type="hidden" name="todoId" value={todo.id} />
            <button type="submit">
              {todo.completed ? '✓' : '○'} {todo.title}
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
```

## use() Hook - Unwrapping Resources

use() unwraps promises and context — enables new patterns for data fetching.

### use() with Promises

```typescript
// Server Component
async function UserPage({ params }: { params: { id: string } }) {
  // Pass promise without awaiting
  const userPromise = fetchUser(params.id);

  return (
    <Suspense fallback={<UserSkeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}

// Client Component
'use client';

import { use } from 'react';

type UserProfileProps = {
  userPromise: Promise<User>;
};

export function UserProfile({ userPromise }: UserProfileProps) {
  // Suspends until resolved
  const user = use(userPromise);

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### Conditional use()

use() can be called conditionally — unlike hooks.

```typescript
'use client';

import { use } from 'react';

type Props = {
  userPromise?: Promise<User>;
  userId?: string;
};

export function UserDisplay({ userPromise, userId }: Props) {
  let user: User | undefined;

  if (userPromise) {
    user = use(userPromise); // Conditional use() - allowed!
  } else if (userId) {
    // Fetch inline
    user = use(fetchUser(userId));
  }

  if (!user) return <div>No user data</div>;

  return <div>{user.name}</div>;
}
```

### use() in Loops

```typescript
'use client';

import { use } from 'react';

type Props = {
  userPromises: Promise<User>[];
};

export function UserList({ userPromises }: Props) {
  return (
    <ul>
      {userPromises.map((promise, index) => {
        const user = use(promise); // use() in loop - allowed!
        return <li key={user.id}>{user.name}</li>;
      })}
    </ul>
  );
}
```

### use() with Context

Alternative to useContext — can be called conditionally.

```typescript
import { createContext, use } from 'react';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<Theme>('light');

export function ThemedComponent({ override }: { override?: Theme }) {
  let theme: Theme;

  if (override) {
    theme = override;
  } else {
    theme = use(ThemeContext); // Conditional context access
  }

  return <div className={theme}>Content</div>;
}
```

## useOptimistic - Optimistic UI Updates

Show immediate UI feedback before server confirms.

```typescript
'use client';

import { useOptimistic } from 'react';

type Message = { id: string; text: string; sending?: boolean };

export function MessageThread({ messages }: { messages: Message[] }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newMessage: Message) => [...state, newMessage]
  );

  async function sendMessage(formData: FormData) {
    const text = formData.get('message') as string;

    // Add optimistic message immediately
    addOptimisticMessage({ id: 'temp', text, sending: true });

    // Send to server
    await fetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  return (
    <div>
      <ul>
        {optimisticMessages.map((msg) => (
          <li key={msg.id} className={msg.sending ? 'opacity-50' : ''}>
            {msg.text}
          </li>
        ))}
      </ul>

      <form action={sendMessage}>
        <input name="message" required />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### useOptimistic with State Updates

```typescript
'use client';

import { useOptimistic, useState, useTransition } from 'react';

type Item = { id: string; name: string; quantity: number };

export function ShoppingCart({ items: initialItems }: { items: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();

  const [optimisticItems, updateOptimistic] = useOptimistic(
    items,
    (state, { id, quantity }: { id: string; quantity: number }) =>
      state.map((item) =>
        item.id === id ? { ...item, quantity } : item
      )
  );

  async function updateQuantity(id: string, quantity: number) {
    // Optimistic update
    updateOptimistic({ id, quantity });

    // Server update
    startTransition(async () => {
      const updated = await fetch(`/api/cart/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      }).then((r) => r.json());

      setItems(updated);
    });
  }

  return (
    <ul>
      {optimisticItems.map((item) => (
        <li key={item.id}>
          {item.name}
          <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>
            -
          </button>
          <span>{item.quantity}</span>
          <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>
            +
          </button>
        </li>
      ))}
    </ul>
  );
}
```

## useTransition - Non-Blocking Updates

Mark state updates as non-urgent — UI stays responsive.

```typescript
'use client';

import { useTransition, useState } from 'react';

export function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(value: string) {
    setQuery(value); // Urgent - update input immediately

    startTransition(() => {
      // Non-urgent - can be interrupted
      const filtered = hugeDataset.filter((item) =>
        item.toLowerCase().includes(value.toLowerCase())
      );
      setResults(filtered);
    });
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search..."
      />

      {isPending && <div>Searching...</div>}

      <ul>
        {results.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
    </div>
  );
}
```

### useTransition with Server Actions

```typescript
'use client';

import { useTransition } from 'react';
import { deletePost } from '@/actions/posts';

export function DeleteButton({ postId }: { postId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deletePost(postId);
      // UI stays responsive during deletion
    });
  }

  return (
    <button onClick={handleDelete} disabled={isPending}>
      {isPending ? 'Deleting...' : 'Delete'}
    </button>
  );
}
```

## useDeferredValue - Deferred Rendering

Defer expensive re-renders while keeping UI responsive.

```typescript
'use client';

import { useDeferredValue, useState } from 'react';

export function ProductSearch() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
      />

      {/* Uses deferred value - won't block input */}
      <ExpensiveResults query={deferredQuery} />
    </div>
  );
}

function ExpensiveResults({ query }: { query: string }) {
  const results = useMemo(() => {
    // Expensive filtering/sorting
    return products.filter((p) => p.name.includes(query));
  }, [query]);

  return (
    <ul>
      {results.map((result) => (
        <li key={result.id}>{result.name}</li>
      ))}
    </ul>
  );
}
```

## Migration Checklist

Updating from React 18 to React 19:

- [ ] Replace forwardRef with ref as prop
- [ ] Replace useFormState with useActionState
- [ ] Update Server Action types to include prevState parameter
- [ ] Use use() for promises in Server Components
- [ ] Add 'use server' directive to Server Actions
- [ ] Add 'use client' directive to Client Components
- [ ] Update TypeScript to 5.0+ for better React 19 support
- [ ] Update @types/react to 19.x
- [ ] Test all forms with useActionState
- [ ] Verify ref forwarding works without forwardRef
