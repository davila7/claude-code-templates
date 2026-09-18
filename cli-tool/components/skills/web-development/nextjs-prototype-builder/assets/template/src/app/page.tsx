'use client'

import Header from '@/components/Header'
import KPICard from '@/components/KPICard'

export default function Dashboard() {
  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-6">
        {/* KPI Row — customize with your domain metrics */}
        <div id="tour-kpis" className="grid grid-cols-4 gap-4 mb-6 stagger">
          <KPICard label="Total Items" value="42" trend="↑ 12%" trendDir="up" sub="vs last month" accent="cyan" />
          <KPICard label="Pending" value="8" trend="↓ 3%" trendDir="down" sub="target: < 10" accent="violet" />
          <KPICard label="Active" value="27" trend="↑ 5" trendDir="up" sub="across all categories" accent="amber" />
          <KPICard label="Completed" value="156" accent="emerald" sub="this quarter" />
        </div>

        {/* Add your dashboard content below */}
        <div className="grid grid-cols-[2fr_1fr] gap-4 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          {/* Main content area */}
          <div className="glass rounded-xl">
            <div className="px-4 py-3.5 border-b border-white/[0.06] text-[0.8rem] font-semibold">
              Recent Activity
            </div>
            <div className="p-4 text-[0.82rem] text-slate-500">
              Add your activity feed or data table here.
            </div>
          </div>

          {/* Side panels */}
          <div className="space-y-4">
            <div className="glass rounded-xl">
              <div className="px-4 py-3.5 border-b border-white/[0.06] text-[0.8rem] font-semibold">
                Status Overview
              </div>
              <div className="p-4 text-[0.82rem] text-slate-500">
                Add status bars or summary stats here.
              </div>
            </div>
            <div className="glass rounded-xl">
              <div className="px-4 py-3.5 border-b border-white/[0.06] text-[0.8rem] font-semibold">
                Quick Stats
              </div>
              <div className="p-4 text-[0.82rem] text-slate-500">
                Add snapshot metrics here.
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
