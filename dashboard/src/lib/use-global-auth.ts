import { useEffect, useState } from 'react';

// Reads sign-in state from the global Clerk instance (no ClerkProvider per island).
export function useGlobalAuth() {
  const [state, setState] = useState({ isSignedIn: false, isLoaded: false });
  useEffect(() => {
    function check() {
      const clerk = (window as any).Clerk;
      if (clerk?.loaded) {
        const signedIn = !!clerk.user;
        setState((prev) =>
          prev.isLoaded && prev.isSignedIn === signedIn ? prev : { isSignedIn: signedIn, isLoaded: true },
        );
      }
    }
    check();
    const interval = setInterval(check, 500);
    window.addEventListener('clerk:session', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('clerk:session', check);
    };
  }, []);
  return state;
}
