import { useEffect } from 'react';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { startPendingActionResume } from '../lib/resume-pending-action';
import { takeSignInOrigin, track } from '../lib/analytics';

const clerkKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;

// Clerk's default copy is "Sign in to {app name} / Welcome back! Please sign
// in to continue.", written for returning users of app.aitmpl.com. Most people
// who see the modal are new and arrive on www, so it says what an account is
// for. The same buttons sign in an existing account or create a new one.
const localization = {
  signIn: {
    start: {
      title: 'Sign in to aitmpl.com',
      titleCombined: 'Sign in to aitmpl.com',
      subtitle: 'Create your free account to save your stacks and see jobs and courses. Already have one? Same buttons.',
      subtitleCombined: 'Create your free account to save your stacks and see jobs and courses. Already have one? Same buttons.',
    },
  },
  signUp: {
    start: {
      title: 'Create your free aitmpl.com account',
      titleCombined: 'Create your free aitmpl.com account',
      subtitle: 'Save your stacks in My components and see jobs and courses.',
      subtitleCombined: 'Save your stacks in My components and see jobs and courses.',
    },
  },
};

// Sends sign_in_complete once a sign-in opened with openSignIn() ends, in this
// page or after the OAuth redirect back to it (the origin waits in
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
  useEffect(() => {
    if (clerkKey) startPendingActionResume();
  }, []);

  if (!clerkKey) return null;
  return (
    <ClerkProvider publishableKey={clerkKey} localization={localization}>
      <span />
      <SignInCompleteTracker />
    </ClerkProvider>
  );
}
