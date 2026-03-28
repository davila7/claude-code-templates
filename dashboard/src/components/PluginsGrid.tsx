import { useState, useMemo } from 'react';

interface Plugin {
  slug: string;
  name: string;
  author: string;
  description: string;
  github: string;
  website?: string;
  stars: number;
  type: string;
  tags: string[];
  contains: Record<string, number>;
  highlights: string[];
}

const TAG_COLORS: Record<string, string> = {
  skills: '#f59e0b',
  agents: '#3b82f6',
  commands: '#10b981',
  hooks: '#f97316',
  mcps: '#06b6d4',
  settings: '#8b5cf6',
  rules: '#ec4899',
};

function formatStars(stars: number): string {
  if (stars >= 1000) return `${(stars / 1000).toFixed(stars >= 10000 ? 0 : 1)}k`;
  return String(stars);
}

type SortMode = 'stars' | 'alpha';

export default function PluginsGrid({ plugins }: { plugins: Plugin[] }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('stars');

  const filtered = useMemo(() => {
    let result = plugins;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (sort === 'stars') {
      result = [...result].sort((a, b) => b.stars - a.stars);
    } else {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [plugins, search, sort]);

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: 'var(--color-text-tertiary)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search plugins by name, author, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-all duration-200"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-hover)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,217,61,0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
              style={{
                background: 'var(--color-surface-3)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort selector */}
        <div
          className="flex items-center rounded-xl overflow-hidden shrink-0"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
          }}
        >
          <button
            onClick={() => setSort('stars')}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold transition-all duration-200"
            style={{
              background: sort === 'stars' ? 'var(--color-surface-3)' : 'transparent',
              color: sort === 'stars' ? '#ffd93d' : 'var(--color-text-tertiary)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Stars
          </button>
          <div style={{ width: '1px', height: '20px', background: 'var(--color-border)' }} />
          <button
            onClick={() => setSort('alpha')}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold transition-all duration-200"
            style={{
              background: sort === 'alpha' ? 'var(--color-surface-3)' : 'transparent',
              color: sort === 'alpha' ? '#ffd93d' : 'var(--color-text-tertiary)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M3 6h7M3 12h10M3 18h5M16 6l3 3m0 0l3-3m-3 3V3m0 18l-3-3m3 3l3-3m-3 3V12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            A-Z
          </button>
        </div>
      </div>

      {/* Results count */}
      {search && (
        <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'} for "{search}"
        </p>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{
            background: 'var(--color-surface-1)',
            border: '1px dashed var(--color-border)',
          }}
        >
          <svg
            className="w-12 h-12 mb-3"
            style={{ color: 'var(--color-text-tertiary)', opacity: 0.4 }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
          <p className="text-[14px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            No plugins found
          </p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Try a different search term
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((plugin, idx) => (
            <a
              key={plugin.slug}
              href={`/plugins/${plugin.slug}`}
              className="group relative flex flex-col p-6 rounded-2xl transition-all duration-300 cursor-pointer no-underline"
              style={{
                background: 'var(--color-card-bg)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-card)',
                animationDelay: `${idx * 50}ms`,
                animationFillMode: 'both',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-card-hover)';
                e.currentTarget.style.borderColor = 'var(--color-border-hover)';
                e.currentTarget.style.transform = 'scale(1.02) translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-card-bg)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.transform = 'scale(1) translateY(0)';
              }}
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-500/0 to-purple-500/0 group-hover:from-yellow-500/5 group-hover:to-purple-500/5 transition-all duration-300 pointer-events-none" />

              {/* Type badge */}
              {plugin.type === 'marketplace' && (
                <span
                  className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                  style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#a78bfa',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                  }}
                >
                  Marketplace
                </span>
              )}

              {/* Header */}
              <div className="relative z-10 flex items-start gap-4 mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 text-[22px] font-bold select-none"
                  style={{
                    background: 'linear-gradient(135deg, #ffd93d18 0%, #ffd93d08 100%)',
                    border: '1.5px solid #ffd93d30',
                    color: '#ffd93d',
                  }}
                >
                  {plugin.author.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <h3
                    className="text-[15px] font-bold leading-tight mb-1 transition-colors"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {plugin.name}
                  </h3>
                  <p className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    by {plugin.author}
                  </p>
                </div>

                {/* Stars badge */}
                <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 transition-all bg-gradient-to-r from-yellow-500/15 to-amber-400/15 text-yellow-400 border border-yellow-500/25 group-hover:from-yellow-500/25 group-hover:to-amber-400/25 group-hover:border-yellow-500/40">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {formatStars(plugin.stars)}
                </span>
              </div>

              {/* Description */}
              <p
                className="relative z-10 text-[13px] line-clamp-2 leading-[1.6] mb-4 flex-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {plugin.description}
              </p>

              {/* Tags */}
              <div className="relative z-10 flex items-center gap-1.5 flex-wrap">
                {plugin.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all"
                    style={{
                      background: `${TAG_COLORS[tag] ?? '#666'}12`,
                      color: TAG_COLORS[tag] ?? '#666',
                      borderColor: `${TAG_COLORS[tag] ?? '#666'}25`,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
