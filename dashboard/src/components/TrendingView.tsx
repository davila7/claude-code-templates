import { useState, useEffect, useMemo } from 'react';
import { TYPE_CONFIG } from '../lib/icons';

interface TrendingItem {
  id: string;
  name: string;
  category: string;
  downloadsToday: number;
  downloadsWeek: number;
  downloadsMonth: number;
  downloadsTotal: number;
}

interface GlobalStats {
  totalComponents: number;
  totalDownloads: number;
  monthlyDownloads: number;
  weeklyDownloads: number;
  todayDownloads: number;
  totalCountries: number;
}

interface TopCountry {
  code: string;
  name: string;
  flag: string;
  downloads: number;
  percentage: number;
}

interface TrendingData {
  lastUpdated: string;
  globalStats: GlobalStats;
  topCountries: TopCountry[];
  trending: Record<string, TrendingItem[]>;
}

import TypeIcon from './TypeIcon';

function formatName(name: string): string {
  return name.replace(/[-_]/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

const TRENDING_TYPES = ['all', 'skills', 'agents', 'commands', 'settings', 'hooks', 'mcps'] as const;

export default function TrendingView() {
  const [data, setData] = useState<TrendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string>('all');
  const [period, setPeriod] = useState<'downloadsWeek' | 'downloadsMonth' | 'downloadsTotal'>('downloadsWeek');

  useEffect(() => {
    fetch('/trending-data.json')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const items = useMemo(() => {
    if (!data) return [];
    const list = data.trending[activeType] ?? [];
    return [...list].sort((a, b) => (b[period] ?? 0) - (a[period] ?? 0));
  }, [data, activeType, period]);

  if (loading) {
    return (
      <div className="px-6 py-20 flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#666] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-[#666]">Loading trending data...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-[13px] text-red-400">Failed to load trending data</p>
      </div>
    );
  }

  const stats = data.globalStats;

  return (
    <div>
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 px-6 py-5">
        {[
          { label: 'Total Downloads', value: formatNumber(stats.totalDownloads) },
          { label: 'This Month', value: formatNumber(stats.monthlyDownloads) },
          { label: 'This Week', value: formatNumber(stats.weeklyDownloads) },
          { label: 'Today', value: formatNumber(stats.todayDownloads) },
          { label: 'Components', value: formatNumber(stats.totalComponents) },
          { label: 'Countries', value: String(stats.totalCountries) },
        ].map((s) => (
          <div key={s.label} className="bg-[#111] border border-[#1f1f1f] rounded-lg px-4 py-3">
            <div className="text-[18px] font-semibold text-[#ededed] tabular-nums">{s.value}</div>
            <div className="text-[11px] text-[#666] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Top countries */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-4 overflow-x-auto">
          <span className="text-[11px] text-[#666] uppercase tracking-wider shrink-0">Top Countries</span>
          {data.topCountries.map((c) => (
            <div key={c.code} className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm">{c.flag}</span>
              <span className="text-[12px] text-[#a1a1a1]">{c.name}</span>
              <span className="text-[11px] text-[#555] tabular-nums">{c.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#1f1f1f]" />

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3">
        {/* Type filter */}
        <div className="flex items-center gap-1">
          {TRENDING_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-2.5 py-1 rounded-md text-[12px] transition-colors ${
                activeType === type
                  ? 'bg-white/10 text-white'
                  : 'text-[#666] hover:text-[#a1a1a1] hover:bg-white/[0.04]'
              }`}
            >
              {type === 'all' ? 'All' : TYPE_CONFIG[type]?.label ?? type}
            </button>
          ))}
        </div>

        {/* Period selector */}
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="ml-auto bg-white/[0.04] border-none rounded-lg text-[12px] text-[#a1a1a1] px-2.5 py-1.5 outline-none cursor-pointer"
        >
          <option value="downloadsWeek">This Week</option>
          <option value="downloadsMonth">This Month</option>
          <option value="downloadsTotal">All Time</option>
        </select>
      </div>

      {/* Results count */}
      <div className="px-6 pb-2">
        <span className="text-[11px] text-[#666]">
          {items.length} trending component{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Trending list */}
      <div className="px-6 pb-8">
        <div className="bg-[#111] border border-[#1f1f1f] rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[40px_1fr_100px_100px_100px_100px] gap-2 px-4 py-2 border-b border-[#1f1f1f] text-[11px] text-[#555] uppercase tracking-wider">
            <span>#</span>
            <span>Component</span>
            <span className="text-right">Today</span>
            <span className="text-right">Week</span>
            <span className="text-right">Month</span>
            <span className="text-right">Total</span>
          </div>

          {items.map((item, idx) => {
            // Extract type from id (e.g. "command-generate-tests" -> "commands")
            const typeKey = item.id.split('-')[0];
            const typePlural = typeKey === 'mcp' ? 'mcps' : typeKey + 's';
            const config = TYPE_CONFIG[typePlural];

            return (
              <div
                key={item.id}
                className="grid grid-cols-[40px_1fr_100px_100px_100px_100px] gap-2 px-4 py-2.5 border-b border-[#1a1a1a] last:border-b-0 hover:bg-white/[0.02] transition-colors group"
              >
                {/* Rank */}
                <span className="text-[12px] text-[#555] tabular-nums">{idx + 1}</span>

                {/* Component info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5"
                    style={{ backgroundColor: `${config?.color ?? '#666'}15`, color: config?.color ?? '#666' }}
                  >
                    <TypeIcon type={typePlural} size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[13px] text-[#ededed] truncate block">{formatName(item.name)}</span>
                    <span className="text-[10px] text-[#555]">{item.category}</span>
                  </div>
                </div>

                {/* Stats */}
                <span className={`text-[12px] text-right tabular-nums self-center ${item.downloadsToday > 0 ? 'text-emerald-400' : 'text-[#555]'}`}>
                  {item.downloadsToday > 0 ? `+${item.downloadsToday}` : '0'}
                </span>
                <span className="text-[12px] text-right tabular-nums self-center text-[#a1a1a1]">
                  {item.downloadsWeek.toLocaleString()}
                </span>
                <span className="text-[12px] text-right tabular-nums self-center text-[#a1a1a1]">
                  {item.downloadsMonth.toLocaleString()}
                </span>
                <span className="text-[12px] text-right tabular-nums self-center text-[#ededed]">
                  {item.downloadsTotal.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Last updated */}
      <div className="px-6 pb-6 text-center">
        <span className="text-[11px] text-[#555]">
          Last updated: {new Date(data.lastUpdated.replace(/\+00:00Z$/, 'Z')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
