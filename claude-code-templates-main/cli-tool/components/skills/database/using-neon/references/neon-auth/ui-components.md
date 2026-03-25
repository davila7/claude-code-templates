# Neon Auth - UI Components Reference

Pre-built UI components for authentication flows.

## Available Components

- `AuthView` - Complete auth pages (sign-in, sign-up, forgot-password, etc.) - **use this first**
- `SignedIn` / `SignedOut` - Conditional rendering based on auth state
- `UserButton` - User avatar with dropdown menu
- `NeonAuthUIProvider` - Required wrapper for UI components

## CSS Import

**CRITICAL:** Choose ONE import method. Never import both.

**Without Tailwind:**

```typescript
// In app/layout.tsx or entry point
import "@neondatabase/auth/ui/css";
```

**With Tailwind v4:**

```css
/* In app/globals.css */
@import "tailwindcss";
@import "@neondatabase/auth/ui/tailwind";
```

## NeonAuthUIProvider Setup

### Next.js App Router

```tsx
"use client";
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
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

### React SPA with react-router-dom

```tsx
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { authClient } from "./lib/auth-client";

function Link({
  href,
  ...props
}: { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <RouterLink to={href} {...props} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={(path) => navigate(path)}
      replace={(path) => navigate(path, { replace: true })}
      onSessionChange={() => {}}
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

## AuthView Component

Renders complete authentication pages.

### Next.js App Router

Create `app/auth/[path]/page.tsx`:

```tsx
import { AuthView } from "@neondatabase/auth/react/ui";
import { authViewPaths } from "@neondatabase/auth/react/ui/server";

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return <AuthView pathname={path} />;
}
```

### React SPA

```tsx
import { Routes, Route, useParams } from "react-router-dom";
import { AuthView } from "@neondatabase/auth/react/ui";

function AuthPage() {
  const { pathname } = useParams();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <AuthView pathname={pathname} />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth/:pathname" element={<AuthPage />} />
    </Routes>
  );
}
```

### Available Auth Paths

| Path              | Purpose                   |
| ----------------- | ------------------------- |
| `sign-in`         | Sign in page              |
| `sign-up`         | Sign up page              |
| `forgot-password` | Password reset request    |
| `reset-password`  | Set new password          |
| `magic-link`      | Magic link sign in        |
| `two-factor`      | Two-factor authentication |
| `callback`        | OAuth callback (internal) |
| `sign-out`        | Sign out                  |

## SignedIn / SignedOut Components

Conditional rendering based on authentication state.

```tsx
import { SignedIn, SignedOut, UserButton } from "@neondatabase/auth/react/ui";

function Navbar() {
  return (
    <nav>
      <SignedOut>
        <a href="/auth/sign-in">Sign In</a>
        <a href="/auth/sign-up">Sign Up</a>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </nav>
  );
}
```

## UserButton Component

Displays user avatar with dropdown menu for account management.

```tsx
import { UserButton } from "@neondatabase/auth/react/ui";

function Header() {
  return (
    <header>
      <h1>My App</h1>
      <UserButton />
    </header>
  );
}
```

## Social Login Configuration

**Important:** Social providers require TWO configurations:

1. **Enable in Neon Console** - Go to your project's Auth settings
2. **Add to NeonAuthUIProvider** - Pass `social` prop

```tsx
<NeonAuthUIProvider
  authClient={authClient}
  // ... other props
  social={{
    providers: ['google', 'github']
  }}
>
```

Without both configurations, social login buttons won't appear.
