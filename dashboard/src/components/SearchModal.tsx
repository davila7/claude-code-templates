import { useState, useEffect, useRef, useMemo } from 'react';
import { TYPE_CONFIG } from '../lib/icons';
import TypeIcon from './TypeIcon';
import { fetchSearchIndex, type SearchIndexEntry } from '../lib/data';
import { fetchActiveAds, findSponsoredIndex, type ActiveAd } from '../lib/ads';

type SearchResult = SearchIndexEntry & { sponsored?: boolean };

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
  const [data, setData] = useState<SearchIndexEntry[] | null>(null);
  const [ads, setAds] = useState<ActiveAd[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  // Load the lightweight search index lazily on first open
  useEffect(() => {
    if (!open || data) return;

    fetchSearchIndex()
      .then((entries) => setData(entries))
      .catch(() => {});
  }, [open, data]);

  // Refresh ads on every open (the lib's 5-min cache dedupes network traffic)
  useEffect(() => {
    if (!open) return;
    fetchActiveAds()
      .then((activeAds) => setAds(activeAds))
      .catch(() => {});
  }, [open]);

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
    // Clear any pending close timeout to prevent race conditions
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(true);
    setIsAnimating(true);
  }

  function closeModal() {
    setIsAnimating(false);
    // Clear any existing timeout before setting a new one
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimeoutRef.current = null;
    }, 200); // Match animation duration
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
  const results = useMemo<SearchResult[]>(() => {
    if (!data || !query.trim()) return [];

    const q = query.toLowerCase();

    const matched = data.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q)
    );

    const top: SearchResult[] = matched.slice(0, 20);

    // Sponsored placement: first matching active ad jumps to position 0.
    // The ad stays inside `results`, so keyboard navigation and
    // scroll-into-view keep working untouched.
    const adIdx = findSponsoredIndex(ads, matched);
    if (adIdx !== -1) {
      const sponsored: SearchResult = { ...matched[adIdx], sponsored: true };
      const inTop = top.findIndex((c) => c.path === sponsored.path && c.type === sponsored.type);
      if (inTop !== -1) top.splice(inTop, 1);
      else if (top.length >= 20) top.pop();
      top.unshift(sponsored);
    }

    return top;
  }, [data, ads, query]);

  // Keyboard navigation: reset on new queries; when the same query's results
  // reorder (ads arriving async), re-anchor to the item that was highlighted
  // instead of snapping back to the top.
  const prevResultsRef = useRef<SearchResult[]>([]);
  const lastQueryRef = useRef(query);
  useEffect(() => {
    const prev = prevResultsRef.current;
    prevResultsRef.current = results;
    if (lastQueryRef.current !== query) {
      lastQueryRef.current = query;
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex((i) => {
      const selected = prev[i];
      if (!selected) return 0;
      const newIndex = results.findIndex((r) => r.path === selected.path && r.type === selected.type);
      return newIndex === -1 ? 0 : newIndex;
    });
  }, [query, results]);

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

  function navigate(component: SearchIndexEntry) {
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
                  component.sponsored
                    ? 'border-l-2 border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/5'
                    : ''
                } ${
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
                {component.sponsored && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[var(--color-primary-500)]/40 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-500)] shrink-0">
                    Sponsored
                  </span>
                )}
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
