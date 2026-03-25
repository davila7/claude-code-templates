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
  const [sortBy, setSortBy] = useState<'downloads' | 'name' | 'recent'>('downloads');
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState<CartState>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [minDownloads, setMinDownloads] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

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
    
    // Apply either single-category OR multi-category filter, not both
    if (selectedCategories.length > 0) {
      // Multi-category filter takes precedence
      items = items.filter((c) => selectedCategories.includes(c.category ?? ''));
    } else if (category !== 'all') {
      // Single-category filter
      items = items.filter((c) => c.category === category);
    }
    
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((c) =>
        c.name.toLowerCase().includes(q) || 
        c.description?.toLowerCase().includes(q) || 
        c.category?.toLowerCase().includes(q) ||
        c.content?.toLowerCase().includes(q)
      );
    }
    
    // Downloads filter
    if (minDownloads > 0) {
      items = items.filter((c) => (c.downloads ?? 0) >= minDownloads);
    }
    
    // Sort
    const sorted = [...items];
    if (sortBy === 'downloads') sorted.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
    else if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'recent') {
      // TODO: Sort by actual date when available. Using reverse name sort as approximation.
      sorted.sort((a, b) => b.name.localeCompare(a.name));
    }
    
    return sorted;
  }, [typeComponents, category, selectedCategories, search, sortBy, minDownloads]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [category, search, activeType, selectedCategories, minDownloads]);

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

  const toggleCategoryFilter = useCallback((cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearch('');
    setCategory('all');
    setSelectedCategories([]);
    setMinDownloads(0);
  }, []);

  const hasActiveFilters = search || category !== 'all' || selectedCategories.length > 0 || minDownloads > 0;

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
      <div className="px-6 py-32">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-16 h-16">
            {/* Outer ring */}
            <div className="absolute inset-0 border-[3px] border-[var(--color-border)] rounded-full opacity-20" />
            {/* Spinning gradient ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[var(--color-primary-500)] via-[var(--color-accent-400)] to-[var(--color-primary-500)] opacity-80 animate-spin" style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 50% 0%)' }} />
            <div className="absolute inset-[3px] bg-[var(--color-surface-0)] rounded-full" />
            {/* Inner pulse */}
            <div className="absolute inset-[6px] bg-gradient-to-br from-[var(--color-primary-500)]/20 to-[var(--color-accent-400)]/20 rounded-full animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-[14px] font-semibold text-[var(--color-text-primary)] animate-pulse">Loading components</span>
            <span className="text-[12px] text-[var(--color-text-tertiary)]">Preparing your experience...</span>
          </div>
          {/* Skeleton cards preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full max-w-6xl mt-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-5 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-border)] animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-[var(--color-surface-3)] skeleton" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-[var(--color-surface-3)] rounded skeleton w-3/4" />
                    <div className="space-y-2">
                      <div className="h-3 bg-[var(--color-surface-3)] rounded skeleton" />
                      <div className="h-3 bg-[var(--color-surface-3)] rounded skeleton w-5/6" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-5 w-16 bg-[var(--color-surface-3)] rounded-full skeleton" />
                      <div className="h-5 w-20 bg-[var(--color-surface-3)] rounded-full skeleton" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
      {/* Enhanced Filter bar with view modes */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-0)] backdrop-blur-sm sticky top-14 z-10">
        <div className="flex items-center gap-2.5 px-6 py-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search components..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] pl-10 pr-9 py-2.5 outline-none focus:bg-[var(--color-surface-3)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-500)]/20 transition-all hover:border-[var(--color-border-hover)]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-all active:scale-95"
                aria-label="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category select */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] font-medium px-3.5 py-2.5 pr-9 outline-none focus:bg-[var(--color-surface-3)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-500)]/20 cursor-pointer transition-all appearance-none hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%23737373%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
          >
            <option value="all">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold rounded-lg border transition-all active:scale-95 ${
              showFilters || hasActiveFilters
                ? 'bg-[var(--color-primary-500)] text-white border-[var(--color-primary-500)] shadow-lg'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            )}
          </button>

          {/* View Mode Toggle */}
          <div className="hidden md:flex items-center gap-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-[var(--color-surface-4)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
              }`}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-[var(--color-surface-4)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
              }`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium hidden sm:inline">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'downloads' | 'name' | 'recent')}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] font-medium px-3.5 py-2.5 pr-9 outline-none focus:bg-[var(--color-surface-3)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-500)]/20 cursor-pointer transition-all appearance-none hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%23737373%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
            >
              <option value="downloads">Most Popular</option>
              <option value="name">Alphabetical</option>
              <option value="recent">Recently Added</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="px-6 py-5 border-t border-[var(--color-border)] bg-[var(--color-surface-1)] animate-fade-in-up">
            <div className="flex items-start gap-6">
              {/* Multi-category filter */}
              <div className="flex-1">
                <label className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3 block">
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 8).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleCategoryFilter(cat)}
                      className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-all active:scale-95 ${
                        selectedCategories.includes(cat)
                          ? 'bg-[var(--color-primary-500)] text-white border-[var(--color-primary-500)] shadow-md'
                          : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface-3)]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Downloads filter */}
              <div className="w-64">
                <label className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3 block">
                  Min Downloads: {minDownloads}+
                </label>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="50"
                  value={minDownloads}
                  onChange={(e) => setMinDownloads(Number(e.target.value))}
                  className="w-full h-2 bg-[var(--color-surface-3)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary-500)]"
                />
                <div className="flex justify-between text-[10px] text-[var(--color-text-tertiary)] mt-1">
                  <span>0</span>
                  <span>500</span>
                  <span>1000+</span>
                </div>
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="px-4 py-2 text-[12px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all active:scale-95"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results count with quick actions */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[var(--color-text-secondary)] font-medium">
              {filtered.length} {filtered.length !== 1 ? 'components' : 'component'}
            </span>
            {search && (
              <span className="text-[12px] text-[var(--color-text-tertiary)]">
                matching <span className="font-medium text-[var(--color-text-secondary)]">"{search}"</span>
              </span>
            )}
            {category !== 'all' && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]">
                {category}
              </span>
            )}
          </div>
          
          {/* Quick Actions */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => {
                  paged.forEach(comp => {
                    if (!isInCart(comp.path, comp.type)) {
                      toggleCart(comp);
                    }
                  });
                }}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all active:scale-95"
                title="Add all visible components to stack"
              >
                + Add Page to Stack
              </button>
            </div>
          )}
        </div>
        
        {/* Keyboard shortcuts hint */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
          <kbd className="px-2 py-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] font-mono">⌘K</kbd>
          <span>to search</span>
        </div>
      </div>

      {/* Grid or List View */}
      <div className={viewMode === 'grid' 
        ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 px-6 pb-6" 
        : "flex flex-col gap-4 px-6 pb-6"
      }>
        {paged.map((component, idx) => {
          const inCart = isInCart(component.path, component.type);
          const config = TYPE_CONFIG[activeType];

          if (viewMode === 'list') {
            // List View
            return (
              <div
                key={component.path ?? component.name}
                className="group relative flex items-center gap-5 p-5 rounded-xl bg-[var(--color-card-bg)] hover:bg-[var(--color-card-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all duration-300 cursor-pointer hover:scale-[1.005] hover:-translate-y-0.5 animate-fade-in-up"
                style={{ 
                  boxShadow: 'var(--shadow-card)',
                  animationDelay: `${idx * 30}ms`,
                  animationFillMode: 'both'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
                  e.currentTarget.style.borderColor = `${config?.color ?? '#a1a1a1'}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                  e.currentTarget.style.borderColor = '';
                }}
                onClick={() => {
                  window.location.href = `/component/${component.type}/${cleanPath(component.path ?? component.name)}`;
                }}
              >
                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3"
                  style={{ 
                    backgroundColor: `${config?.color ?? '#a1a1a1'}18`, 
                    color: config?.color ?? '#a1a1a1',
                    border: `1.5px solid ${config?.color ?? '#a1a1a1'}30`,
                    boxShadow: `0 4px 12px ${config?.color ?? '#a1a1a1'}20`
                  }}
                >
                  <TypeIcon type={activeType} size={28} className="[&>svg]:w-[28px] [&>svg]:h-[28px]" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-bold text-[var(--color-text-primary)] mb-1.5">
                    {formatName(component.name)}
                  </h3>
                  <p className="text-[13px] text-[var(--color-text-secondary)] line-clamp-1 leading-relaxed">
                    {component.description || component.content?.slice(0, 150) || 'No description'}
                  </p>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 shrink-0">
                  {component.category && (
                    <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]">
                      {component.category}
                    </span>
                  )}
                  {(component.downloads ?? 0) > 0 && (
                    <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/15 to-emerald-400/15 text-emerald-400 flex items-center gap-1.5 border border-emerald-500/25">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      {component.downloads?.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <SaveToCollectionButton
                    componentType={component.type}
                    componentPath={component.path}
                    componentName={component.name}
                    componentCategory={component.category}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleCart(component); }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      inCart
                        ? 'bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-600)] text-white shadow-lg hover:shadow-xl scale-100 hover:scale-105'
                        : 'text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] hover:scale-110'
                    }`}
                    title={inCart ? 'Remove from stack' : 'Add to stack'}
                  >
                    {inCart ? (
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          }

          // Grid View (existing code)
          return (
            <div
              key={component.path ?? component.name}
              className="group relative flex items-start gap-4 p-6 rounded-2xl bg-[var(--color-card-bg)] hover:bg-[var(--color-card-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:-translate-y-1 animate-fade-in-up"
              style={{ 
                boxShadow: 'var(--shadow-card)',
                animationDelay: `${idx * 50}ms`,
                animationFillMode: 'both'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
                e.currentTarget.style.borderColor = `${config?.color ?? '#a1a1a1'}40`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                e.currentTarget.style.borderColor = '';
              }}
              onClick={() => {
                window.location.href = `/component/${component.type}/${cleanPath(component.path ?? component.name)}`;
              }}
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--color-primary-500)]/0 to-[var(--color-accent-400)]/0 group-hover:from-[var(--color-primary-500)]/5 group-hover:to-[var(--color-accent-400)]/5 transition-all duration-300 pointer-events-none" />
              
              {/* Icon with background */}
              <div
                className="relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 z-10"
                style={{ 
                  backgroundColor: `${config?.color ?? '#a1a1a1'}18`, 
                  color: config?.color ?? '#a1a1a1',
                  border: `1.5px solid ${config?.color ?? '#a1a1a1'}30`,
                  boxShadow: `0 4px 12px ${config?.color ?? '#a1a1a1'}20`
                }}
              >
                <TypeIcon type={activeType} size={24} className="[&>svg]:w-[24px] [&>svg]:h-[24px]" />
                {/* Glow effect */}
                <div 
                  className="absolute inset-0 rounded-xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300"
                  style={{ backgroundColor: config?.color ?? '#a1a1a1' }}
                />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1 relative z-10">
                <h3 className="text-[15px] font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)] transition-colors leading-tight mb-2">
                  {formatName(component.name)}
                </h3>
                <p className="text-[13px] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-secondary)] line-clamp-2 leading-[1.6] transition-colors">
                  {component.description || component.content?.slice(0, 120) || 'No description'}
                </p>
                <div className="flex items-center gap-2 mt-4">
                  {component.category && (
                    <span className="text-[10px] font-semibold px-3 py-1.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] border border-[var(--color-border)] transition-all group-hover:border-[var(--color-border-hover)] group-hover:bg-[var(--color-surface-4)]">
                      {component.category}
                    </span>
                  )}
                  {(component.downloads ?? 0) > 0 && (
                    <span className="text-[10px] font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/15 to-emerald-400/15 text-emerald-400 flex items-center gap-1.5 border border-emerald-500/25 transition-all group-hover:from-emerald-500/20 group-hover:to-emerald-400/20 group-hover:border-emerald-500/35 group-hover:shadow-lg group-hover:shadow-emerald-500/10">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      {component.downloads?.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0 relative z-10">
                <SaveToCollectionButton
                  componentType={component.type}
                  componentPath={component.path}
                  componentName={component.name}
                  componentCategory={component.category}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCart(component); }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    inCart
                      ? 'bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-600)] text-white shadow-lg hover:shadow-xl hover:from-[var(--color-primary-600)] hover:to-[var(--color-primary-700)] scale-100 hover:scale-105'
                      : 'text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] hover:scale-110 hover:shadow-md'
                  }`}
                  title={inCart ? 'Remove from stack' : 'Add to stack'}
                  aria-label={inCart ? 'Remove from stack' : 'Add to stack'}
                >
                  {inCart ? (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
        <div className="flex flex-col items-center justify-center px-6 py-32">
          {/* Animated illustration */}
          <div className="relative mb-8 animate-float">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[var(--color-surface-2)] to-[var(--color-surface-3)] border border-[var(--color-border)] flex items-center justify-center shadow-xl">
              <svg className="w-12 h-12 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {/* Decorative animated elements */}
            <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-gradient-to-br from-[var(--color-accent-400)] to-[var(--color-accent-500)] opacity-80 animate-ping" style={{ animationDuration: '2s' }}></div>
            <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[var(--color-accent-400)] opacity-80"></div>
            <div className="absolute -bottom-2 -left-2 w-3 h-3 rounded-full bg-gradient-to-br from-[var(--color-primary-400)] to-[var(--color-primary-500)] opacity-80 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}></div>
            <div className="absolute -bottom-2 -left-2 w-3 h-3 rounded-full bg-[var(--color-primary-400)] opacity-80"></div>
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary-500)]/10 to-[var(--color-accent-400)]/10 rounded-3xl blur-2xl -z-10"></div>
          </div>

          {/* Message */}
          <h3 className="text-[17px] font-bold text-[var(--color-text-primary)] mb-3">
            {search ? `No results for "${search}"` : 'No components found'}
          </h3>
          <p className="text-[14px] text-[var(--color-text-secondary)] max-w-md text-center mb-8 leading-relaxed">
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
                className="px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:shadow-lg transition-all active:scale-95"
              >
                Clear search
              </button>
            )}
            {category !== 'all' && (
              <button 
                onClick={() => setCategory('all')} 
                className="px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:shadow-lg transition-all active:scale-95"
              >
                View all categories
              </button>
            )}
            {!search && category === 'all' && (
              <a 
                href="/" 
                className="px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-600)] text-white hover:from-[var(--color-primary-600)] hover:to-[var(--color-primary-700)] shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                Browse all components
              </a>
            )}
          </div>
        </div>
      )}

      {/* Pagination - Premium style */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 px-6 pb-10 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="group flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-md transition-all active:scale-95 disabled:active:scale-100 disabled:hover:shadow-none"
            aria-label="Previous page"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Previous</span>
          </button>
          
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-sm">
            <span className="text-[13px] font-bold text-[var(--color-text-primary)] tabular-nums">
              {page}
            </span>
            <span className="text-[13px] text-[var(--color-text-tertiary)] font-medium">/</span>
            <span className="text-[13px] font-semibold text-[var(--color-text-secondary)] tabular-nums">
              {totalPages}
            </span>
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="group flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-md transition-all active:scale-95 disabled:active:scale-100 disabled:hover:shadow-none"
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
