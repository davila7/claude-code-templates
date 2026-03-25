import { useState, useEffect, useMemo } from 'react';
import { TYPE_CONFIG } from '../lib/icons';
import TypeIcon from './TypeIcon';
import CountryFlag from './CountryFlag';

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

function formatName(name: string): string {
  return name.replace(/[-_]/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
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
        <div className="w-5 h-5 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-[var(--color-text-tertiary)]">Loading trending data...</span>
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
    <div className="pb-8">
      {/* Hero Section with Gradient */}
      <div className="relative px-6 pt-6 pb-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/70 flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-[20px] font-semibold text-[var(--color-text-primary)]">Trending Components</h1>
              <p className="text-[12px] text-[var(--color-text-tertiary)] mt-0.5">Most popular downloads this week</p>
            </div>
          </div>

          {/* Stats cards with enhanced design */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { 
                label: 'Total Downloads', 
                value: formatNumber(stats.totalDownloads),
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                ),
                colorClass: 'stat-blue'
              },
              { 
                label: 'This Month', 
                value: formatNumber(stats.monthlyDownloads),
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
                colorClass: 'stat-purple'
              },
              { 
                label: 'This Week', 
                value: formatNumber(stats.weeklyDownloads),
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                ),
                colorClass: 'stat-emerald'
              },
              { 
                label: 'Today', 
                value: formatNumber(stats.todayDownloads),
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                colorClass: 'stat-orange'
              },
              { 
                label: 'Components', 
                value: formatNumber(stats.totalComponents),
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                ),
                colorClass: 'stat-pink'
              },
              { 
                label: 'Countries', 
                value: String(stats.totalCountries),
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                colorClass: 'stat-cyan'
              },
            ].map((s) => (
              <div 
                key={s.label} 
                className="group relative bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-4 py-3.5 hover:border-[var(--color-accent)]/30 transition-all duration-200 hover:shadow-lg hover:shadow-[var(--color-accent)]/5 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`stat-icon ${s.colorClass}`}>
                    {s.icon}
                  </div>
                </div>
                <div className="text-[22px] font-bold text-[var(--color-text-primary)] tabular-nums leading-none mb-1.5">{s.value}</div>
                <div className="text-[11px] text-[var(--color-text-tertiary)] font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top countries with icons */}
      <div className="px-6 pb-6">
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[12px] text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Top Countries</span>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {data.topCountries.map((c, idx) => (
              <div 
                key={c.code} 
                className="flex items-center gap-2.5 shrink-0 bg-[var(--color-surface-2)] rounded-lg px-3 py-2.5 border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent)]/10 text-[10px] font-bold text-[var(--color-accent)]">
                  {idx + 1}
                </div>
                <div className="w-7 h-7 rounded-md overflow-hidden shadow-sm border border-[var(--color-border)]">
                  <CountryFlag code={c.code} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] text-[var(--color-text-primary)] font-medium">{c.name}</span>
                  <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">{formatNumber(c.downloads)} downloads</span>
                </div>
                <span className="text-[11px] text-[var(--color-accent)] font-semibold tabular-nums ml-1">{c.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--color-border)] mx-6" />

      {/* Filter bar with enhanced design */}
      <div className="px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Type filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {TRENDING_TYPES.map((type) => {
              const config = TYPE_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                    activeType === type
                      ? 'bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent)]/20'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)]'
                  }`}
                >
                  {type !== 'all' && (
                    <div className={`w-4 h-4 flex items-center justify-center ${activeType === type ? 'text-white' : ''}`}>
                      <TypeIcon type={type} size={14} />
                    </div>
                  )}
                  {type === 'all' ? 'All' : TYPE_CONFIG[type]?.label ?? type}
                </button>
              );
            })}
          </div>

          {/* Period selector with icon */}
          <div className="flex items-center gap-2 ml-auto">
            <svg className="w-4 h-4 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[12px] text-[var(--color-text-primary)] font-medium px-3 py-1.5 outline-none cursor-pointer hover:border-[var(--color-accent)]/30 transition-colors"
            >
              <option value="downloadsWeek">This Week</option>
              <option value="downloadsMonth">This Month</option>
              <option value="downloadsTotal">All Time</option>
            </select>
          </div>
        </div>

        {/* Results count with icon */}
        <div className="flex items-center gap-2 mt-3">
          <svg className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">
            {items.length} trending component{items.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Trending list with enhanced design */}
      <div className="px-6 pb-8">
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[50px_1fr_110px_110px_110px_110px] gap-3 px-5 py-3 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)] font-semibold uppercase tracking-wider">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              Rank
            </div>
            <span className="text-[11px] text-[var(--color-text-tertiary)] font-semibold uppercase tracking-wider">Component</span>
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--color-text-tertiary)] font-semibold uppercase tracking-wider">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Today
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--color-text-tertiary)] font-semibold uppercase tracking-wider">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Week
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--color-text-tertiary)] font-semibold uppercase tracking-wider">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Month
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--color-text-tertiary)] font-semibold uppercase tracking-wider">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Total
            </div>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-[var(--color-border)]">
            {items.map((item, idx) => {
              // Extract type from id (e.g. "command-generate-tests" -> "commands")
              const typeKey = item.id.split('-')[0];
              const typePlural = typeKey === 'mcp' ? 'mcps' : typeKey + 's';
              const config = TYPE_CONFIG[typePlural];

              // Medal colors for top 3
              const getMedalClass = (rank: number) => {
                if (rank === 1) return 'medal-gold';
                if (rank === 2) return 'medal-silver';
                if (rank === 3) return 'medal-bronze';
                return 'medal-default';
              };

              return (
                <div
                  key={item.id}
                  className="grid md:grid-cols-[50px_1fr_110px_110px_110px_110px] gap-3 px-5 py-3.5 hover:bg-[var(--color-surface-2)] transition-all duration-150 group"
                >
                  {/* Rank with medal for top 3 */}
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold ${getMedalClass(idx + 1)}`}>
                      {idx + 1}
                    </div>
                  </div>

                  {/* Component info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-200"
                      style={{ backgroundColor: `${config?.color ?? 'var(--color-text-tertiary)'}15`, color: config?.color ?? 'var(--color-text-tertiary)' }}
                    >
                      <TypeIcon type={typePlural} size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[var(--color-text-primary)] font-medium truncate block group-hover:text-[var(--color-accent)] transition-colors">
                          {formatName(item.name)}
                        </span>
                        {item.downloadsToday > 0 && (
                          <span className="hot-badge">
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                            Hot
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] px-1.5 py-0.5 bg-[var(--color-surface-2)] rounded">{item.category}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats - Desktop */}
                  <div className="hidden md:flex items-center justify-end">
                    <span className={`text-[13px] font-semibold tabular-nums ${item.downloadsToday > 0 ? 'stat-today-active' : 'text-[var(--color-text-tertiary)]'}`}>
                      {item.downloadsToday > 0 ? `+${item.downloadsToday}` : '—'}
                    </span>
                  </div>
                  <div className="hidden md:flex items-center justify-end">
                    <span className="text-[13px] font-medium tabular-nums text-[var(--color-text-secondary)]">
                      {formatNumber(item.downloadsWeek)}
                    </span>
                  </div>
                  <div className="hidden md:flex items-center justify-end">
                    <span className="text-[13px] font-medium tabular-nums text-[var(--color-text-secondary)]">
                      {formatNumber(item.downloadsMonth)}
                    </span>
                  </div>
                  <div className="hidden md:flex items-center justify-end">
                    <span className="text-[13px] font-bold tabular-nums text-[var(--color-text-primary)]">
                      {formatNumber(item.downloadsTotal)}
                    </span>
                  </div>

                  {/* Stats - Mobile */}
                  <div className="md:hidden col-span-full grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-[var(--color-border)]">
                    <div className="text-center">
                      <div className="text-[10px] text-[var(--color-text-tertiary)] mb-0.5">Today</div>
                      <div className={`text-[12px] font-semibold tabular-nums ${item.downloadsToday > 0 ? 'stat-today-active' : 'text-[var(--color-text-tertiary)]'}`}>
                        {item.downloadsToday > 0 ? `+${item.downloadsToday}` : '—'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-[var(--color-text-tertiary)] mb-0.5">Week</div>
                      <div className="text-[12px] font-medium tabular-nums text-[var(--color-text-secondary)]">
                        {formatNumber(item.downloadsWeek)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-[var(--color-text-tertiary)] mb-0.5">Month</div>
                      <div className="text-[12px] font-medium tabular-nums text-[var(--color-text-secondary)]">
                        {formatNumber(item.downloadsMonth)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-[var(--color-text-tertiary)] mb-0.5">Total</div>
                      <div className="text-[12px] font-bold tabular-nums text-[var(--color-text-primary)]">
                        {formatNumber(item.downloadsTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Last updated with icon */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Last updated: {new Date(data.lastUpdated.replace(/\+00:00Z$/, 'Z')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}
