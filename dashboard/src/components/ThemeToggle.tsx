import { useState, useEffect } from 'react';
import { toggleTheme, getTheme } from '../lib/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(getTheme());
  }, []);

  const handleToggle = () => {
    const newTheme = toggleTheme();
    setTheme(newTheme);
  };

  if (!mounted) return null;

  return (
    <button
      onClick={handleToggle}
      className="relative group p-2 rounded-lg transition-all duration-200 hover:bg-[var(--color-surface-2)] active:scale-95 flex items-center justify-center"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <div className="relative w-5 h-5">
        {/* Sun icon for light mode */}
        <svg
          className={`absolute inset-0 w-5 h-5 transition-all duration-300 ease-out ${
            theme === 'light' 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 rotate-90 scale-75'
          }`}
          style={{ color: 'var(--color-text-primary)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
        </svg>
        
        {/* Moon icon for dark mode */}
        <svg
          className={`absolute inset-0 w-5 h-5 transition-all duration-300 ease-out ${
            theme === 'dark' 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 -rotate-90 scale-75'
          }`}
          style={{ color: 'var(--color-text-primary)' }}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M21.64 13a1 1 0 00-1.05-.14 8.05 8.05 0 01-3.37.73 8.15 8.15 0 01-8.14-8.1 8.59 8.59 0 01.25-2A1 1 0 008 2.36a10.14 10.14 0 1014 11.69 1 1 0 00-.36-1.05z" />
        </svg>
      </div>
    </button>
  );
}
