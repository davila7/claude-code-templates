import { useState, useEffect, useRef, useCallback } from 'react';
import type { Component, ComponentsData } from '../lib/types';
import { TYPE_CONFIG } from '../lib/icons';
import TypeIcon from './TypeIcon';
import { COMPONENTS_JSON_URL } from '../lib/constants';

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

export default function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<ComponentsData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load data lazily on first open
  useEffect(() => {
    if (!open || data) return;

    fetch(COMPONENTS_JSON_URL)
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch(() => {});
  }, [open, data]);

  // Cmd+K listener
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);

    // Also listen for search trigger button clicks
    const trigger = document.getElementById('searchTrigger');
    const handler = () => setOpen(true);
    trigger?.addEventListener('click', handler);

    return () => {
      window.removeEventListener('keydown', handleKey);
      trigger?.removeEventListener('click', handler);
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search results
  const results = useCallback(() => {
    if (!data || !query.trim()) return [];

    const q = query.toLowerCase();
    const all: Component[] = [];

    for (const type of Object.keys(TYPE_CONFIG)) {
      const items = (data as any)[type] as Component[] | undefined;
      if (items) all.push(...items);
    }

    return all
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [data, query])();

  // Keyboard navigation
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      const c = results[selectedIndex];
      navigate(c);
    }
  }

  function navigate(component: Component) {
    setOpen(false);
    window.location.href = `/component/${component.type}/${cleanPath(component.path ?? component.name)}`;
  }

  // Scroll selected into view
  useEffect(() => {
    const container = resultsRef.current;
    const selected = container?.children[selectedIndex] as HTMLElement;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl bg-[--color-surface-1] border border-[--color-border] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[--color-border]">
          <svg className="w-5 h-5 text-[--color-text-tertiary] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search all components..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-[--color-text-primary] placeholder:text-[--color-text-tertiary] outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] bg-[--color-surface-3] border border-[--color-border] rounded text-[--color-text-tertiary]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-80 overflow-y-auto">
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[--color-text-secondary]">
              No components found for "{query}"
            </div>
          )}

          {results.map((component, i) => {
            const typePlural = component.type.endsWith('s') ? component.type : component.type + 's';
            const config = TYPE_CONFIG[typePlural];

            return (
              <button
                key={component.path ?? `${component.name}-${i}`}
                onClick={() => navigate(component)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIndex
                    ? 'bg-[--color-primary-500]/10'
                    : 'hover:bg-[--color-surface-2]'
                }`}
              >
                <TypeIcon type={typePlural} size={16} className="w-4 h-4 shrink-0 [&>svg]:w-4 [&>svg]:h-4 text-[--color-text-tertiary]" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-[--color-text-primary]">{formatName(component.name)}</span>
                  <span className="text-xs text-[--color-text-tertiary] ml-2">{config?.label ?? component.type}</span>
                </div>
                {component.category && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[--color-surface-3] text-[--color-text-tertiary] shrink-0">
                    {component.category}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        {query.trim() && results.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-[--color-border] text-[10px] text-[--color-text-tertiary]">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
