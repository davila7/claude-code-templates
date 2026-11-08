import { useEffect } from 'react';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { takeSignInOrigin, track } from '../lib/analytics';

const clerkKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;

// Sends sign_in_complete once a sign-in opened with openSignIn(origin) ends,
// in this page or after the OAuth redirect back to it (the origin waits in
// sessionStorage, see lib/analytics.ts).
function SignInCompleteTracker() {
  const { isLoaded, isSignedIn } = useAuth();
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const origin = takeSignInOrigin();
    if (origin) track('sign_in_complete', { origin });
  }, [isLoaded, isSignedIn]);
  return null;
}

export default function ClerkIsland() {
  if (!clerkKey) return null;
  return (
    <ClerkProvider publishableKey={clerkKey}>
      <span />
      <SignInCompleteTracker />
    </ClerkProvider>
  );
}
