# Neon Auth - Auth Methods Reference

Complete reference for authentication methods, session management, and error handling.

## Auth Methods

### Sign Up

```typescript
await auth.signUp.email({
  email: "user@example.com",
  password: "securepassword",
  name: "John Doe", // Optional
});
```

### Sign In

```typescript
// Email/password
await auth.signIn.email({
  email: "user@example.com",
  password: "securepassword",
});

// Social (Google, GitHub)
await auth.signIn.social({
  provider: "google", // or "github"
  callbackURL: "/dashboard",
});
```

### Sign Out

```typescript
await auth.signOut();
```

### Get Session

```typescript
// Async (Node.js, server components)
const session = await auth.getSession();

// React hook (client components)
const session = auth.useSession();
// Returns: { data: Session | null, isPending: boolean }
```

## Session Data Structure

```typescript
interface Session {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
  };
}
```

## Error Handling

```typescript
const { error } = await auth.signIn.email({ email, password });

if (error) {
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      showError("Invalid email or password");
      break;
    case "EMAIL_NOT_VERIFIED":
      showError("Please verify your email");
      break;
    case "USER_NOT_FOUND":
      showError("User not found");
      break;
    case "TOO_MANY_REQUESTS":
      showError("Too many attempts. Please wait.");
      break;
    default:
      showError("Authentication failed");
  }
}
```

## Building Auth Pages

### Use AuthView (Recommended for React Apps)

For authentication pages, use the pre-built `AuthView` component instead of building custom forms.

**What AuthView provides:**

- Sign-in, sign-up, password reset, magic link pages
- Social providers (Google, GitHub) - requires TWO configurations: enable in Neon Console AND add `social` prop to NeonAuthUIProvider
- Form validation, error handling, loading states
- Consistent styling via CSS variables

**Setup (Next.js App Router):**

1. **Import CSS** (in `app/layout.tsx` or `app/globals.css`):

```tsx
import "@neondatabase/auth/ui/css";
```

2. **Wrap app with provider** (create `app/auth-provider.tsx`):

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
    >
      {children}
    </NeonAuthUIProvider>
  );
}
```

3. **Create auth page** (`app/auth/[path]/page.tsx`):

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

**Result:** You now have `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, etc.

**Available paths:** `"sign-in"`, `"sign-up"`, `"forgot-password"`, `"reset-password"`, `"magic-link"`, `"two-factor"`, `"callback"`, `"sign-out"`

### When to Use Low-Level Methods Instead

Use `authClient.signIn.email()`, `authClient.signUp.email()` directly if:

- **Node.js backend** - No React, server-side auth only
- **Custom design system** - Your design team provides form components
- **Mobile/CLI apps** - Non-web frontends
- **Headless auth** - Testing or non-standard flows

For standard React web apps, **use AuthView**.

### Common Anti-Pattern

```tsx
// ❌ Don't build custom forms unless you have specific requirements
function CustomSignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  // ... 50+ more lines of form JSX, validation, error display
}

// ✅ Use AuthView instead - one component handles everything
<AuthView pathname="sign-in" />;
```

## Styling

Neon Auth UI **automatically inherits your app's existing theme**. If you have CSS variables like `--primary`, `--background`, etc. defined (from Tailwind, shadcn/ui, or custom CSS), auth components use them with no configuration.

**Key features:**

- **Automatic inheritance**: Uses your existing `--primary`, `--background`, etc.
- **No conflicts**: Auth styles are in `@layer neon-auth`, so your styles always win
- **Import order doesn't matter**: CSS layers handle priority automatically

### Integration with shadcn/ui

If you use shadcn/ui or similar libraries that define `--primary`, `--background`, etc., Neon Auth will automatically inherit those colors. No additional configuration needed.

### Use Existing CSS Variables

When creating custom components, use CSS variables for consistency:

| Variable                            | Purpose                 |
| ----------------------------------- | ----------------------- |
| `--background`, `--foreground`      | Page background/text    |
| `--card`, `--card-foreground`       | Card surfaces           |
| `--primary`, `--primary-foreground` | Primary buttons/actions |
| `--muted`, `--muted-foreground`     | Muted/subtle elements   |
| `--border`, `--ring`                | Borders and focus rings |
| `--radius`                          | Border radius           |

### Auth-Specific Customization

To customize auth components differently from your main app, use `--neon-*` prefix:

```css
:root {
  --primary: oklch(0.55 0.25 250); /* Your app's blue */
  --neon-primary: oklch(0.55 0.18 145); /* Auth uses green */
}
```
