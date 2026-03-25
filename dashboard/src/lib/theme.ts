// Theme management utility
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'claude-theme';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_KEY);
  return (stored as Theme) || 'dark';
}

export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  
  // Remove both classes first
  html.classList.remove('light', 'dark');
  // Add the correct class
  html.classList.add(theme);
}

// Initialize theme on page load
export function initTheme(): void {
  if (typeof window === 'undefined') return;
  const theme = getTheme();
  applyTheme(theme);
}
