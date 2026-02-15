# Neon JS SDK

The `@neondatabase/neon-js` SDK provides a unified client for Neon Auth and Data API. It combines authentication handling with PostgREST-compatible database queries.

**Auth only?** Use `neon-auth.md` instead for smaller bundle size.

For official documentation:

```bash
curl -H "Accept: text/markdown" https://neon.tech/docs/reference/javascript-sdk
```

## Package Selection

| Use Case        | Package                      | Notes               |
| --------------- | ---------------------------- | ------------------- |
| Auth + Data API | `@neondatabase/neon-js`      | Full SDK            |
| Auth only       | `@neondatabase/auth`         | Smaller bundle      |
| Data API only   | `@neondatabase/postgrest-js` | Bring your own auth |

## Installation

```bash
npm install @neondatabase/neon-js
```

## Quick Setup Patterns

### Next.js (Most Common)

**1. API Route Handler:**

```typescript
// app/api/auth/[...path]/route.ts
import { authApiHandler } from "@neondatabase/neon-js/auth/next";
export const { GET, POST } = authApiHandler();
```

**2. Auth Client:**

```typescript
// lib/auth/client.ts
import { createAuthClient } from "@neondatabase/neon-js/auth/next";
export const authClient = createAuthClient();
```

**3. Database Client:**

```typescript
// lib/db/client.ts
import { createClient } from "@neondatabase/neon-js";
import type { Database } from "./database.types";

export const dbClient = createClient<Database>({
  auth: { url: process.env.NEXT_PUBLIC_NEON_AUTH_URL! },
  dataApi: { url: process.env.NEON_DATA_API_URL! },
});
```

### React SPA

```typescript
import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

const client = createClient<Database>({
  auth: {
    adapter: BetterAuthReactAdapter(),
    url: import.meta.env.VITE_NEON_AUTH_URL,
  },
  dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL },
});
```

### Node.js Backend

```typescript
import { createClient } from "@neondatabase/neon-js";

const client = createClient<Database>({
  auth: { url: process.env.NEON_AUTH_URL! },
  dataApi: { url: process.env.NEON_DATA_API_URL! },
});
```

## Environment Variables

```bash
# Next.js (.env.local)
NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
NEON_DATA_API_URL=https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/dbname/rest/v1

# Vite/React (.env)
VITE_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
VITE_NEON_DATA_API_URL=https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/dbname/rest/v1
```

## Database Queries

All query methods follow PostgREST syntax (same as Supabase):

```typescript
// Select with filters
const { data } = await client
  .from("items")
  .select("id, name, status")
  .eq("status", "active")
  .order("created_at", { ascending: false })
  .limit(10);

// Insert
const { data, error } = await client
  .from("items")
  .insert({ name: "New Item", status: "pending" })
  .select()
  .single();

// Update
await client.from("items").update({ status: "completed" }).eq("id", 1);

// Delete
await client.from("items").delete().eq("id", 1);
```

For complete Data API query reference, see `neon-js/data-api.md`.

## Auth Methods

### BetterAuth API (Default)

```typescript
// Sign in/up
await client.auth.signIn.email({ email, password });
await client.auth.signUp.email({ email, password, name });
await client.auth.signOut();

// Get session
const session = await client.auth.getSession();

// Social sign-in
await client.auth.signIn.social({
  provider: "google",
  callbackURL: "/dashboard",
});
```

### Supabase-Compatible API

```typescript
import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";

const client = createClient({
  auth: { adapter: SupabaseAuthAdapter(), url },
  dataApi: { url },
});

await client.auth.signInWithPassword({ email, password });
await client.auth.signUp({ email, password });
const {
  data: { session },
} = await client.auth.getSession();
```

## Sub-Resources

| Topic            | Resource                     |
| ---------------- | ---------------------------- |
| Data API queries | `neon-js/data-api.md`        |
| Common mistakes  | `neon-js/common-mistakes.md` |

## Key Imports

```typescript
// Main client
import {
  createClient,
  SupabaseAuthAdapter,
  BetterAuthVanillaAdapter,
} from "@neondatabase/neon-js";

// Next.js integration
import {
  authApiHandler,
  createAuthClient,
} from "@neondatabase/neon-js/auth/next";

// React adapter (NOT from main entry - must use subpath)
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

// UI components
import {
  NeonAuthUIProvider,
  AuthView,
  SignInForm,
} from "@neondatabase/neon-js/auth/react/ui";
import { authViewPaths } from "@neondatabase/neon-js/auth/react/ui/server";

// CSS (choose one)
import "@neondatabase/neon-js/ui/css"; // Without Tailwind
// @import '@neondatabase/neon-js/ui/tailwind'; // With Tailwind v4 (in CSS file)
```

## Generate Types

```bash
npx neon-js gen-types --db-url "postgresql://..." --output src/types/database.ts
```

## Common Mistakes

1. **Wrong adapter import**: Import `BetterAuthReactAdapter` from `auth/react/adapters` subpath
2. **Forgetting to call adapter**: Use `SupabaseAuthAdapter()` with parentheses
3. **Missing CSS import**: Import from `ui/css` or `ui/tailwind` (not both)
4. **Wrong package for auth-only**: Use `@neondatabase/auth` for smaller bundle
5. **Missing "use client"**: Required for auth client components

See `neon-js/common-mistakes.md` for detailed examples.
