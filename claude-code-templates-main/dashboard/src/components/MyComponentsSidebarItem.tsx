import { useState, useEffect } from 'react';

function useGlobalAuth() {
  const [state, setState] = useState({ isSignedIn: false, isLoaded: false });

  useEffect(() => {
    function check() {
      const clerk = (window as any).Clerk;
      if (clerk?.loaded) {
        setState({ isSignedIn: !!clerk.user, isLoaded: true });
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

export function NavContent({ isActive }: { isActive: boolean }) {
  const { isSignedIn, isLoaded } = useGlobalAuth();

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-md">
        <div className="w-4 h-4 rounded bg-[--color-surface-3] animate-pulse" />
        <div className="w-20 h-3 rounded bg-[--color-surface-3] animate-pulse" />
      </div>
    );
  }

  const icon = (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
    </svg>
  );

  if (isSignedIn) {
    return (
      <a
        href="/my-components"
        className={`flex items-center gap-2.5 px-2.5 py-[6px] rounded-md text-[13px] transition-colors group ${
          isActive
            ? 'bg-[--color-surface-3] text-[--color-text-primary] font-medium'
            : 'text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-2]'
        }`}
      >
        <span className={isActive ? 'text-[--color-text-primary]' : 'text-[--color-text-tertiary] group-hover:text-[--color-text-secondary]'}>
          {icon}
        </span>
        <span className="truncate">My Components</span>
      </a>
    );
  }

  return (
    <button
      onClick={() => (window as any).Clerk?.openSignIn?.()}
      className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-md text-[13px] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-2] transition-colors group w-full text-left"
    >
      <span className="text-[--color-text-tertiary] group-hover:text-[--color-text-secondary]">
        {icon}
      </span>
      <span className="truncate">My Components</span>
    </button>
  );
}

export default function MyComponentsSidebarItem({ isActive = false }: { isActive?: boolean }) {
  return <NavContent isActive={isActive} />;
}
