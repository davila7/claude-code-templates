import { useState, useMemo, useRef, useEffect } from 'react';

interface ComponentItem {
  name: string;
  description?: string;
}

interface MarketplacePlugin {
  name: string;
  description?: string;
  source?: string;
  source_path?: string;
  author?: string;
  tags?: string[];
  components?: Record<string, number>;
  components_items?: Record<string, ComponentItem[]>;
}

interface Props {
  pluginsList: MarketplacePlugin[];
  marketplaceAuthor: string;
  marketplaceName: string;
  tagColors: Record<string, string>;
}

function getSourceLabel(p: MarketplacePlugin): 'local' | 'github' {
  const src = p.source ?? '';
  if (typeof src === 'string') {
    if (src.startsWith('./') || src.startsWith('../')) return 'local';
    if (src.includes('github.com') || src.includes('.git')) return 'github';
    if (src.includes('/')) return 'github';
  }
  return 'local';
}

export default function MarketplacePluginsList({
  pluginsList,
  marketplaceAuthor,
  marketplaceName,
  tagColors,
}: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MarketplacePlugin | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return pluginsList;
    const q = search.toLowerCase().trim();
    return pluginsList.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.author?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q)) ||
        Object.keys(p.components ?? {}).some((t) => t.toLowerCase().includes(q))
    );
  }, [pluginsList, search]);

  useEffect(() => {
    if (!selected) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selected]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) setSelected(null);
  }

  const namedTypes = new Set(Object.keys(selected?.components_items ?? {}));
  const countOnlyTypes = Object.entries(selected?.components ?? {}).filter(
    ([type]) => !namedTypes.has(type)
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
          Plugins ({filtered.length}
          {filtered.length !== pluginsList.length ? ` of ${pluginsList.length}` : ''})
        </h2>

        <div className="relative w-full sm:w-72">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
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
            placeholder="Search plugins in this marketplace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-lg text-[12.5px] outline-none transition-all duration-200"
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
              style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-tertiary)' }}
              aria-label="Clear search"
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-14 rounded-2xl"
          style={{ background: 'var(--color-surface-1)', border: '1px dashed var(--color-border)' }}
        >
          <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            No plugins match "{search}"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p, idx) => {
            const sourceType = getSourceLabel(p);
            const hasAuthor = p.author && p.author !== marketplaceAuthor;
            const hasComponents = p.components && Object.keys(p.components).length > 0;
            return (
              <button
                key={`${p.name}-${idx}`}
                type="button"
                onClick={() => setSelected(p)}
                className="text-left flex flex-col p-4 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all duration-200 cursor-pointer"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-start gap-3 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-bold select-none"
                    style={{
                      background: 'linear-gradient(135deg, #ffd93d12 0%, #ffd93d08 100%)',
                      border: '1px solid #ffd93d20',
                      color: '#ffd93d99',
                    }}
                  >
                    {(p.name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                        {p.name}
                      </h3>
                      {sourceType === 'github' && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]">
                          external
                        </span>
                      )}
                    </div>
                    {hasAuthor && (
                      <p className="text-[11px] text-[var(--color-text-tertiary)]">by {p.author}</p>
                    )}
                  </div>
                </div>

                {p.description && (
                  <p className="text-[12px] text-[var(--color-text-secondary)] leading-[1.5] line-clamp-2 mb-2 flex-1">
                    {p.description}
                  </p>
                )}

                {hasComponents && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                    {Object.entries(p.components!).map(([type, count]) => (
                      <span
                        key={type}
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-full border"
                        style={{
                          background: `${tagColors[type] ?? '#666'}10`,
                          color: tagColors[type] ?? '#666',
                          borderColor: `${tagColors[type] ?? '#666'}20`,
                        }}
                      >
                        {count} {type}
                      </span>
                    ))}
                  </div>
                )}

                {p.tags && p.tags.length > 0 && !hasComponents && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                    {p.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          ref={backdropRef}
          onClick={handleBackdropClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[13px] font-bold select-none"
                  style={{
                    background: 'linear-gradient(135deg, #ffd93d18 0%, #ffd93d08 100%)',
                    border: '1.5px solid #ffd93d30',
                    color: '#ffd93d',
                  }}
                >
                  {(selected.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                  {selected.name}
                </h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded hover:bg-white/10 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 overflow-y-auto space-y-4">
              {selected.description && (
                <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                  {selected.description}
                </p>
              )}

              {selected.author && selected.author !== marketplaceAuthor && (
                <p className="text-[12px] text-[var(--color-text-tertiary)]">by {selected.author}</p>
              )}

              {/* Components with resolved item names */}
              {Object.entries(selected.components_items ?? {}).map(([type, items]) => (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wider"
                      style={{
                        background: `${tagColors[type] ?? '#666'}15`,
                        color: tagColors[type] ?? '#666',
                        borderColor: `${tagColors[type] ?? '#666'}30`,
                      }}
                    >
                      {type}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">{items.length} items</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[12px]"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                          style={{ background: tagColors[type] ?? '#666' }}
                        />
                        <div className="min-w-0">
                          <div className="text-[var(--color-text-primary)] font-mono text-[11.5px] font-medium">
                            {item.name}
                          </div>
                          {item.description && (
                            <p className="text-[var(--color-text-tertiary)] text-[11.5px] leading-snug mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Component types where only a count is known (names not resolved) */}
              {countOnlyTypes.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {countOnlyTypes.map(([type, count]) => (
                    <span
                      key={type}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full border"
                      style={{
                        background: `${tagColors[type] ?? '#666'}12`,
                        color: tagColors[type] ?? '#666',
                        borderColor: `${tagColors[type] ?? '#666'}25`,
                      }}
                    >
                      {count} {type}
                    </span>
                  ))}
                </div>
              )}

              {!selected.components || Object.keys(selected.components).length === 0 ? (
                <p className="text-[12px] text-[var(--color-text-tertiary)] italic">
                  No component breakdown available for this plugin yet.
                </p>
              ) : null}

              {/* Install command */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1.5 font-medium">
                  Install this plugin
                </div>
                <pre className="p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[12px] text-[var(--color-text-secondary)] overflow-x-auto font-mono">
                  <code>{`/plugin install ${selected.name}@${marketplaceName}`}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
