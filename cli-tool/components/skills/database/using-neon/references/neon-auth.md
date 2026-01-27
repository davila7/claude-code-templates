# Neon Auth

Neon Auth provides authentication for your application. It's available as:

- `@neondatabase/auth` - Auth only (smaller bundle)
- `@neondatabase/neon-js` - Auth + Data API (full SDK, see `neon-js.md`)

For official documentation:

```bash
curl -H "Accept: text/markdown" https://neon.tech/docs/auth/overview
```

## Package Selection

| Need                    | Package                 | Bundle  |
| ----------------------- | ----------------------- | ------- |
| Auth only               | `@neondatabase/auth`    | Smaller |
| Auth + Database queries | `@neondatabase/neon-js` | Full    |

## Installation

```bash
# Auth only
npm install @neondatabase/auth

# Auth + Data API
npm install @neondatabase/neon-js
```

## Quick Setup Patterns

### Next.js App Router

**1. API Route Handler:**

```typescript
// app/api/auth/[...path]/route.ts
import { authApiHandler } from "@neondatabase/auth/next";
export const { GET, POST } = authApiHandler();
```

**2. Auth Client:**

```typescript
// lib/auth/client.ts
import { createAuthClient } from "@neondatabase/auth/next";
export const authClient = createAuthClient();
```

**3. Use in Components:**

```typescript
"use client";
import { authClient } from "@/lib/auth/client";

function AuthStatus() {
  const session = authClient.useSession();
  if (session.isPending) return <div>Loading...</div>;
  if (!session.data) return <SignInButton />;
  return <div>Hello, {session.data.user.name}</div>;
}
```

### React SPA

```typescript
import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
});
```

### Node.js Backend

```typescript
import { createAuthClient } from "@neondatabase/auth";

const auth = createAuthClient(process.env.NEON_AUTH_URL!);
await auth.signIn.email({ email, password });
const session = await auth.getSession();
```

## Environment Variables

```bash
# Next.js (.env.local)
NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth

# Vite/React (.env)
VITE_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
```

## Sub-Resources

For detailed documentation:

| Topic                    | Resource                       |
| ------------------------ | ------------------------------ |
| Next.js App Router setup | `neon-auth/setup-nextjs.md`    |
| React SPA setup          | `neon-auth/setup-react-spa.md` |
| Auth methods reference   | `neon-auth/auth-methods.md`    |
| UI components            | `neon-auth/ui-components.md`   |
| Common mistakes          | `neon-auth/common-mistakes.md` |

## Key Imports

```typescript
// Auth client (Next.js)
import { authApiHandler, createAuthClient } from "@neondatabase/auth/next";

// Auth client (vanilla)
import { createAuthClient } from "@neondatabase/auth";

// React adapter (NOT from main entry)
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

// UI components
import {
  NeonAuthUIProvider,
  AuthView,
  SignInForm,
} from "@neondatabase/auth/react/ui";
import { authViewPaths } from "@neondatabase/auth/react/ui/server";

// CSS
import "@neondatabase/auth/ui/css";
```

## Common Mistakes

1. **Wrong adapter import**: Import `BetterAuthReactAdapter` from `auth/react/adapters` subpath
2. **Forgetting to call adapter**: Use `BetterAuthReactAdapter()` with parentheses
3. **Missing CSS**: Import from `ui/css` or `ui/tailwind` (not both)
4. **Missing "use client"**: Required for components using `useSession()`
5. **Wrong createAuthClient signature**: First arg is URL: `createAuthClient(url, { adapter })`

See `neon-auth/common-mistakes.md` for detailed examples.
