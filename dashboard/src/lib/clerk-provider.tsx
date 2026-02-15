import { ClerkProvider } from '@clerk/clerk-react';
import type { ReactNode } from 'react';

const clerkKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Reusable ClerkProvider wrapper. If no key is configured, renders fallback or nothing.
 */
export default function ClerkProviderWrapper({ children, fallback }: Props) {
  if (!clerkKey) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <ClerkProvider publishableKey={clerkKey}>
      {children}
    </ClerkProvider>
  );
}
