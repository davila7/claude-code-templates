import { Clerk } from '@clerk/clerk-js';

// Get the Clerk publishable key from environment variables
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  console.error('Missing Clerk Publishable Key. Please add VITE_CLERK_PUBLISHABLE_KEY to your .env file.');
}

// Initialize Clerk
const clerk = new Clerk(clerkPubKey);

// Load Clerk and handle authentication state
export async function initializeClerk() {
  try {
    await clerk.load({
      // Set load options here if needed
    });

    // Update UI based on authentication state
    updateAuthUI();

    // Listen for authentication state changes
    clerk.addListener((session) => {
      updateAuthUI();
    });

    return clerk;
  } catch (error) {
    console.error('Error initializing Clerk:', error);
    throw error;
  }
}

// Update the authentication UI based on signed-in state
function updateAuthUI() {
  const isSignedIn = clerk.user !== null;

  // Get auth container elements
  const signedInElements = document.querySelectorAll('[data-clerk-signed-in]');
  const signedOutElements = document.querySelectorAll('[data-clerk-signed-out]');

  // Show/hide based on auth state
  signedInElements.forEach(el => {
    el.style.display = isSignedIn ? '' : 'none';
  });

  signedOutElements.forEach(el => {
    el.style.display = isSignedIn ? 'none' : '';
  });

  // Mount UserButton if signed in
  if (isSignedIn) {
    const userButtonDiv = document.getElementById('clerk-user-button');
    if (userButtonDiv && !userButtonDiv.hasChildNodes()) {
      clerk.mountUserButton(userButtonDiv);
    }
  }
}

// Mount Sign In component
export function mountSignIn(elementId) {
  const signInDiv = document.getElementById(elementId);
  if (signInDiv) {
    clerk.mountSignIn(signInDiv);
  }
}

// Mount Sign Up component
export function mountSignUp(elementId) {
  const signUpDiv = document.getElementById(elementId);
  if (signUpDiv) {
    clerk.mountSignUp(signUpDiv);
  }
}

// Mount User Button component
export function mountUserButton(elementId) {
  const userButtonDiv = document.getElementById(elementId);
  if (userButtonDiv) {
    clerk.mountUserButton(userButtonDiv);
  }
}

// Mount User Profile component
export function mountUserProfile(elementId) {
  const userProfileDiv = document.getElementById(elementId);
  if (userProfileDiv) {
    clerk.mountUserProfile(userProfileDiv);
  }
}

// Open Sign In modal
export function openSignIn() {
  clerk.openSignIn({
    appearance: {
      elements: {
        rootBox: 'clerk-modal',
        card: 'clerk-card'
      }
    }
  });
}

// Open Sign Up modal
export function openSignUp() {
  clerk.openSignUp({
    appearance: {
      elements: {
        rootBox: 'clerk-modal',
        card: 'clerk-card'
      }
    }
  });
}

// Open User Profile modal
export function openUserProfile() {
  clerk.openUserProfile({
    appearance: {
      elements: {
        rootBox: 'clerk-modal',
        card: 'clerk-card'
      }
    }
  });
}

// Get current user info
export function getCurrentUser() {
  return clerk.user;
}

// Sign out current user
export async function signOut() {
  try {
    await clerk.signOut();
    updateAuthUI();
  } catch (error) {
    console.error('Error signing out:', error);
  }
}

// Export clerk instance for use in other modules
export { clerk };
