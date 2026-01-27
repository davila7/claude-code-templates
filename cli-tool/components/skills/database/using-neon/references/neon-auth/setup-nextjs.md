# Neon Auth Setup - Next.js App Router

Complete setup instructions for Neon Auth in Next.js App Router applications.

---

## 1. Install Package

```bash
npm install @neondatabase/auth
# Or: npm install @neondatabase/neon-js
```

## 2. Environment Variables

Create or update `.env.local`:

```bash
NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
```

**Important:** Both variables are needed:

- `NEON_AUTH_BASE_URL` - Used by server-side API routes
- `NEXT_PUBLIC_NEON_AUTH_URL` - Used by client-side components (prefixed with NEXT*PUBLIC*)

**Where to find your Auth URL:**

1. Go to your Neon project dashboard
2. Navigate to the "Auth" tab
3. Copy the Auth URL

## 3. API Route Handler

Create `app/api/auth/[...path]/route.ts`:

```typescript
import { authApiHandler } from "@neondatabase/auth/next";
// Or: import { authApiHandler } from "@neondatabase/neon-js/auth/next";

export const { GET, POST } = authApiHandler();
```

This creates endpoints for:

- `/api/auth/sign-in` - Sign in
- `/api/auth/sign-up` - Sign up
- `/api/auth/sign-out` - Sign out
- `/api/auth/session` - Get session
- And other auth-related endpoints

## 4. Auth Client Configuration

Create `lib/auth/client.ts`:

```typescript
import { createAuthClient } from "@neondatabase/auth/next";
// Or: import { createAuthClient } from "@neondatabase/neon-js/auth/next";

export const authClient = createAuthClient();
```

## 5. Use in Components

```typescript
"use client";

import { authClient } from "@/lib/auth/client";

function AuthStatus() {
  const session = authClient.useSession();

  if (session.isPending) return <div>Loading...</div>;
  if (!session.data) return <SignInButton />;

  return (
    <div>
      <p>Hello, {session.data.user.name}</p>
      <button onClick={() => authClient.signOut()}>Sign Out</button>
    </div>
  );
}

function SignInButton() {
  return (
    <button onClick={() => authClient.signIn.email({
      email: "user@example.com",
      password: "password"
    })}>
      Sign In
    </button>
  );
}
```

## 6. UI Provider Setup (Optional)

For pre-built UI components (AuthView, UserButton, etc.), see `ui-components.md`.

---

## Package Selection

| Need                    | Package                 | Bundle Size     |
| ----------------------- | ----------------------- | --------------- |
| Auth only               | `@neondatabase/auth`    | Smaller (~50KB) |
| Auth + Database queries | `@neondatabase/neon-js` | Full (~150KB)   |

**Recommendation:** Use `@neondatabase/auth` if you only need authentication. Use `@neondatabase/neon-js` if you also need PostgREST-style database queries.
