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
  const [isAnimating, setIsAnimating] = useState(false);
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
        if (open) {
          closeModal();
        } else {
          openModal();
        }
      }
      if (e.key === 'Escape' && open) closeModal();
    }
    
    const handleTriggerClick = (e: Event) => {
      e.preventDefault();
      openModal();
    };

    window.addEventListener('keydown', handleKey);

    // Use MutationObserver to watch for the trigger button
    let observer: MutationObserver | null = null;
    let timeoutId: number | null = null;
    
    const trigger = document.getElementById('searchTrigger');
    if (trigger) {
      trigger.addEventListener('click', handleTriggerClick);
    } else {
      // Watch for the button to be added to the DOM
      observer = new MutationObserver(() => {
        const btn = document.getElementById('searchTrigger');
        if (btn) {
          btn.addEventListener('click', handleTriggerClick);
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      
      // Cleanup observer after 5 seconds if button never appears
      timeoutId = window.setTimeout(() => {
        observer?.disconnect();
        observer = null;
      }, 5000);
    }

    return () => {
      window.removeEventListener('keydown', handleKey);
      const trigger = document.getElementById('searchTrigger');
      trigger?.removeEventListener('click', handleTriggerClick);
      if (observer) {
        observer.disconnect();
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [open]);

  function openModal() {
    setOpen(true);
    setIsAnimating(true);
  }

  function closeModal() {
    setIsAnimating(false);
    const timeoutId = setTimeout(() => setOpen(false), 200); // Match animation duration
    // Store timeout ID for potential cleanup
    return () => clearTimeout(timeoutId);
  }

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
    closeModal();
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
      onClick={closeModal}
    >
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`} 
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden transition-all duration-200 ${
          isAnimating 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] transition-all duration-200 delay-[75ms] ${
          isAnimating ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
        }`}>
          <svg className="w-5 h-5 text-[var(--color-text-tertiary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search all components..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded text-[var(--color-text-tertiary)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className={`max-h-80 overflow-y-auto transition-all duration-200 delay-100 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}>
          {query.trim() && results.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-12">
              {/* Icon */}
              <div className="w-16 h-16 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              {/* Message */}
              <p className="text-[14px] font-medium text-[var(--color-text-primary)] mb-1">No results found</p>
              <p className="text-[13px] text-[var(--color-text-secondary)] text-center max-w-xs">
                We couldn't find any components for "<span className="font-medium text-[var(--color-text-primary)]">{query}</span>". Try different keywords.
              </p>
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
                    ? 'bg-[var(--color-primary-500)]/10'
                    : 'hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <TypeIcon type={typePlural} size={16} className="w-4 h-4 shrink-0 [&>svg]:w-4 [&>svg]:h-4 text-[var(--color-text-tertiary)]" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-[var(--color-text-primary)]">{formatName(component.name)}</span>
                  <span className="text-xs text-[var(--color-text-tertiary)] ml-2">{config?.label ?? component.type}</span>
                </div>
                {component.category && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] shrink-0">
                    {component.category}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        {query.trim() && results.length > 0 && (
          <div className={`flex items-center gap-4 px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-tertiary)] transition-all duration-200 delay-[150ms] ${
            isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}>
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
