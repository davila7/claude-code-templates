import { useEffect } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { startPendingActionResume } from '../lib/resume-pending-action';

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

export default function ClerkIsland() {
  useEffect(() => {
    if (clerkKey) startPendingActionResume();
  }, []);

  if (!clerkKey) return null;
  return (
    <ClerkProvider publishableKey={clerkKey} localization={localization}>
      <span />
    </ClerkProvider>
  );
}
