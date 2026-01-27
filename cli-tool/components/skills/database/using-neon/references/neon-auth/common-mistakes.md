# Neon Auth - Common Mistakes

Reference guide for common mistakes when using `@neondatabase/auth` or `@neondatabase/neon-js`.

## Import Mistakes

### BetterAuthReactAdapter Subpath Requirement

`BetterAuthReactAdapter` is **NOT** exported from the main package entry. You must import it from the subpath.

**Wrong:**

```typescript
// These will NOT work
import { BetterAuthReactAdapter } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/auth";
```

**Correct:**

```typescript
// For @neondatabase/neon-js
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

// For @neondatabase/auth
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";
```

**Why:** The React adapter has React-specific dependencies and is tree-shaken out of the main bundle. Using subpath exports keeps the main bundle smaller for non-React environments.

### Adapter Factory Functions

All adapters are **factory functions** that must be called with `()`.

**Wrong:**

```typescript
const client = createClient({
  auth: {
    adapter: BetterAuthReactAdapter, // Missing ()
    url: process.env.NEON_AUTH_URL!,
  },
  dataApi: { url: process.env.NEON_DATA_API_URL! },
});
```

**Correct:**

```typescript
const client = createClient({
  auth: {
    adapter: BetterAuthReactAdapter(), // Called as function
    url: process.env.NEON_AUTH_URL!,
  },
  dataApi: { url: process.env.NEON_DATA_API_URL! },
});
```

This applies to all adapters:

- `BetterAuthReactAdapter()`
- `BetterAuthVanillaAdapter()`
- `SupabaseAuthAdapter()`

---

## CSS Import Mistakes

Auth UI components require CSS. Choose **ONE** method based on your project.

### With Tailwind v4

```css
/* In app/globals.css */
@import "tailwindcss";
@import "@neondatabase/neon-js/ui/tailwind";
/* Or: @import '@neondatabase/auth/ui/tailwind'; */
```

### Without Tailwind

```typescript
// In app/layout.tsx
import "@neondatabase/neon-js/ui/css";
// Or: import "@neondatabase/auth/ui/css";
```

### Never Import Both

**Wrong:**

```css
/* Causes ~94KB of duplicate styles */
@import "@neondatabase/neon-js/ui/css";
@import "@neondatabase/neon-js/ui/tailwind";
```

**Why:** The `ui/css` import includes pre-built CSS (~47KB). The `ui/tailwind` import provides Tailwind tokens (~2KB) that generate similar styles. Using both doubles your CSS bundle.

---

## Configuration Mistakes

### Wrong createAuthClient Signature

The `createAuthClient` function takes the URL as the first argument, not as a property in an options object.

**Wrong:**

```typescript
// This will NOT work
createAuthClient({ baseURL: url });
createAuthClient({ url: myUrl });
```

**Correct:**

```typescript
// Vanilla client - URL as first arg
createAuthClient(url);

// With adapter - URL as first arg, options as second
createAuthClient(url, { adapter: BetterAuthReactAdapter() });

// Next.js client - no arguments (uses env vars automatically)
import { createAuthClient } from "@neondatabase/auth/next";
const authClient = createAuthClient();
```

### Missing Environment Variables

**Required for Next.js:**

```bash
# .env.local
NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth

# For neon-js (auth + data)
NEON_DATA_API_URL=https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/dbname/rest/v1
```

**Required for Vite/React SPA:**

```bash
# .env
VITE_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
VITE_NEON_DATA_API_URL=https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/dbname/rest/v1
```

**Important:**

- `NEON_AUTH_BASE_URL` - Server-side auth
- `NEXT_PUBLIC_*` prefix - Required for client-side access in Next.js
- `VITE_*` prefix - Required for client-side access in Vite
- Restart dev server after adding env vars

---

## Usage Mistakes

### Missing "use client" Directive

Client components using `useSession()` need the `"use client"` directive.

**Wrong:**

```typescript
// Missing directive - will cause hydration errors
import { authClient } from "@/lib/auth/client";

function AuthStatus() {
  const session = authClient.useSession();
  // ...
}
```

**Correct:**

```typescript
"use client";

import { authClient } from "@/lib/auth/client";

function AuthStatus() {
  const session = authClient.useSession();
  // ...
}
```

### Wrong API for Adapter

Each adapter has its own API style. Don't mix them.

**Wrong - BetterAuth API with SupabaseAuthAdapter:**

```typescript
const client = createClient({
  auth: { adapter: SupabaseAuthAdapter(), url },
  dataApi: { url },
});

// This won't work with SupabaseAuthAdapter
await client.auth.signIn.email({ email, password });
```

**Correct - Supabase API with SupabaseAuthAdapter:**

```typescript
const client = createClient({
  auth: { adapter: SupabaseAuthAdapter(), url },
  dataApi: { url },
});

// Use Supabase-style methods
await client.auth.signInWithPassword({ email, password });
```

**API Reference by Adapter:**

| Adapter                  | Sign In                                   | Sign Up                             | Get Session                     |
| ------------------------ | ----------------------------------------- | ----------------------------------- | ------------------------------- |
| BetterAuthVanillaAdapter | `signIn.email({ email, password })`       | `signUp.email({ email, password })` | `getSession()`                  |
| BetterAuthReactAdapter   | `signIn.email({ email, password })`       | `signUp.email({ email, password })` | `useSession()` / `getSession()` |
| SupabaseAuthAdapter      | `signInWithPassword({ email, password })` | `signUp({ email, password })`       | `getSession()`                  |
