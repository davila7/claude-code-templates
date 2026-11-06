import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CertificationModal, { LockIcon } from './CertificationModal';
import CompanyLogo from './CompanyLogo';
import { useGlobalAuth } from '../lib/use-global-auth';
import {
  FACETS,
  facetCounts,
  fetchCertifications,
  filterItems,
  formatPrice,
  sortBy,
  type CertificationsData,
  type FacetKey,
  type LearningItem,
  type ProviderInfo,
  type Selection,
  type SortKey,
} from '../lib/certifications';

// Facets shown as dropdowns, in order. A facet is hidden while the whole
// catalog has fewer than two values for it (a filter with one option filters
// nothing), so new groups appear on their own as providers and subjects grow.
const FACET_ORDER: { key: FacetKey; label: string }[] = [
  { key: 'category', label: 'Category' },
  { key: 'provider', label: 'Provider' },
  { key: 'kind', label: 'Type' },
  { key: 'level', label: 'Level' },
  { key: 'role', label: 'Role' },
  { key: 'price', label: 'Price' },
];
const VALUE_LABEL: Partial<Record<FacetKey, Record<string, string>>> = {
  kind: { certification: 'Certification', course: 'Course' },
  price: { free: 'Free', paid: 'Paid' },
};
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
];
const SEARCHABLE = 8;
const MENU_WIDTH = 256;
const GUTTER = 16;

const label = (facet: FacetKey, value: string) => VALUE_LABEL[facet]?.[value] ?? value;

function CertificationCard({ item, provider, onOpen }: { item: LearningItem; provider?: ProviderInfo; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] p-3 hover:border-[var(--color-accent)] hover:bg-[var(--color-card-hover)] transition-all group"
    >
      <div className="w-8 h-8 rounded shrink-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
        <CompanyLogo company={item.provider} icon={provider?.icon} imgClassName="w-4 h-4 object-contain" initialClassName="text-[11px] font-bold text-[var(--color-text-tertiary)]" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-[13px] font-semibold leading-snug text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">{item.title}</h2>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)] truncate">
          {[item.provider, ...item.categories.slice(0, 2)].join(' · ')}{item.categories.length > 2 && ` +${item.categories.length - 2}`}
        </p>
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {item.level && (
            <span className="text-[10px] font-medium bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">{item.level}</span>
          )}
          {item.role && (
            <span className="text-[10px] font-medium bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">{item.role}</span>
          )}
          <span className="text-[10px] font-medium bg-[var(--color-accent-light)] text-[var(--color-accent)] px-1.5 py-0.5 rounded border border-[var(--color-border)] tabular-nums">
            {formatPrice(item.price)}
          </span>
        </div>
      </div>
    </button>
  );
}

function FacetDropdown({
  facet,
  title,
  options,
  selected,
  onToggle,
  providers,
}: {
  facet: FacetKey;
  title: string;
  options: { value: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
  providers: Record<string, ProviderInfo>;
}) {
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    // Shift left only as much as the menu needs to stay inside both screen edges.
    const left = ref.current?.getBoundingClientRect().left ?? 0;
    const overflow = left + MENU_WIDTH + GUTTER - window.innerWidth;
    setOffset(overflow > 0 ? -Math.min(overflow, Math.max(0, left - GUTTER)) : 0);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const q = find.trim().toLowerCase();
  // Hide empty options unless they are selected, so a selection can always be undone.
  const shown = options.filter((o) => (o.count > 0 || selected.includes(o.value)) && (!q || label(facet, o.value).toLowerCase().includes(q)));
  const active = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
          active
            ? 'bg-[var(--color-accent-light)] border-[var(--color-accent)] text-[var(--color-accent)]'
            : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]'
        }`}
      >
        {title}
        {active && <span className="tabular-nums">({selected.length})</span>}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 8 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div
          style={{ width: MENU_WIDTH, left: offset }}
          className="absolute z-30 mt-1 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-lg p-1.5"
          role="group"
          aria-label={title}
        >
          {options.length > SEARCHABLE && (
            <input
              type="search"
              autoFocus
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder={`Find ${title.toLowerCase()}`}
              aria-label={`Find ${title.toLowerCase()}`}
              className="w-full mb-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md text-[16px] sm:text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-2.5 py-1.5 outline-none focus:border-[var(--color-accent)]"
            />
          )}
          <ul className="max-h-72 overflow-y-auto">
            {shown.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <li key={o.value}>
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[var(--color-surface-2)] text-[12px]">
                    <input type="checkbox" checked={checked} onChange={() => onToggle(o.value)} className="accent-[var(--color-accent)] w-3.5 h-3.5 shrink-0" />
                    {facet === 'provider' && (
                      <span className="w-4 h-4 shrink-0 flex items-center justify-center overflow-hidden">
                        <CompanyLogo company={o.value} icon={providers[o.value]?.icon} imgClassName="w-3.5 h-3.5 object-contain" initialClassName="text-[9px] font-bold text-[var(--color-text-tertiary)]" />
                      </span>
                    )}
                    <span className={`flex-1 truncate ${checked ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)]'}`}>{label(facet, o.value)}</span>
                    <span className="text-[11px] tabular-nums text-[var(--color-text-tertiary)]">{o.count}</span>
                  </label>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-2 py-1.5 text-[12px] text-[var(--color-text-tertiary)]">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CertificationsView() {
  const [data, setData] = useState<CertificationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection>({});
  const [sort, setSort] = useState<SortKey>('recommended');
  const [selected, setSelected] = useState<LearningItem | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const { isSignedIn, isLoaded } = useGlobalAuth();

  useEffect(() => {
    fetchCertifications()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const items = data?.items ?? [];
  const facets = useMemo(
    () =>
      FACET_ORDER.filter(({ key }) => new Set(items.flatMap(FACETS[key])).size > 1 || (selection[key]?.length ?? 0) > 0).map((f) => ({
        ...f,
        options: facetCounts(items, query, selection, f.key),
      })),
    [items, query, selection],
  );
  const visible = useMemo(() => sortBy(filterItems(items, query, selection), sort), [items, query, selection, sort]);
  const active = (Object.entries(selection) as [FacetKey, string[]][]).flatMap(([k, vs]) => vs.map((v) => ({ key: k, value: v })));

  const toggle = (key: FacetKey, value: string) =>
    setSelection((s) => {
      const cur = s[key] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      const { [key]: _, ...rest } = s;
      return next.length ? { ...rest, [key]: next } : rest;
    });
  const clearAll = () => {
    setSelection({});
    setQuery('');
  };

  if (loading) {
    return (
      <div className="px-6 py-20 flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-[var(--color-text-tertiary)]">Loading certifications...</span>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="px-6 py-24 text-center">
        <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-2">No certifications listed yet</h2>
        <p className="text-[13px] text-[var(--color-text-secondary)]">Check back soon.</p>
      </div>
    );
  }

  const showGate = isLoaded && !isSignedIn;
  const filtering = active.length > 0 || query.trim() !== '';

  return (
    <div className="max-w-6xl">
      <div className="px-4 sm:px-6 pt-5 pb-2">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Certifications & Courses</h1>
        <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1 max-w-3xl">
          Certifications and courses for developers, in one place.
          We list them; registration and payment happen on the provider's site.
        </p>
      </div>

      {showGate && (
        <div className="mx-4 sm:mx-6 mt-2 mb-1 border border-[var(--color-border)] bg-[var(--color-accent-light)] rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-[var(--color-accent)] shrink-0"><LockIcon className="w-5 h-5" /></span>
          <p className="flex-1 text-[13px] text-[var(--color-text-primary)]">
            <span className="font-medium">Sign in</span>
            <span className="text-[var(--color-text-secondary)]"> to open registration, prep courses and exam guides</span>
          </p>
          <button
            onClick={() => (window as any).Clerk?.openSignIn?.()}
            className="px-3 py-1.5 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-4)] text-[12px] font-medium text-[var(--color-text-primary)] rounded-md transition-colors"
          >
            Sign In
          </button>
        </div>
      )}

      <div className="px-4 sm:px-6 py-4 flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, provider or topic"
            aria-label="Search certifications and courses"
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[16px] sm:text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] pl-9 pr-3 py-2 outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort by"
          className="shrink-0 max-w-[45%] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[16px] sm:text-[13px] text-[var(--color-text-secondary)] font-medium px-3 py-2 outline-none focus:border-[var(--color-accent)] cursor-pointer"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      {facets.length > 0 && (
        <div className="px-4 sm:px-6 pb-3 flex flex-wrap items-center gap-2">
          {facets.map((f) => (
            <FacetDropdown
              key={f.key}
              facet={f.key}
              title={f.label}
              options={f.options}
              selected={selection[f.key] ?? []}
              onToggle={(v) => toggle(f.key, v)}
              providers={data.providers}
            />
          ))}
        </div>
      )}

      <div className="px-4 sm:px-6 pb-6">
        <div>
          <div className="mb-3 flex items-center gap-1.5 flex-wrap min-h-[24px]">
            <span className="text-[12px] text-[var(--color-text-tertiary)] mr-1 tabular-nums">
              {visible.length} {visible.length === 1 ? 'result' : 'results'}
            </span>
            {active.map(({ key, value }) => (
              <button
                key={`${key}:${value}`}
                onClick={() => toggle(key, value)}
                aria-label={`Remove filter ${label(key, value)}`}
                className="flex items-center gap-1 text-[11px] font-medium bg-[var(--color-surface-3)] text-[var(--color-text-primary)] pl-2 pr-1.5 py-0.5 rounded-full border border-[var(--color-border)] hover:border-[var(--color-accent)]"
              >
                {label(key, value)}
                <span aria-hidden className="text-[var(--color-text-tertiary)]">×</span>
              </button>
            ))}
            {filtering && (
              <button onClick={clearAll} className="text-[11px] font-medium text-[var(--color-accent)] hover:underline ml-1">
                Clear all
              </button>
            )}
          </div>

          {visible.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {visible.map((item) => (
                <CertificationCard key={item.id} item={item} provider={data.providers[item.provider]} onOpen={() => setSelected(item)} />
              ))}
            </div>
          ) : (
            <p className="pb-10 pt-6 text-center text-[13px] text-[var(--color-text-tertiary)]">
              Nothing matches.{' '}
              <button onClick={clearAll} className="text-[var(--color-accent)] hover:underline">Clear filters</button>
            </p>
          )}
        </div>
      </div>

      {selected && (
        <CertificationModal item={selected} provider={data.providers[selected.provider]} signedIn={isSignedIn} loaded={isLoaded} onClose={close} />
      )}

      <p className="px-6 pb-8 text-center text-[11px] text-[var(--color-text-tertiary)]">
        Last updated:{' '}
        {new Date(data.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
        {' | '}Sources: {data.sources.join(', ')}. Prices and terms are set by each provider.
      </p>
    </div>
  );
}
