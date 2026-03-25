# Neon Auth Setup - React SPA (Vite)

Complete setup instructions for Neon Auth in React Single Page Applications (Vite, Create React App, etc.).

---

## 1. Install Package

```bash
npm install @neondatabase/auth
# Or: npm install @neondatabase/neon-js
npm install react-router-dom  # Required for UI components
```

## 2. Environment Variables

Create or update `.env`:

**For Vite:**

```bash
VITE_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
```

**For Create React App:**

```bash
REACT_APP_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
```

**Where to find your Auth URL:**

1. Go to your Neon project dashboard
2. Navigate to the "Auth" tab
3. Copy the Auth URL

## 3. Auth Client Configuration

Create `src/lib/auth-client.ts`:

**For `@neondatabase/auth`:**

```typescript
import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
});
```

**For `@neondatabase/neon-js`:**

```typescript
import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

export const client = createClient({
  auth: {
    adapter: BetterAuthReactAdapter(),
    url: import.meta.env.VITE_NEON_AUTH_URL,
  },
  dataApi: {
    url: import.meta.env.VITE_NEON_DATA_API_URL,
  },
});

export const authClient = client.auth;
```

**Critical:**

- `BetterAuthReactAdapter` must be imported from the `/react/adapters` subpath
- The adapter must be called as a function: `BetterAuthReactAdapter()`

## 4. Use in Components

```typescript
import { authClient } from "./lib/auth-client";

function App() {
  const session = authClient.useSession();

  if (session.isPending) return <div>Loading...</div>;
  if (!session.data) return <LoginForm />;

  return <Dashboard user={session.data.user} />;
}
```

---

## 5. UI Provider Setup (Optional)

Skip this section if you're building custom auth forms. Use this if you want pre-built UI components.

### 5a. Import CSS

**CRITICAL:** Choose ONE import method. Never import both - it causes duplicate styles.

**Check if the project uses Tailwind CSS** by looking for:

- `tailwind.config.js` or `tailwind.config.ts` in the project root
- `@import 'tailwindcss'` or `@tailwind` directives in CSS files
- `tailwindcss` in package.json dependencies

**If NOT using Tailwind** - Add to `src/main.tsx` or entry point:

```typescript
import "@neondatabase/auth/ui/css";
```

**If using Tailwind CSS v4** - Add to main CSS file (e.g., index.css):

```css
@import "tailwindcss";
@import "@neondatabase/auth/ui/tailwind";
```

### 5b. Update main.tsx with BrowserRouter

```tsx
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@neondatabase/auth/ui/css"; // if not using Tailwind
import App from "./App";
import { Providers } from "./providers";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Providers>
      <App />
    </Providers>
  </BrowserRouter>,
);
```

### 5c. Create Auth Provider

Create `src/providers.tsx`:

```tsx
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { authClient } from "./lib/auth-client";
import type { ReactNode } from "react";

// Adapter for react-router-dom Link
function Link({
  href,
  ...props
}: { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <RouterLink to={href} {...props} />;
}

export function Providers({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={(path) => navigate(path)}
      replace={(path) => navigate(path, { replace: true })}
      onSessionChange={() => {
        // Optional: refresh data or invalidate cache
      }}
      Link={Link}
      social={{
        providers: ["google", "github"],
      }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
```

**Provider props explained:**

- `navigate`: Function to navigate to a new route
- `replace`: Function to replace current route (for redirects)
- `onSessionChange`: Callback when auth state changes (useful for cache invalidation)
- `Link`: Adapter component for react-router-dom's Link
- `social`: Show Google and GitHub sign-in buttons (both enabled by default in Neon)

### 5d. Add Routes to App.tsx

```tsx
import { Routes, Route, useParams } from "react-router-dom";
import {
  AuthView,
  UserButton,
  SignedIn,
  SignedOut,
} from "@neondatabase/auth/react/ui";

// Auth page - handles /auth/sign-in, /auth/sign-up, etc.
function AuthPage() {
  const { pathname } = useParams();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <AuthView pathname={pathname} />
    </div>
  );
}

// Simple navbar example
function Navbar() {
  return (
    <nav className="flex items-center justify-between p-4 border-b">
      <a href="/">My App</a>
      <div className="flex items-center gap-4">
        <SignedOut>
          <a href="/auth/sign-in">Sign In</a>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </nav>
  );
}

function HomePage() {
  return <div>Welcome to My App!</div>;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/:pathname" element={<AuthPage />} />
      </Routes>
    </>
  );
}
```

**Auth routes created:**

- `/auth/sign-in` - Sign in page
- `/auth/sign-up` - Sign up page
- `/auth/forgot-password` - Password reset request
- `/auth/reset-password` - Set new password
- `/auth/sign-out` - Sign out
- `/auth/callback` - OAuth callback (internal)
