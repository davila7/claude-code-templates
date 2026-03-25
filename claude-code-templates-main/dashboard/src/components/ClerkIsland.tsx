import { ClerkProvider } from '@clerk/clerk-react';

const clerkKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function ClerkIsland() {
  if (!clerkKey) return null;
  return (
    <ClerkProvider publishableKey={clerkKey}>
      <span />
    </ClerkProvider>
  );
}
