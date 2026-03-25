import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Component, ComponentsData, ComponentType } from '../lib/types';
import { TYPE_CONFIG } from '../lib/icons';
import { ITEMS_PER_PAGE, COMPONENTS_JSON_URL } from '../lib/constants';
import SaveToCollectionButton from './SaveToCollectionButton';

interface Props {
  initialType: string;
}

interface CartState {
  [key: string]: { name: string; path: string; category: string; description: string; icon: string }[];
}

function cleanPath(path: string): string {
  return path?.replace(/\.(md|json)$/, '') ?? '';
}

function formatName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\.(md|json)$/, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

import TypeIcon from './TypeIcon';

export default function ComponentGrid({ initialType }: Props) {
  const [data, setData] = useState<ComponentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string>(initialType);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'downloads' | 'name'>('downloads');
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState<CartState>({});

  // Sync activeType when initialType changes (e.g. sidebar navigation)
  useEffect(() => {
    setActiveType(initialType);
    setCategory('all');
    setPage(1);
  }, [initialType]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(COMPONENTS_JSON_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) { setData(json); setLoading(false); }
      } catch (err: any) {
        if (!cancelled && err.name !== 'AbortError') { setError('Failed to load components'); setLoading(false); }
      }
    }

    load();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('claudeCodeCart');
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);


  const typeComponents = useMemo(() => {
    if (!data) return [];
    return (data[activeType as ComponentType] as Component[]) ?? [];
  }, [data, activeType]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const c of typeComponents) { if (c.category) cats.add(c.category); }
    return Array.from(cats).sort();
  }, [typeComponents]);

  const filtered = useMemo(() => {
    let items = typeComponents;
    if (category !== 'all') items = items.filter((c) => c.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((c) =>
        c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q)
      );
    }
    const sorted = [...items];
    if (sortBy === 'downloads') sorted.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [typeComponents, category, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [category, search, activeType]);

  const counts = useMemo(() => {
    if (!data) return {};
    const result: Record<string, number> = {};
    for (const type of Object.keys(TYPE_CONFIG)) result[type] = ((data as any)[type] as Component[])?.length ?? 0;
    return result;
  }, [data]);

  // Emit counts to sidebar
  useEffect(() => {
    if (Object.keys(counts).length > 0) {
      window.dispatchEvent(new CustomEvent('component-counts', { detail: counts }));
    }
  }, [counts]);

  const isInCart = useCallback(
    (path: string, type: string) => {
      const typePlural = type.endsWith('s') ? type : type + 's';
      return cart[typePlural]?.some((item) => item.path === path) ?? false;
    },
    [cart]
  );

  const toggleCart = useCallback((component: Component) => {
    const typePlural = component.type.endsWith('s') ? component.type : component.type + 's';
    setCart((prev) => {
      const items = prev[typePlural] ?? [];
      const exists = items.some((i) => i.path === component.path);
      let newItems: CartState;
      if (exists) {
        newItems = { ...prev, [typePlural]: items.filter((i) => i.path !== component.path) };
      } else {
        newItems = { ...prev, [typePlural]: [...items, {
          name: component.name, path: component.path, category: component.category ?? '',
          description: component.description ?? '', icon: typePlural,
        }] };
      }
      localStorage.setItem('claudeCodeCart', JSON.stringify(newItems));
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: newItems }));
      return newItems;
    });
  }, []);

  if (loading) {
    return (
      <div className="px-6 py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 border-2 border-[var(--color-border)] rounded-full" />
            <div className="absolute inset-0 border-2 border-[var(--color-primary-500)] border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[13px] font-medium text-[var(--color-text-primary)]">Loading components</span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">This will only take a moment</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-24">
        <div className="flex flex-col items-center gap-4 max-w-md mx-auto text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-1">Failed to load components</h3>
            <p className="text-[13px] text-[var(--color-text-secondary)]">{error}</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 text-[13px] font-medium rounded-lg bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] transition-all active:scale-95"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-0)]">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-tertiary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] pl-9 pr-3 py-2 outline-none focus:bg-[var(--color-surface-3)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-primary-500)]/20 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Category select */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[12px] text-[var(--color-text-secondary)] px-3 py-2 pr-8 outline-none focus:bg-[var(--color-surface-3)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-primary-500)]/20 cursor-pointer transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%23737373%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.25rem_center] bg-no-repeat"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Sort */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-[var(--color-text-tertiary)] hidden sm:inline">Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'downloads' | 'name')}
            className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[12px] text-[var(--color-text-secondary)] px-3 py-2 pr-8 outline-none focus:bg-[var(--color-surface-3)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-primary-500)]/20 cursor-pointer transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%23737373%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.25rem_center] bg-no-repeat"
          >
            <option value="downloads">Popular</option>
            <option value="name">A-Z</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <span className="text-[12px] text-[var(--color-text-tertiary)]">
          <span className="font-medium text-[var(--color-text-secondary)]">{filtered.length}</span> {filtered.length !== 1 ? 'components' : 'component'}
          {search && <span> matching <span className="font-medium text-[var(--color-text-secondary)]">"{search}"</span></span>}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 px-6 pb-6">
        {paged.map((component) => {
          const inCart = isInCart(component.path, component.type);
          const config = TYPE_CONFIG[activeType];

          return (
            <div
              key={component.path ?? component.name}
              className="group flex items-start gap-3.5 p-5 rounded-xl bg-[var(--color-card-bg)] hover:bg-[var(--color-card-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all duration-200 cursor-pointer hover:scale-[1.01]"
              style={{ boxShadow: 'var(--shadow-card)' }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
              onClick={() => {
                window.location.href = `/component/${component.type}/${cleanPath(component.path ?? component.name)}`;
              }}
            >
              {/* Icon with background */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ 
                  backgroundColor: `${config?.color ?? '#a1a1a1'}18`, 
                  color: config?.color ?? '#a1a1a1',
                  border: `1px solid ${config?.color ?? '#a1a1a1'}25`
                }}
              >
                <TypeIcon type={activeType} size={20} className="[&>svg]:w-[20px] [&>svg]:h-[20px]" />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                  {formatName(component.name)}
                </h3>
                <p className="text-[13px] text-[var(--color-text-secondary)] line-clamp-2 mt-1.5 leading-[1.5]">
                  {component.description || component.content?.slice(0, 120) || 'No description'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {component.category && (
                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]">
                      {component.category}
                    </span>
                  )}
                  {(component.downloads ?? 0) > 0 && (
                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/12 text-emerald-500 flex items-center gap-1 border border-emerald-500/20">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      {component.downloads?.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 shrink-0">
                <SaveToCollectionButton
                  componentType={component.type}
                  componentPath={component.path}
                  componentName={component.name}
                  componentCategory={component.category}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCart(component); }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 transition-all ${
                    inCart
                      ? 'bg-white text-black'
                      : 'text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
                  }`}
                  title={inCart ? 'Remove from stack' : 'Add to stack'}
                >
                  {inCart ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {paged.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center px-6 py-20">
          {/* Illustration */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {/* Decorative dots */}
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[var(--color-accent-400)] opacity-60"></div>
            <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-[var(--color-primary-400)] opacity-60"></div>
          </div>

          {/* Message */}
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-2">
            {search ? `No results for "${search}"` : 'No components found'}
          </h3>
          <p className="text-[13px] text-[var(--color-text-secondary)] max-w-sm mb-6 leading-relaxed">
            {search 
              ? "We couldn't find any components matching your search. Try different keywords or browse all categories."
              : category !== 'all'
              ? "No components in this category yet. Try selecting a different category or browse all."
              : "No components available at the moment. Check back soon!"}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {search && (
              <button 
                onClick={() => setSearch('')} 
                className="px-4 py-2 text-[13px] font-medium rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all"
              >
                Clear search
              </button>
            )}
            {category !== 'all' && (
              <button 
                onClick={() => setCategory('all')} 
                className="px-4 py-2 text-[13px] font-medium rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all"
              >
                View all categories
              </button>
            )}
            {!search && category === 'all' && (
              <a 
                href="/" 
                className="px-4 py-2 text-[13px] font-medium rounded-lg bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] transition-all"
              >
                Browse all components
              </a>
            )}
          </div>
        </div>
      )}

      {/* Pagination - Vercel style */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-6 pb-8 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 text-[12px] font-medium rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 disabled:active:scale-100"
            aria-label="Previous page"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex items-center gap-1">
            <span className="px-3 py-2 text-[12px] font-medium text-[var(--color-text-primary)] tabular-nums">
              Page {page}
            </span>
            <span className="text-[12px] text-[var(--color-text-tertiary)]">of</span>
            <span className="px-3 py-2 text-[12px] font-medium text-[var(--color-text-secondary)] tabular-nums">
              {totalPages}
            </span>
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 text-[12px] font-medium rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 disabled:active:scale-100"
            aria-label="Next page"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
