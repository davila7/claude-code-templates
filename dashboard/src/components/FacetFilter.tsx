import { useEffect, useRef, useState } from 'react';
import type { FacetOption } from '../lib/certifications';

// A multi-select dropdown whose options come from the data, so any number of
// them fits: past SEARCH_FROM options it gets its own search box.
const SEARCH_FROM = 8;
const POPOVER_WIDTH = 256;
const VIEWPORT_GUTTER = 16;

interface Props {
  label: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  optionLabel?: (value: string) => string;
  optionIcon?: (value: string) => React.ReactNode;
}

export default function FacetFilter({ label, options, selected, onToggle, onClear, optionLabel = (v) => v, optionIcon }: Props) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleOpen = () => {
    // Shift left only as much as needed for the popover to stay on screen.
    const left = buttonRef.current?.getBoundingClientRect().left ?? 0;
    const overflow = left + POPOVER_WIDTH + VIEWPORT_GUTTER - window.innerWidth;
    setOffset(overflow > 0 ? -Math.min(overflow, left - VIEWPORT_GUTTER) : 0);
    setSearch('');
    setOpen((v) => !v);
  };

  const needle = search.trim().toLowerCase();
  const shown = needle ? options.filter((o) => optionLabel(o.value).toLowerCase().includes(needle)) : options;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1.5 rounded-lg border bg-[var(--color-surface-2)] px-3 py-1.5 text-[12px] font-medium transition-colors ${
          selected.length > 0
            ? 'border-[var(--color-border-hover)] text-[var(--color-text-primary)]'
            : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded bg-[var(--color-accent-light)] px-1 text-[10px] tabular-nums text-[var(--color-accent)]">{selected.length}</span>
        )}
        <svg className={`w-3.5 h-3.5 text-[var(--color-text-tertiary)] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="group"
          aria-label={label}
          style={{ width: POPOVER_WIDTH, left: offset }}
          className="absolute top-full z-30 mt-1 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-xl"
        >
          {options.length >= SEARCH_FROM && (
            <div className="border-b border-[var(--color-border)] p-2">
              <input
                type="search"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Find ${label.toLowerCase()}...`}
                aria-label={`Find ${label.toLowerCase()}`}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-hover)]"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto p-1">
            {shown.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => onToggle(o.value)}
                  className="shrink-0 accent-[var(--color-accent)]"
                />
                {optionIcon && <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden">{optionIcon(o.value)}</span>}
                <span className="min-w-0 flex-1 truncate">{optionLabel(o.value)}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-text-tertiary)]">{o.count}</span>
              </label>
            ))}
            {shown.length === 0 && <p className="px-2 py-3 text-center text-[12px] text-[var(--color-text-tertiary)]">No matches</p>}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-[var(--color-border)] p-1">
              <button type="button" onClick={onClear} className="w-full rounded px-2 py-1 text-left text-[11px] text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]">
                Clear {label.toLowerCase()}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
