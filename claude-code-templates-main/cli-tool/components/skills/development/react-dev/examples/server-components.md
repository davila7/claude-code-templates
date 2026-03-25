# Server Components and Server Actions

React 19 Server Components run on server, can be async, enable zero-bundle data fetching. Server Actions handle mutations with progressive enhancement.

## Async Server Component

Server Components can be async functions — await data fetching directly.

```typescript
// app/users/[id]/page.tsx
type PageProps = {
  params: { id: string };
  searchParams?: { tab?: string; edit?: string };
};

export default async function UserPage({ params, searchParams }: PageProps) {
  // Runs on server - no client bundle
  const user = await fetchUser(params.id);
  const posts = await fetchUserPosts(params.id);

  return (
    <div>
      <header>
        <h1>{user.name}</h1>
        <p>{user.email}</p>
      </header>

      <UserTabs user={user} posts={posts} activeTab={searchParams?.tab} />

      {searchParams?.edit === 'true' && (
        <UserEditForm user={user} />
      )}
    </div>
  );
}

async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`https://api.example.com/users/${id}`, {
    cache: 'no-store', // Or 'force-cache', 'revalidate'
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}
```

## Parallel Data Fetching

Fetch multiple resources in parallel with Promise.all.

```typescript
type DashboardProps = {
  params: { userId: string };
};

export default async function Dashboard({ params }: DashboardProps) {
  // Parallel fetching
  const [user, stats, activity] = await Promise.all([
    fetchUser(params.userId),
    fetchUserStats(params.userId),
    fetchRecentActivity(params.userId),
  ]);

  return (
    <div>
      <UserHeader user={user} />
      <StatsGrid stats={stats} />
      <ActivityFeed items={activity} />
    </div>
  );
}
```

## Sequential vs Waterfall Fetching

```typescript
// ❌ Waterfall - slow
async function SlowPage() {
  const user = await fetchUser('123');
  const posts = await fetchUserPosts(user.id); // Waits for user
  const comments = await fetchPostComments(posts[0].id); // Waits for posts
  return <div>...</div>;
}

// ✅ Parallel - fast
async function FastPage() {
  const userPromise = fetchUser('123');
  const postsPromise = fetchUserPosts('123');

  const [user, posts] = await Promise.all([userPromise, postsPromise]);

  // If comments depend on posts, fetch after
  const comments = await fetchPostComments(posts[0].id);

  return <div>...</div>;
}
```

## Server Actions - Form Mutations

Server Actions marked with 'use server' — run on server, callable from client.

```typescript
// actions/user.ts
'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
});

type FormState = {
  success?: boolean;
  errors?: Record<string, string[]>;
  message?: string;
};

export async function updateUser(
  userId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // Validate
  const parsed = updateUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    bio: formData.get('bio'),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // Mutate database
    await db.user.update({
      where: { id: userId },
      data: parsed.data,
    });

    // Revalidate cached data
    revalidatePath(`/users/${userId}`);
    revalidateTag(`user-${userId}`);

    return { success: true, message: 'Profile updated successfully' };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to update profile. Please try again.',
    };
  }
}

export async function deleteUser(userId: string) {
  await db.user.delete({ where: { id: userId } });
  revalidatePath('/users');
  redirect('/users'); // Navigate after mutation
}
```

## Client Component Using Server Action

```typescript
// components/UserForm.tsx
'use client';

import { useActionState } from 'react';
import { updateUser } from '@/actions/user';

type FormState = {
  success?: boolean;
  errors?: Record<string, string[]>;
  message?: string;
};

export function UserEditForm({ userId, initialData }: Props) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    (prevState, formData) => updateUser(userId, prevState, formData),
    {}
  );

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          defaultValue={initialData.name}
          required
          aria-invalid={!!state.errors?.name}
        />
        {state.errors?.name?.map((error) => (
          <p key={error} className="error">
            {error}
          </p>
        ))}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={initialData.email}
          required
          aria-invalid={!!state.errors?.email}
        />
        {state.errors?.email?.map((error) => (
          <p key={error} className="error">
            {error}
          </p>
        ))}
      </div>

      <div>
        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={initialData.bio}
          aria-invalid={!!state.errors?.bio}
        />
        {state.errors?.bio?.map((error) => (
          <p key={error} className="error">
            {error}
          </p>
        ))}
      </div>

      {state.message && (
        <div className={state.success ? 'success' : 'error'}>{state.message}</div>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
```

## Programmatic Server Action

Call Server Actions directly from client code, not just forms.

```typescript
'use client';

import { deleteUser } from '@/actions/user';
import { useTransition } from 'react';

export function DeleteButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    startTransition(async () => {
      try {
        await deleteUser(userId);
        // deleteUser calls redirect(), navigation happens automatically
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    });
  };

  return (
    <button onClick={handleDelete} disabled={isPending}>
      {isPending ? 'Deleting...' : 'Delete User'}
    </button>
  );
}
```

## use() Hook - Unwrapping Promises

Pass promises from Server to Client components, unwrap with use().

```typescript
// Server Component
async function UserPage({ params }: { params: { id: string } }) {
  // Don't await - pass promise to client
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

type Props = {
  userPromise: Promise<User>;
};

export function UserProfile({ userPromise }: Props) {
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

## use() with Context

use() also unwraps context — alternative to useContext.

```typescript
'use client';

import { use } from 'react';
import { ThemeContext } from './ThemeProvider';

export function ThemedButton() {
  const theme = use(ThemeContext); // Same as useContext(ThemeContext)

  return <button className={theme.mode}>{theme.primaryColor}</button>;
}
```

## Streaming with Suspense

Stream components as they resolve — faster initial page load.

```typescript
// Server Component
export default async function Page() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Renders immediately */}
      <StaticContent />

      {/* Streams when ready */}
      <Suspense fallback={<Spinner />}>
        <SlowComponent />
      </Suspense>

      {/* Independent stream */}
      <Suspense fallback={<Skeleton />}>
        <AnotherSlowComponent />
      </Suspense>
    </div>
  );
}

async function SlowComponent() {
  const data = await slowFetch(); // Takes 2s
  return <div>{data}</div>;
}

async function AnotherSlowComponent() {
  const data = await anotherSlowFetch(); // Takes 1s
  return <div>{data}</div>;
}
```

## Error Handling in Server Components

Use error.tsx for error boundaries.

```typescript
// app/users/[id]/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

// Server Component throws error
export default async function UserPage({ params }: Props) {
  const user = await fetchUser(params.id);

  if (!user) {
    throw new Error('User not found'); // Caught by error.tsx
  }

  return <div>{user.name}</div>;
}
```

## Loading States with loading.tsx

```typescript
// app/users/[id]/loading.tsx
export default function Loading() {
  return <UserSkeleton />;
}

// Automatically wraps page in Suspense
// No need for manual Suspense boundary
```

## Server-Only Code

Ensure code never runs on client.

```typescript
// lib/server-only-utils.ts
import 'server-only'; // Throws if imported in client component

export async function getSecretKey() {
  return process.env.SECRET_KEY; // Safe - never in client bundle
}

export async function hashPassword(password: string) {
  const bcrypt = await import('bcrypt');
  return bcrypt.hash(password, 10);
}
```

## Client-Only Code

Ensure code never runs on server.

```typescript
// lib/client-only-utils.ts
import 'client-only';

export function useLocalStorage(key: string) {
  // localStorage only available in browser
  const [value, setValue] = useState(() => localStorage.getItem(key));

  useEffect(() => {
    localStorage.setItem(key, value || '');
  }, [key, value]);

  return [value, setValue] as const;
}
```

## Mixing Server and Client Components

```typescript
// app/page.tsx (Server Component)
export default async function Page() {
  const data = await fetchData();

  return (
    <div>
      {/* Server Component - can be async */}
      <ServerComponent data={data} />

      {/* Client Component - interactive */}
      <ClientComponent initialData={data} />
    </div>
  );
}

// ServerComponent.tsx (Server Component - default)
export function ServerComponent({ data }: { data: Data }) {
  return <div>{data.title}</div>;
}

// ClientComponent.tsx (Client Component)
'use client';

export function ClientComponent({ initialData }: { initialData: Data }) {
  const [data, setData] = useState(initialData);

  return (
    <button onClick={() => setData({ ...data, count: data.count + 1 })}>
      {data.count}
    </button>
  );
}
```

## Server Component Patterns

```typescript
// ✅ Server Component can:
// - Be async
// - Fetch data directly
// - Access backend resources (DB, filesystem)
// - Use server-only packages
// - Pass serializable props to client components

export default async function Page() {
  const db = await connectDB(); // Direct DB access
  const users = await db.user.findMany();

  return <UserList users={users} />; // Pass serializable data
}

// ❌ Server Component cannot:
// - Use hooks (useState, useEffect, etc)
// - Use browser APIs (localStorage, window, etc)
// - Add event listeners (onClick, onChange, etc)
// - Use React Context

// ✅ Client Component can:
// - Use hooks
// - Use browser APIs
// - Add event listeners
// - Use React Context
// - Import Server Components as children

'use client';

export function Layout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('light');

  return (
    <div className={theme}>
      <button onClick={() => setTheme('dark')}>Toggle</button>
      {children} {/* Server Component can be child */}
    </div>
  );
}

// ❌ Client Component cannot:
// - Be async
// - Directly access backend resources
// - Import server-only packages
```

## Progressive Enhancement with Server Actions

Forms work without JavaScript when using Server Actions.

```typescript
// components/AddTodoForm.tsx
import { addTodo } from '@/actions/todos';

export function AddTodoForm() {
  return (
    <form action={addTodo}>
      <input name="title" required />
      <button type="submit">Add Todo</button>
      {/* Works without JS - progressive enhancement */}
    </form>
  );
}

// actions/todos.ts
'use server';

export async function addTodo(formData: FormData) {
  const title = formData.get('title');
  if (typeof title !== 'string') return;

  await db.todo.create({ data: { title } });
  revalidatePath('/todos');
}
```
