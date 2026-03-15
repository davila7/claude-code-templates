export default function KPICard({
  label, value, trend, trendDir, sub, children, accent,
}: {
  label: string
  value: string | React.ReactNode
  trend?: string
  trendDir?: 'up' | 'down'
  sub?: string
  children?: React.ReactNode
  accent?: 'cyan' | 'emerald' | 'violet' | 'amber'
}) {
  const accentGlow = {
    cyan: 'glow-cyan',
    emerald: 'glow-emerald',
    violet: 'glow-violet',
    amber: 'glow-amber',
  }
  const accentBorder = {
    cyan: 'border-t-cyan-400/30',
    emerald: 'border-t-emerald-400/30',
    violet: 'border-t-violet-400/30',
    amber: 'border-t-amber-400/30',
  }

  return (
    <div className={`glass glass-hover rounded-xl p-5 card-shine transition-all duration-300 hover:-translate-y-0.5 border-t-2 ${accent ? accentBorder[accent] : 'border-t-transparent'} ${accent ? accentGlow[accent] : ''}`}>
      <div className="text-[0.68rem] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-2.5">{label}</div>
      <div className="flex items-end justify-between">
        <div className="text-[1.85rem] font-bold font-mono leading-none animate-count kpi-glow">{value}</div>
        {trend && (
          <span className={`text-[0.68rem] font-semibold px-2 py-0.5 rounded-md ${
            trendDir === 'up' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
          }`}>
            {trend}
          </span>
        )}
        {children}
      </div>
      {sub && <div className="text-[0.68rem] text-slate-600 mt-2">{sub}</div>}
    </div>
  )
}
