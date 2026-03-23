import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import ThemeToggle from './ThemeToggle';

export default function ThemeProvider() {
  useEffect(() => {
    // Initialize theme on mount
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('light', initialTheme === 'light');
  }, []);

  const mountPoint = typeof document !== 'undefined' ? document.getElementById('theme-toggle-mount') : null;

  return mountPoint ? createPortal(<ThemeToggle />, mountPoint) : null;
}
