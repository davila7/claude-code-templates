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
      <div className="px-6 py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-[--color-text-tertiary] border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-[--color-text-tertiary]">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-[13px] text-red-400">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-3 text-[13px] text-[--color-text-secondary] hover:text-[--color-text-primary] underline underline-offset-4">Retry</button>
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44 bg-white/[0.04] border-none rounded-lg text-[12px] text-[#ededed] placeholder:text-[#666] pl-8 pr-3 py-1.5 outline-none focus:bg-white/[0.08] focus:ring-1 focus:ring-white/10 transition-all"
          />
        </div>

        {/* Category select */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-white/[0.04] border-none rounded-lg text-[12px] text-[#a1a1a1] px-2.5 py-1.5 outline-none focus:bg-white/[0.08] cursor-pointer"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Sort */}
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'downloads' | 'name')}
            className="bg-white/[0.04] border-none rounded-lg text-[12px] text-[--color-text-secondary] px-2.5 py-1.5 outline-none focus:bg-white/[0.08] cursor-pointer"
          >
            <option value="downloads">Popular</option>
            <option value="name">A-Z</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="px-6 pb-2">
        <span className="text-[11px] text-[--color-text-tertiary]">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          {search && ` for "${search}"`}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-6 pb-6">
        {paged.map((component) => {
          const inCart = isInCart(component.path, component.type);
          const config = TYPE_CONFIG[activeType];

          return (
            <div
              key={component.path ?? component.name}
              className="group flex items-start gap-3 p-4 rounded-xl bg-[#111111] border border-[#1a1a1a] hover:border-[#2a2a2a] hover:bg-[#151515] transition-all duration-200 cursor-pointer"
              onClick={() => {
                window.location.href = `/component/${component.type}/${cleanPath(component.path ?? component.name)}`;
              }}
            >
              {/* Icon */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${config?.color ?? '#a1a1a1'}15`, color: config?.color ?? '#a1a1a1' }}
              >
                <TypeIcon type={activeType} size={18} className="[&>svg]:w-[18px] [&>svg]:h-[18px]" />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <span className="text-[13px] font-medium text-[--color-text-primary] group-hover:text-white transition-colors">
                  {formatName(component.name)}
                </span>
                <p className="text-[12px] text-[--color-text-tertiary] line-clamp-2 mt-1 leading-relaxed">
                  {component.description || component.content?.slice(0, 120) || 'No description'}
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  {component.category && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[--color-text-tertiary]">
                      {component.category}
                    </span>
                  )}
                  {(component.downloads ?? 0) > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
                      : 'text-[--color-text-tertiary] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10'
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
        <div className="px-6 py-16 text-center">
          <p className="text-[13px] text-[--color-text-tertiary]">No components found</p>
          {search && (
            <button onClick={() => setSearch('')} className="mt-2 text-[13px] text-[--color-text-secondary] hover:text-[--color-text-primary] underline underline-offset-4">
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Pagination - Vercel style */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 px-6 pb-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-[13px] rounded-lg text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-[12px] text-[--color-text-tertiary] tabular-nums">
            {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-[13px] rounded-lg text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
