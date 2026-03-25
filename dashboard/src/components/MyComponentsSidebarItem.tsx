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
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
        <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
          <div className="w-[18px] h-[18px] rounded bg-[var(--color-surface-3)] animate-pulse" />
        </div>
        <div className="sidebar-text w-24 h-3.5 rounded bg-[var(--color-surface-3)] animate-pulse" />
      </div>
    );
  }

  const icon = (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
    </svg>
  );

  if (isSignedIn) {
    return (
      <a
        href="/my-components"
        data-tooltip="My Components"
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 group ${
          isActive
            ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] font-medium shadow-sm'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:shadow-sm'
        }`}
      >
        <span className={`w-[18px] h-[18px] shrink-0 flex items-center justify-center transition-all duration-150 ${isActive ? 'text-[var(--color-text-primary)] scale-105' : 'text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)] group-hover:scale-105'}`}>
          {icon}
        </span>
        <span className="sidebar-text truncate transition-all duration-300">My Components</span>
      </a>
    );
  }

  return (
    <button
      onClick={() => (window as any).Clerk?.openSignIn?.()}
      data-tooltip="My Components"
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:shadow-sm transition-all duration-150 group w-full text-left"
    >
      <span className="w-[18px] h-[18px] shrink-0 flex items-center justify-center text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)] transition-all duration-150 group-hover:scale-105">
        {icon}
      </span>
      <span className="sidebar-text truncate transition-all duration-300">My Components</span>
    </button>
  );
}

export default function MyComponentsSidebarItem({ isActive = false }: { isActive?: boolean }) {
  return <NavContent isActive={isActive} />;
}
