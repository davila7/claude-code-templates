# Neon JS - Common Mistakes

Reference guide for common mistakes when using `@neondatabase/neon-js`.

## Import Mistakes

### BetterAuthReactAdapter Subpath Requirement

`BetterAuthReactAdapter` is **NOT** exported from the main package entry.

**Wrong:**

```typescript
import { BetterAuthReactAdapter } from "@neondatabase/neon-js";
```

**Correct:**

```typescript
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";
```

### Adapter Factory Functions

All adapters must be called with `()`.

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

---

## CSS Import Mistakes

Choose **ONE** CSS import method:

**With Tailwind v4:**

```css
@import "tailwindcss";
@import "@neondatabase/neon-js/ui/tailwind";
```

**Without Tailwind:**

```typescript
import "@neondatabase/neon-js/ui/css";
```

**Never import both** - causes duplicate styles.

---

## Environment Variables

**Required for Next.js:**

```bash
# .env.local
NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
NEON_DATA_API_URL=https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/dbname/rest/v1
```

**Required for Vite/React SPA:**

```bash
# .env
VITE_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
VITE_NEON_DATA_API_URL=https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/dbname/rest/v1
```

---

## Usage Mistakes

### Missing "use client" Directive

```typescript
"use client"; // Required!

import { authClient } from "@/lib/auth/client";

function AuthStatus() {
  const session = authClient.useSession();
  // ...
}
```

### Wrong API for Adapter

| Adapter                | Sign In                                   | Sign Up                             |
| ---------------------- | ----------------------------------------- | ----------------------------------- |
| BetterAuthReactAdapter | `signIn.email({ email, password })`       | `signUp.email({ email, password })` |
| SupabaseAuthAdapter    | `signInWithPassword({ email, password })` | `signUp({ email, password })`       |

### Using neon-js for Auth Only

If you only need auth (no database queries), use `@neondatabase/auth` for smaller bundle size:

```bash
# Auth only - smaller bundle
npm install @neondatabase/auth

# Auth + Data API - full SDK
npm install @neondatabase/neon-js
```
