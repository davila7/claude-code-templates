import { statusConfig, badgeStyles, dotStyles, cn } from '@/lib/utils'

export function Badge({ status, config }: { status: string; config?: Record<string, { label: string; color: string }> }) {
  const cfg = (config || statusConfig)[status] || { label: status, color: 'muted' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[0.68rem] font-semibold tracking-wide gap-1 whitespace-nowrap', badgeStyles[cfg.color] || badgeStyles.muted)}>
      {cfg.label}
    </span>
  )
}

export function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className={cn('w-1.5 h-1.5 rounded-full inline-block flex-shrink-0', dotStyles[color] || dotStyles.muted, pulse && 'animate-pulse-dot')} />
  )
}

export function PriorityDot({ priority }: { priority: string }) {
  const colorMap: Record<string, string> = { critical: 'error', high: 'error', medium: 'warning', low: 'muted' }
  return <Dot color={colorMap[priority] || 'muted'} />
}
