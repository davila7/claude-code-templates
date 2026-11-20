export function formatCurrency(n: number): string {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'
  return '$' + n
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Status → display label + badge color key
// Customize these maps for your domain
export const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'success' },
  pending: { label: 'Pending', color: 'warning' },
  completed: { label: 'Completed', color: 'info' },
  archived: { label: 'Archived', color: 'muted' },
}

// Badge pill styles keyed by color name
export const badgeStyles: Record<string, string> = {
  info: 'bg-blue-400/10 text-blue-400',
  success: 'bg-emerald-400/10 text-emerald-400',
  warning: 'bg-amber-400/10 text-amber-400',
  error: 'bg-red-400/10 text-red-400',
  primary: 'bg-cyan-400/10 text-cyan-400',
  purple: 'bg-violet-400/10 text-violet-400',
  orange: 'bg-orange-400/10 text-orange-400',
  muted: 'bg-white/[0.04] text-slate-500',
}

// Status dot color styles
export const dotStyles: Record<string, string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
  info: 'bg-blue-400',
  primary: 'bg-cyan-400',
  muted: 'bg-slate-500',
}

// Priority → dot color mapping
export const priorityColor: Record<string, string> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'muted',
}
