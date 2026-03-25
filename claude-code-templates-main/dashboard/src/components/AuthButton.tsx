import { useState, useEffect, useRef } from 'react';

interface ClerkUser {
  fullName?: string | null;
  firstName?: string | null;
  imageUrl?: string;
}

function useGlobalAuth() {
  const [state, setState] = useState<{ isSignedIn: boolean; isLoaded: boolean; user: ClerkUser | null }>({
    isSignedIn: false, isLoaded: false, user: null,
  });

  useEffect(() => {
    function check() {
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
  }, []);

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
        className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-md text-[13px] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-2] transition-colors w-full"
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
        <div className="absolute bottom-full left-0 mb-1 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1">
          <button
            onClick={() => {
              (window as any).Clerk?.signOut?.();
              setOpen(false);
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
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
        <div className="w-6 h-6 rounded-full bg-[--color-surface-3] animate-pulse" />
        <div className="h-3 w-16 bg-[--color-surface-3] rounded animate-pulse" />
      </div>
    );
  }

  if (isSignedIn && user) {
    return <UserMenu user={user} />;
  }

  return (
    <button
      onClick={() => (window as any).Clerk?.openSignIn?.()}
      className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-md text-[13px] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-2] transition-colors w-full"
    >
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <span>Sign In</span>
    </button>
  );
}
