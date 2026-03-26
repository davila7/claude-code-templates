import { useState, useEffect, useRef } from 'react';

interface ClerkUser {
  fullName?: string | null;
  firstName?: string | null;
  imageUrl?: string;
}

// Mock user data for local testing
const MOCK_USER: ClerkUser = {
  fullName: 'Bitreon',
  firstName:'Bitreon',
  imageUrl: 'https://avatars.githubusercontent.com/u/207326426?v=4'
};

// Enable mock mode via console: window.enableAuthMock()
// Disable mock mode via console: window.disableAuthMock()
declare global {
  interface Window {
    enableAuthMock: () => void;
    disableAuthMock: () => void;
    __authMockEnabled?: boolean;
  }
}

function useGlobalAuth() {
  const [state, setState] = useState<{ isSignedIn: boolean; isLoaded: boolean; user: ClerkUser | null }>({
    isSignedIn: false, isLoaded: false, user: null,
  });
  const [mockEnabled, setMockEnabled] = useState(false);

  useEffect(() => {
    // Setup console commands for mock mode
    window.enableAuthMock = () => {
      window.__authMockEnabled = true;
      setMockEnabled(true);
      console.log('✅ Auth mock mode enabled! Showing mock user:', MOCK_USER.fullName);
    };
    
    window.disableAuthMock = () => {
      window.__authMockEnabled = false;
      setMockEnabled(false);
      console.log('❌ Auth mock mode disabled');
    };

    // Check if mock was previously enabled
    if (window.__authMockEnabled) {
      setMockEnabled(true);
    }

    function check() {
      // If mock is enabled and not on Vercel, use mock data
      const isVercel = window.location.hostname.includes('vercel.app') || 
                       window.location.hostname.includes('claude.ai');
      
      if (window.__authMockEnabled && !isVercel) {
        setState({
          isSignedIn: true,
          isLoaded: true,
          user: MOCK_USER,
        });
        return;
      }

      const clerk = (window as any).Clerk;
      if (clerk?.loaded) {
        setState({
          isSignedIn: !!clerk.user,
          isLoaded: true,
          user: clerk.user ? {
            fullName: clerk.user.fullName,
            firstName: clerk.user.firstName,
            imageUrl: clerk.user.imageUrl,
          } : null,
        });
      }
    }
    check();
    const interval = setInterval(check, 500);
    const handleChange = () => check();
    window.addEventListener('clerk:session', handleChange);
    return () => { clearInterval(interval); window.removeEventListener('clerk:session', handleChange); };
  }, [mockEnabled]);

  return state;
}

function UserMenu({ user }: { user: ClerkUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const displayName = user.fullName || user.firstName || 'User';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-md text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors w-full"
      >
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={displayName}
            className="w-6 h-6 rounded-full shrink-0 ring-2 ring-orange-500"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0 text-[11px] font-bold text-white ring-2 ring-orange-500">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="truncate flex-1 text-left">{displayName}</span>
      </button>

      {open && (
        <div className="fixed bottom-4 left-4 w-56 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg shadow-xl z-[9999] py-1">
          {/* User Info Header */}
          <div className="px-3 py-2 border-b border-[var(--color-border)]">
            <div className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-[var(--color-text-secondary)] truncate">
              {window.__authMockEnabled ? 'Bitreon@example.com' : 'user@example.com'}
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                console.log('Navigate to My Collections');
                window.location.href = '/collections';
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              My Collections
            </button>

            <button
              onClick={() => {
                console.log('Navigate to My Components');
                window.location.href = '/my-components';
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              My Components
            </button>

            <button
              onClick={() => {
                console.log('Navigate to Settings');
                window.location.href = '/settings';
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--color-border)] my-1"></div>

          {/* Sign Out */}
          <div className="py-1">
            <button
              onClick={() => {
                const isVercel = window.location.hostname.includes('vercel.app') || 
                                 window.location.hostname.includes('claude.ai');
                
                if (window.__authMockEnabled && !isVercel) {
                  console.log('🔓 Mock sign out - disabling mock mode');
                  window.disableAuthMock?.();
                } else {
                  (window as any).Clerk?.signOut?.();
                }
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthButton() {
  const { isSignedIn, isLoaded, user } = useGlobalAuth();

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2.5 px-2.5 py-[6px]">
        <div className="w-6 h-6 rounded-full bg-[var(--color-surface-3)] animate-pulse" />
        <div className="h-3 w-16 bg-[var(--color-surface-3)] rounded animate-pulse" />
      </div>
    );
  }

  if (isSignedIn && user) {
    return <UserMenu user={user} />;
  }

  return (
    <button
      onClick={() => (window as any).Clerk?.openSignIn?.()}
      className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-md text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors w-full"
    >
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <span>Sign In</span>
    </button>
  );
}
